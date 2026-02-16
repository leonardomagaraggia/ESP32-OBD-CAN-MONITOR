#include "web_server.h"
#include "obd.h"
#include "esp_http_server.h"
#include "esp_log.h"
#include <stdio.h>
#include <string.h>

static const char *TAG = "WEB_SERVER";

/* =======================================================
 * 1. DEFINIZIONE DATI E BLOBS
 * ======================================================= */
typedef struct {
    const uint8_t *start;
    const uint8_t *end;
} blob_t;

/* Macro per dichiarare i file binari caricati dal CMake */
#define DECL_FILE(name)                                                           \
    extern const uint8_t _binary_##name##_start[] asm("_binary_" #name "_start"); \
    extern const uint8_t _binary_##name##_end[]   asm("_binary_" #name "_end")

DECL_FILE(index_html);
DECL_FILE(graph_html);
DECL_FILE(errors_html);
DECL_FILE(diagnostics_html);
DECL_FILE(script_js);
DECL_FILE(style_css);
DECL_FILE(chart_script_js);
DECL_FILE(animations_js);
DECL_FILE(diagnostics_script_js);
DECL_FILE(chart_js);
DECL_FILE(luxox_js);
DECL_FILE(Inter_Bold_woff2);
DECL_FILE(Inter_Regular_woff2);
DECL_FILE(all_min_css);
DECL_FILE(fa_solid_900_woff2);
DECL_FILE(fa_regular_400_woff2);
DECL_FILE(fa_brands_400_woff2);

/* =======================================================
 * 2. ENDPOINT DATI JSON (/data)
 *    (chiavi coerenti con script.js “robusto”)
 * ======================================================= */
obd_full_data_t d;
static esp_err_t data_handler(httpd_req_t *req)
{
    d = obd_get_all_data();

    char resp[768];
    int len = snprintf(resp, sizeof(resp),
        "{"
        "\"rpm\":%u,"
        "\"speed\":%u,"
        "\"load\":%.1f,"
        "\"throttle\":%.1f,"
        "\"timing\":%.1f,"
        "\"maf\":%.2f,"
        "\"temp_coolant\":%d,"
        "\"temp_intake\":%d,"
        "\"temp_ambient\":%d,"
        "\"press_intake\":%u,"
        "\"press_baro\":%.1f,"
        "\"fuel_lvl\":%.1f,"
        "\"fuel_press\":%.1f,"
        "\"fuel_trim_s\":%.1f,"
        "\"fuel_trim_l\":%.1f,"
        "\"batt\":%.2f,"
        "\"dist_mil\":%u,"
        "\"dtc_count\":%u,"
        "\"pending_dtc\":%u"
        "}",
        (unsigned)d.rpm,
        (unsigned)d.speed,
        d.engine_load,
        d.throttle_pos,
        d.timing_advance,
        d.maf_rate,
        (int)d.coolant_temp,
        (int)d.intake_air_temp,
        (int)d.ambient_temp,
        (unsigned)d.intake_pressure,
        d.barometric_press,
        d.fuel_level,
        d.fuel_pressure,
        d.fuel_trim_short,
        d.fuel_trim_long,
        d.battery_voltage,
        (unsigned)d.distance_with_mil,
        (unsigned)d.dtc_count,
        0u // se non hai pending nel struct, lascia 0
    );

    if (len < 0 || len >= (int)sizeof(resp)) {
        ESP_LOGE(TAG, "JSON overflow (len=%d)", len);
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "JSON too large");
        return ESP_FAIL;
    }

    httpd_resp_set_type(req, "application/json");
    httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");
    httpd_resp_set_hdr(req, "Pragma", "no-cache");
    httpd_resp_set_hdr(req, "Expires", "0");

    return httpd_resp_send(req, resp, len);
}

/* =======================================================
 * 3. LOGICA DI SELEZIONE FILE (BLOB)
 * ======================================================= */
static blob_t get_blob_for_uri(const char *uri, const char **mime_out)
{
    *mime_out = "text/plain";

    // --- PAGINE HTML ---
    if (strcmp(uri, "/") == 0 || strcmp(uri, "/index.html") == 0) {
        *mime_out = "text/html";
        return (blob_t){_binary_index_html_start, _binary_index_html_end};
    }
    if (strstr(uri, "/graph.html")) {
        *mime_out = "text/html";
        return (blob_t){_binary_graph_html_start, _binary_graph_html_end};
    }
    if (strstr(uri, "/errors.html")) {
        *mime_out = "text/html";
        return (blob_t){_binary_errors_html_start, _binary_errors_html_end};
    }
    if (strstr(uri, "/diagnostics.html")) {
        *mime_out = "text/html";
        return (blob_t){_binary_diagnostics_html_start, _binary_diagnostics_html_end};
    }

    // --- JAVASCRIPT ---
    if (strstr(uri, "/script.js")) {
        *mime_out = "application/javascript";
        return (blob_t){_binary_script_js_start, _binary_script_js_end};
    }
    if (strstr(uri, "/chart-script.js")) {
        *mime_out = "application/javascript";
        return (blob_t){_binary_chart_script_js_start, _binary_chart_script_js_end};
    }
    if (strstr(uri, "/animations.js")) {
        *mime_out = "application/javascript";
        return (blob_t){_binary_animations_js_start, _binary_animations_js_end};
    }
    if (strstr(uri, "/diagnostics-script.js")) {
        *mime_out = "application/javascript";
        return (blob_t){_binary_diagnostics_script_js_start, _binary_diagnostics_script_js_end};
    }
    if (strstr(uri, "/chart.js")) {
        *mime_out = "application/javascript";
        return (blob_t){_binary_chart_js_start, _binary_chart_js_end};
    }
    if (strstr(uri, "/luxox.js")) {
        *mime_out = "application/javascript";
        return (blob_t){_binary_luxox_js_start, _binary_luxox_js_end};
    }

    // --- CSS ---
    if (strstr(uri, "/style.css")) {
        *mime_out = "text/css";
        return (blob_t){_binary_style_css_start, _binary_style_css_end};
    }
    if (strstr(uri, "all.min.css")) {
        *mime_out = "text/css";
        return (blob_t){_binary_all_min_css_start, _binary_all_min_css_end};
    }

    // --- FONTS (WOFF2) ---
    if (strstr(uri, ".woff2")) {
        *mime_out = "font/woff2";
        if (strstr(uri, "Inter-Bold"))
            return (blob_t){_binary_Inter_Bold_woff2_start, _binary_Inter_Bold_woff2_end};
        if (strstr(uri, "Inter-Regular"))
            return (blob_t){_binary_Inter_Regular_woff2_start, _binary_Inter_Regular_woff2_end};
        if (strstr(uri, "fa-solid-900"))
            return (blob_t){_binary_fa_solid_900_woff2_start, _binary_fa_solid_900_woff2_end};
        if (strstr(uri, "fa-regular-400"))
            return (blob_t){_binary_fa_regular_400_woff2_start, _binary_fa_regular_400_woff2_end};
        if (strstr(uri, "fa-brands-400"))
            return (blob_t){_binary_fa_brands_400_woff2_start, _binary_fa_brands_400_woff2_end};
    }

    *mime_out = NULL;
    return (blob_t){NULL, NULL};
}

/* =======================================================
 * 4. HANDLER FILE STATICI
 * ======================================================= */
static esp_err_t static_handler(httpd_req_t *req)
{
    const char *mime = NULL;
    blob_t b = get_blob_for_uri(req->uri, &mime);

    if (b.start == NULL || mime == NULL) {
        ESP_LOGW(TAG, "File non trovato: %s", req->uri);
        httpd_resp_send_err(req, HTTPD_404_NOT_FOUND, "Not Found");
        return ESP_OK;
    }

    size_t len = (size_t)(b.end - b.start);

    httpd_resp_set_type(req, mime);


    // Chunked per file grandi (>4KB) per evitare mismatch/instabilità
    if (len > 4096) {
        const size_t CHUNK = 2048;
        size_t off = 0;
        while (off < len) {
            size_t to_send = (len - off) > CHUNK ? CHUNK : (len - off);
            esp_err_t ret = httpd_resp_send_chunk(req, (const char *)b.start + off, to_send);
            if (ret != ESP_OK) {
                ESP_LOGW(TAG, "Chunk send failed (%d) uri=%s", (int)ret, req->uri);
                return ret;
            }
            off += to_send;
        }
        return httpd_resp_send_chunk(req, NULL, 0);
    }

    return httpd_resp_send(req, (const char *)b.start, len);
}
/*===================================================
                RPM TO LCD
==================================================*/

unsigned get_rpm(void)
{
    return (unsigned)d.rpm;
}
int get_temp(void)
{
    return (int)d.coolant_temp;
}
float get_battery(void)
{
    return (float)d.battery_voltage;
}


/* =======================================================
 * 5. AVVIO SERVER 
 * ======================================================= */
void web_server_start(void)
{
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.stack_size = 10240;
    config.uri_match_fn = httpd_uri_match_wildcard;

    httpd_handle_t server = NULL;
    if (httpd_start(&server, &config) != ESP_OK) {
        ESP_LOGE(TAG, "Errore avvio server");
        return;
    }

    httpd_uri_t data_uri = {
        .uri = "/data",
        .method = HTTP_GET,
        .handler = data_handler,
        .user_ctx = NULL
    };
    httpd_register_uri_handler(server, &data_uri);

    httpd_uri_t static_uri = {
        .uri = "/*",
        .method = HTTP_GET,
        .handler = static_handler,
        .user_ctx = NULL
    };
    httpd_register_uri_handler(server, &static_uri);

    ESP_LOGI(TAG, "Web Server avviato correttamente");
}

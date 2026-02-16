#include <stdio.h>
#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "esp_wifi.h"
#include "esp_event.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "esp_log.h"

#include "can_bus.h"
#include "lcd.h"
#include "obd.h"
#include "web_server.h"


static const char *TAG = "OBD_CAN_MONITOR";

/* =======================================================
 * 1. GESTIONE WIFI E CONTROLLO CLIENT
 * ======================================================= */
static int s_active_clients = 0;

static void wifi_event_handler(void* arg, esp_event_base_t event_base,
                               int32_t event_id, void* event_data)
{
    if (event_id == WIFI_EVENT_AP_STACONNECTED) {
        s_active_clients++;
        ESP_LOGI(TAG, "Client connesso. Totale: %d", s_active_clients);
    } else if (event_id == WIFI_EVENT_AP_STADISCONNECTED) {
        if (s_active_clients > 0) s_active_clients--;
        ESP_LOGI(TAG, "Client disconnesso. Totale: %d", s_active_clients);
    }
}

static void wifi_init(void)
{
    esp_netif_init();
    esp_event_loop_create_default();
    esp_netif_create_default_wifi_ap();

    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                        ESP_EVENT_ANY_ID,
                                                        &wifi_event_handler,
                                                        NULL,
                                                        NULL));

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&cfg);

    wifi_config_t ap = {
        .ap = {
            .ssid = "OBD_CAN_MONITOR",
            .password = "12345678",
            .channel = 1,
            .max_connection = 4,
            .authmode = WIFI_AUTH_WPA_WPA2_PSK
        }
    };

    esp_wifi_set_mode(WIFI_MODE_AP);
    esp_wifi_set_config(WIFI_IF_AP, &ap);
    esp_wifi_start();

    ESP_LOGI(TAG, "WiFi AP started");
}

/* =======================================================
 * 2. TASK AGGIORNAMENTO DISPLAY
 * ======================================================= */
static void lcd_update_task(void *pvParameters)
{
    char buf[17];

    while (1) {
        lcd_gotoxy(0, 0);
        snprintf(buf, sizeof(buf), "AP:%2d |TEMP:%2d°", s_active_clients, get_temp());
        lcd_print(buf);

        lcd_gotoxy(0, 1);
        snprintf(buf, sizeof(buf), "+%4.1fV |RPM:%4u", get_battery(),get_rpm());
        lcd_print(buf);

        vTaskDelay(pdMS_TO_TICKS(400));
    }
}

 /*=======================================================
 * 3. MAIN ENTRY POINT
 * ======================================================= */
void app_main(void)
{
    ESP_LOGI(TAG, "START obd_can_monitor");

    nvs_flash_init();

    /* Inizializzazione Rete */

    /* Inizializzazione Hardware */
    can_bus_init();
    obd_init();

    wifi_init();
    web_server_start();
    lcd_init();



    /* Avvio monitoraggio su display */
    xTaskCreate(lcd_update_task, "lcd_update_task", 2048, NULL, 5, NULL);
}

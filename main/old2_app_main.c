#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "esp_log.h"

#include "can_bus.h"
#include "obd.h"
#include "web_server.h"

static const char *TAG = "OBD_CAN_MONITOR";

static void wifi_init(void)
{
    esp_netif_init();
    esp_event_loop_create_default();
    esp_netif_create_default_wifi_ap();

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

void app_main(void)
{
    ESP_LOGI(TAG, "START obd_can_monitor");

    nvs_flash_init();

    can_bus_init();
    obd_init();
    wifi_init();
    web_server_start();
}

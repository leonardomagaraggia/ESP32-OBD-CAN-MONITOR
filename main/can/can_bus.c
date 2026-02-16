#include "can_bus.h"
#include "esp_log.h"

static const char *TAG = "CAN_BUS";

void can_bus_init(void)
{
    twai_general_config_t g_config =
        TWAI_GENERAL_CONFIG_DEFAULT(GPIO_NUM_5, GPIO_NUM_4, TWAI_MODE_NORMAL);

    twai_timing_config_t t_config =
        TWAI_TIMING_CONFIG_500KBITS();

    twai_filter_config_t f_config =
        TWAI_FILTER_CONFIG_ACCEPT_ALL();

    ESP_ERROR_CHECK(twai_driver_install(&g_config, &t_config, &f_config));
    ESP_ERROR_CHECK(twai_start());

    ESP_LOGI(TAG, "CAN init OK");
}

esp_err_t can_bus_send(twai_message_t *msg)
{
    return twai_transmit(msg, pdMS_TO_TICKS(100));
}

esp_err_t can_bus_receive(twai_message_t *msg, TickType_t timeout)
{
    return twai_receive(msg, timeout);
}

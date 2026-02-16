#include "obd.h"
#include "can_bus.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "OBD_HW";

/* -------------------------------------------------------
 * Lettura singolo PID via CAN HAL
 * ------------------------------------------------------- */
bool obd_read_pid(uint8_t pid, uint8_t out[4])
{
    if (!out)
        return false;

    twai_message_t tx = {
        .identifier = 0x7DF,
        .data_length_code = 8,
        .data = {0x02, 0x01, pid, 0, 0, 0, 0, 0}
    };

    if (can_bus_send(&tx) != ESP_OK)
        return false;

    twai_message_t rx;
    TickType_t start = xTaskGetTickCount();
    TickType_t timeout = pdMS_TO_TICKS(100);

    while ((xTaskGetTickCount() - start) < timeout)
    {
        if (can_bus_receive(&rx, pdMS_TO_TICKS(50)) == ESP_OK)
        {
            if (rx.identifier >= 0x7E8 &&
                rx.identifier <= 0x7EF &&
                rx.data_length_code >= 3 &&
                rx.data[2] == pid)
            {
                for (int i = 0; i < 4; i++)
                    out[i] = rx.data[i + 3];

                return true;
            }
        }
    }

    return false;
}

/* -------------------------------------------------------
 * Inizializzazione OBD Layer
 * ------------------------------------------------------- */
void obd_init(void)
{
    obd_data_init();  // inizializza storage + mutex

    ESP_LOGI(TAG, "OBD layer started. Using CAN HAL.");

    // Avvia lo scheduler real-time
    obd_data_start_polling();
}

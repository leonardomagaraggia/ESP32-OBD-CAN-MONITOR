#pragma once
#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C"
{
#endif

    typedef struct
    {
        uint16_t rpm;               // PID 0x0C
        uint8_t speed;              // PID 0x0D
        float engine_load;          // PID 0x04 (%)
        float throttle_pos;         // PID 0x11 (%)
        float timing_advance;       // PID 0x0E (deg)
        int16_t coolant_temp;       // PID 0x05 (°C)
        int16_t intake_air_temp;    // PID 0x0F (°C)
        int16_t ambient_temp;       // PID 0x46 (°C)
        uint8_t intake_pressure;    // PID 0x0B (kPa)
        float barometric_press;     // PID 0x33 (kPa)
        float maf_rate;             // PID 0x10 (g/s)
        float fuel_level;           // PID 0x2F (%)
        float fuel_pressure;        // PID 0x0A (kPa)
        float fuel_trim_short;      // PID 0x06 (%)
        float fuel_trim_long;       // PID 0x07 (%)
        float battery_voltage;      // PID 0x42 (V)
        uint16_t distance_with_mil; // PID 0x21 (km)
        uint8_t dtc_count;          // PID 0x01 (count)
    } obd_full_data_t;

    /* Inizializza il driver CAN e lo storage dati */
    void obd_init(void);

    /* Legge un singolo PID (usata internamente dallo scheduler) */
    bool obd_read_pid(uint8_t pid, uint8_t out[4]);

    /* Funzioni di gestione dati (obd_data.c) */
    void obd_data_init(void);
    void obd_data_start_polling(void);

    /* Funzione per il Web Server */
    obd_full_data_t obd_get_all_data(void);

#ifdef __cplusplus
}
#endif
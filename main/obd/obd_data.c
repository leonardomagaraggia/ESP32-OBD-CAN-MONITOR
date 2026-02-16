#include "obd.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "esp_log.h"

#include <string.h>
#include <stdint.h>
#include <stdbool.h>

static const char *TAG = "OBD_DATA";

/* -------------------------------------------------------
 * Dipendenza: lettura PID da obd.c (DEVE essere visibile)
 * ------------------------------------------------------- */
extern bool obd_read_pid(uint8_t pid, uint8_t out[4]);

/* -------------------------------------------------------
 * Storage dati condivisi (come prima)
 * ------------------------------------------------------- */
static obd_full_data_t s_obd;
static SemaphoreHandle_t s_obd_mutex;

/* -------------------------------------------------------
 * Scheduler a priorità
 * ------------------------------------------------------- */

#ifndef OBD_REQ_SPACING_MS
// Spaziatura minima tra richieste CAN OBD.
// 25ms ≈ 40 req/s teoriche; su molte ECU 30ms è più sicuro.
// Se noti instabilità, porta a 30-40ms.
#define OBD_REQ_SPACING_MS 25
#endif

#ifndef OBD_FAIL_BACKOFF_MS
// Backoff base quando un PID fallisce ripetutamente
#define OBD_FAIL_BACKOFF_MS 2000
#endif

#ifndef OBD_FAIL_THRESHOLD
// Dopo quanti fail consecutivi attivare backoff
#define OBD_FAIL_THRESHOLD 5
#endif

typedef enum
{
    PID_PRIO_HIGH = 0,
    PID_PRIO_MED = 1,
    PID_PRIO_LOW = 2,
} pid_prio_t;

typedef struct
{
    uint8_t pid;
    pid_prio_t prio;
    uint32_t period_ms;     // 100 / 500 / 2000
    uint32_t next_due_ms;   // scheduling assoluto (ms)
    uint8_t fail_count;     // fail consecutivi
    uint32_t backoff_until; // se > now, non richiedere
} pid_job_t;

/* Tabella PID secondo la tua specifica */
static pid_job_t s_jobs[] = {
    // ALTA 100ms
    {0x0C, PID_PRIO_HIGH, 100, 0, 0, 0}, // rpm
    {0x0D, PID_PRIO_HIGH, 100, 0, 0, 0}, // speed
    {0x04, PID_PRIO_HIGH, 100, 0, 0, 0}, // load
    {0x11, PID_PRIO_HIGH, 100, 0, 0, 0}, // throttle

    // MEDIA 500ms
    {0x0E, PID_PRIO_MED, 500, 0, 0, 0}, // timing
    {0x10, PID_PRIO_MED, 500, 0, 0, 0}, // maf
    {0x05, PID_PRIO_MED, 500, 0, 0, 0}, // coolant
    {0x0F, PID_PRIO_MED, 500, 0, 0, 0}, // intake temp
    {0x0B, PID_PRIO_MED, 500, 0, 0, 0}, // press_intake (MAP)
    {0x33, PID_PRIO_MED, 500, 0, 0, 0}, // press_baro
    {0x42, PID_PRIO_MED, 500, 0, 0, 0}, // batt

    // BASSA 2000ms
    {0x46, PID_PRIO_LOW, 2000, 0, 0, 0}, // temp_ambient
    {0x2F, PID_PRIO_LOW, 2000, 0, 0, 0}, // fuel_lvl
    {0x0A, PID_PRIO_LOW, 2000, 0, 0, 0}, // fuel_press
    {0x06, PID_PRIO_LOW, 2000, 0, 0, 0}, // fuel_trim_s
    {0x07, PID_PRIO_LOW, 2000, 0, 0, 0}, // fuel_trim_l
    {0x21, PID_PRIO_LOW, 2000, 0, 0, 0}, // dist_mil
    {0x01, PID_PRIO_LOW, 2000, 0, 0, 0}, // dtc
};

static inline uint32_t now_ms(void)
{
    return (uint32_t)(xTaskGetTickCount() * portTICK_PERIOD_MS);
}

/* Applica i bytes letti al struct dati */
static void apply_pid_value(obd_full_data_t *d, uint8_t pid, const uint8_t b[4])
{
    switch (pid)
    {
    case 0x0C: // RPM ((A*256)+B)/4
        d->rpm = (uint16_t)(((uint16_t)b[0] << 8) | b[1]) / 4;
        break;

    case 0x0D: // Speed A
        d->speed = b[0];
        break;

    case 0x04: // Load (A*100)/255
        d->engine_load = (float)b[0] * 100.0f / 255.0f;
        break;

    case 0x11: // Throttle (A*100)/255
        d->throttle_pos = (float)b[0] * 100.0f / 255.0f;
        break;

    case 0x0E: // Timing (A/2)-64
        d->timing_advance = ((float)b[0] / 2.0f) - 64.0f;
        break;

    case 0x10: // MAF ((A*256)+B)/100
        d->maf_rate = (float)(((uint16_t)b[0] << 8) | b[1]) / 100.0f;
        break;

    case 0x05: // Coolant A-40
        d->coolant_temp = (int16_t)b[0] - 40;
        break;

    case 0x0F: // Intake temp A-40
        d->intake_air_temp = (int16_t)b[0] - 40;
        break;

    case 0x0B: // MAP A
        d->intake_pressure = b[0];
        break;

    case 0x33: // Baro A
        d->barometric_press = (float)b[0];
        break;

    case 0x42: // Battery ((A*256)+B)/1000
        d->battery_voltage = (float)(((uint16_t)b[0] << 8) | b[1]) / 1000.0f;
        break;

    case 0x46: // Ambient A-40
        d->ambient_temp = (int16_t)b[0] - 40;
        break;

    case 0x2F: // Fuel level (A*100)/255
        d->fuel_level = (float)b[0] * 100.0f / 255.0f;
        break;

    case 0x0A: // Fuel pressure A*3 (kPa) (spesso non supportato)
        d->fuel_pressure = (float)b[0] * 3.0f;
        break;

    case 0x06: // Short trim (A-128)*100/128
        d->fuel_trim_short = ((float)b[0] - 128.0f) * 100.0f / 128.0f;
        break;

    case 0x07: // Long trim (A-128)*100/128
        d->fuel_trim_long = ((float)b[0] - 128.0f) * 100.0f / 128.0f;
        break;

    case 0x21: // Distance with MIL (A*256)+B
        d->distance_with_mil = (uint16_t)(((uint16_t)b[0] << 8) | b[1]);
        break;

    case 0x01: // DTC count: A & 0x7F
        d->dtc_count = (uint8_t)(b[0] & 0x7F);
        break;

    default:
        break;
    }
}

/* Scelta del prossimo job da eseguire:
   - prende quello "due" (now >= next_due), non in backoff
   - priorità: HIGH > MED > LOW
   - a parità: quello più in ritardo (now - next_due più grande)
*/
static int pick_next_job(uint32_t tnow)
{
    int best = -1;
    int best_prio = 999;
    int32_t best_lateness = -2147483647;

    for (int i = 0; i < (int)(sizeof(s_jobs) / sizeof(s_jobs[0])); i++)
    {
        pid_job_t *j = &s_jobs[i];

        if (tnow < j->backoff_until)
            continue;
        if (tnow < j->next_due_ms)
            continue;

        int prio = (int)j->prio;
        int32_t lateness = (int32_t)(tnow - j->next_due_ms);

        if (prio < best_prio || (prio == best_prio && lateness > best_lateness))
        {
            best = i;
            best_prio = prio;
            best_lateness = lateness;
        }
    }
    return best;
}

/* Task real-time: esegue una richiesta ogni OBD_REQ_SPACING_MS
   scegliendo sempre il prossimo PID "due" rispettando priorità e periodo.
*/
static void obd_rt_task(void *arg)
{
    (void)arg;

    // snapshot locale che aggiorniamo e poi pubblichiamo nel mutex
    obd_full_data_t local;
    memset(&local, 0, sizeof(local));

    // inizializza scheduler: scagliono i next_due per evitare “burst”
    uint32_t t0 = now_ms();
    for (int i = 0; i < (int)(sizeof(s_jobs) / sizeof(s_jobs[0])); i++)
    {
        // distribuzione iniziale: offset semplice (i * 10ms) per spalmare
        s_jobs[i].next_due_ms = t0 + (uint32_t)(i * 10);
        s_jobs[i].fail_count = 0;
        s_jobs[i].backoff_until = 0;
    }

    ESP_LOGI(TAG, "OBD RT task started (spacing=%dms)", (int)OBD_REQ_SPACING_MS);

    while (1)
    {
        uint32_t tnow = now_ms();
        int idx = pick_next_job(tnow);

        if (idx < 0)
        {
            // Nulla due: dormi poco (granularità scheduler)
            vTaskDelay(pdMS_TO_TICKS(5));
            continue;
        }

        pid_job_t *j = &s_jobs[idx];
        uint8_t b[4] = {0};

        bool ok = obd_read_pid(j->pid, b);

        if (ok)
        {
            j->fail_count = 0;

            // aggiorna local e pubblica
            apply_pid_value(&local, j->pid, b);

            if (s_obd_mutex)
            {
                xSemaphoreTake(s_obd_mutex, portMAX_DELAY);
                s_obd = local;
                xSemaphoreGive(s_obd_mutex);
            }

            // programma prossimo giro su base periodica (non “now+period”)
            // per mantenere la frequenza stabile anche se siamo in ritardo.
            j->next_due_ms += j->period_ms;
        }
        else
        {
            j->fail_count++;

            // Se fallisce, riprova presto ma non spammare:
            // - piccolo retry (period/2) finché sotto soglia
            // - poi backoff progressivo
            if (j->fail_count < OBD_FAIL_THRESHOLD)
            {
                j->next_due_ms = tnow + (j->period_ms / 2);
            }
            else
            {
                uint32_t backoff = OBD_FAIL_BACKOFF_MS;
                // backoff cresce con fail_count (cap a 20s)
                uint32_t extra = (uint32_t)(j->fail_count - OBD_FAIL_THRESHOLD) * 1000U;
                if (extra > 18000U)
                    extra = 18000U;

                j->backoff_until = tnow + backoff + extra;
                j->next_due_ms = j->backoff_until + j->period_ms;
            }
        }

        // una richiesta ogni spacing ms -> evita burst inutili
        vTaskDelay(pdMS_TO_TICKS(OBD_REQ_SPACING_MS));
    }
}

/* -------------------------------------------------------
 * API pubbliche (compatibili) + start polling
 * ------------------------------------------------------- */

void obd_data_init(void)
{
    memset(&s_obd, 0, sizeof(s_obd));
    s_obd_mutex = xSemaphoreCreateMutex();
}

void obd_data_set(const obd_full_data_t *src)
{
    // mantenuta per compatibilità: se altrove vuoi “pushare” snapshot
    if (!s_obd_mutex || !src)
        return;

    xSemaphoreTake(s_obd_mutex, portMAX_DELAY);
    s_obd = *src;
    xSemaphoreGive(s_obd_mutex);
}

obd_full_data_t obd_get_all_data(void)
{
    obd_full_data_t copy;
    memset(&copy, 0, sizeof(copy));

    if (!s_obd_mutex)
        return copy;

    xSemaphoreTake(s_obd_mutex, portMAX_DELAY);
    copy = s_obd;
    xSemaphoreGive(s_obd_mutex);
    return copy;
}

void obd_data_start_polling(void)
{
    // Task con priorità leggermente > web/task normali, ma < TWAI driver interno
    // Stack: JSON e parsing non qui, quindi 4096 basta di solito.
    xTaskCreate(obd_rt_task, "obd_rt", 4096, NULL, 6, NULL);
}

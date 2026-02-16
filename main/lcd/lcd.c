#include "lcd.h"

#include "driver/gpio.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_rom_sys.h"

/* =========================
 *  PIN MAPPING (EDIT HERE)
 * ========================= */
#ifndef LCD_RS
#define LCD_RS  GPIO_NUM_23
#endif

#ifndef LCD_E
#define LCD_E   GPIO_NUM_22
#endif

#ifndef LCD_D4
#define LCD_D4  GPIO_NUM_21
#endif

#ifndef LCD_D5
#define LCD_D5  GPIO_NUM_19
#endif

#ifndef LCD_D6
#define LCD_D6  GPIO_NUM_18
#endif

#ifndef LCD_D7
#define LCD_D7  GPIO_NUM_17
#endif

static inline void delay_us(uint32_t us) { esp_rom_delay_us(us); }
static inline void delay_ms(uint32_t ms) { vTaskDelay(pdMS_TO_TICKS(ms)); }

static void lcd_strobe(void)
{
    gpio_set_level(LCD_E, 1);
    delay_us(50);
    gpio_set_level(LCD_E, 0);
    delay_us(100);
}

static void lcd_write_4bit(uint8_t nibble)
{
    gpio_set_level(LCD_D4, (nibble >> 0) & 1);
    gpio_set_level(LCD_D5, (nibble >> 1) & 1);
    gpio_set_level(LCD_D6, (nibble >> 2) & 1);
    gpio_set_level(LCD_D7, (nibble >> 3) & 1);
    lcd_strobe();
}

static void lcd_send(uint8_t data, int rs)
{
    gpio_set_level(LCD_RS, rs);
    delay_us(20);

    lcd_write_4bit(data >> 4);
    delay_us(100);
    lcd_write_4bit(data & 0x0F);

    if (rs == 0 && (data == 0x01 || data == 0x02)) {
        delay_ms(10);
    } else {
        delay_us(200);
    }
}

void lcd_clear(void)
{
    lcd_send(0x01, 0);
    delay_ms(5);
}

void lcd_gotoxy(uint8_t col, uint8_t row)
{
    uint8_t addr = (row == 0) ? (0x80 + col) : (0xC0 + col);
    lcd_send(addr, 0);
}

void lcd_print(const char *str)
{
    while (*str) {
        lcd_send((uint8_t)(*str++), 1);
        delay_us(50);
    }
}

void lcd_init(void)
{
    gpio_num_t pins[] = { LCD_RS, LCD_E, LCD_D4, LCD_D5, LCD_D6, LCD_D7 };
    for (int i = 0; i < 6; i++) {
        gpio_reset_pin(pins[i]);
        gpio_set_direction(pins[i], GPIO_MODE_OUTPUT);
        gpio_set_level(pins[i], 0);
    }

    delay_ms(100);

    /* Init sequence (4-bit) */
    lcd_write_4bit(0x03); delay_ms(10);
    lcd_write_4bit(0x03); delay_ms(2);
    lcd_write_4bit(0x03); delay_ms(2);
    lcd_write_4bit(0x02); delay_ms(5);

    /* Function set: 4-bit, 2-line, 5x8 */
    lcd_send(0x28, 0);

    /* Display ON, cursor OFF, blink OFF */
    lcd_send(0x0C, 0);

    /* Entry mode: increment, no shift */
    lcd_send(0x06, 0);

    lcd_clear();
}

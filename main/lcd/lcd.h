#pragma once

#include <stdint.h>

/**
 * Inizializza LCD HD44780 compatibile in modalità 4-bit, 2 righe.
 */
void lcd_init(void);

/**
 * Pulisce display e torna a home.
 */
void lcd_clear(void);

/**
 * Posiziona il cursore.
 * row: 0 o 1
 * col: 0..15
 */
void lcd_gotoxy(uint8_t col, uint8_t row);

/**
 * Stampa una stringa (no wrap automatico).
 */
void lcd_print(const char *str);

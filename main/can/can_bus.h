#pragma once
#include "driver/twai.h"

void can_bus_init(void);
esp_err_t can_bus_send(twai_message_t *msg);
esp_err_t can_bus_receive(twai_message_t *msg, TickType_t timeout);

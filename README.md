# BTC Signal AI v4.3.1

Basada en v4.3.

## Corrección principal
- Un plan congelado comienza en estado **ESPERANDO ENTRADA**.
- El sistema no puede marcar Take Profit ni Stop Loss antes de que el precio alcance o cruce la zona de entrada.
- Al detectarse la entrada, cambia a **OPERACIÓN ACTIVA**.
- TP y SL se controlan únicamente en actualizaciones posteriores a la confirmación de entrada.
- Se evita reutilizar el estado incorrecto guardado por v4.3 mediante una nueva clave local.
- El Paper Trading abre la operación solo después de confirmar la entrada.

No ejecuta órdenes ni garantiza resultados futuros.

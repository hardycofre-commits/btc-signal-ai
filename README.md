# BTC Signal AI v4.1.2

Asistente de operación con apalancamiento fijo 10x y riesgo monetario variable según la señal:

- Compra fuerte: riesgo máximo USD 30.
- Compra moderada: riesgo máximo USD 18.
- Compra cautelosa: riesgo máximo USD 10.
- Esperar / No comprar / Evitar: no genera operación.

El tamaño de la posición se calcula a partir de la distancia al stop loss y queda limitado por el capital disponible multiplicado por 10. Los cálculos son estimados y no incluyen comisiones, funding ni deslizamiento.

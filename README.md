1. Dado que voy a trabajar con API REST, para conocer una nueva tecnologia, utilizaré wrangler de cloudflare para así trabajar serverless.  Cloudflare a diferencia de Express, no se mantiene un server vivo, si no que se ejecuta por request.
    - npx wrangler init (npx para ejecutar paquetes)

Los signals se calculan automáticamente mediante Gemini, procesando los ~225 items en lotes.



## API workers/ddragon (Cloudflare Worker):
Esta es la encargada de ser el middleware que permite extraer la data de ddragon y manejarla. La funcion principal es calcular los signals de cada item, los cuales seran los encargados de definir que tipo de item es cada uno para que la IA puede determinar que item puede ser el adecuado para cada situacion.

Los signals son: `tankiness`, `physicalDps`, `burstAd`, `burstAp`, `antiTank`, `sustain`, `antiHeal`. Cada uno va de 0 a 1.

Se actualizan los cambios desarrollados localmente mediante:
- npx wrangler deploy

Se define la API_KEY como:
- npx wrangler secret put GOOGLE_API_KEY

### Rutas:
1. `/items-signals` — GET que retorna el json de los items procesados. Primero revisa en la DB de cloudflare (KV) si ya existen los items con sus respectivos signals, si nó procede a calcularlos mediante un agente que trabaja con Gemini. Retorna SSE (Server-Sent Events) con logs en tiempo real y el JSON al final.
    - `?reset=true` — Borra el progreso y cache de signals para recalcular desde cero.
2. `/champs-data` — GET que retorna los champs normalizados desde ddragon.

### Flujo de cálculo de signals:
1. GET data de items desde ddragon, normaliza (~225 items de Summoner's Rift).
2. Si cambió la versión de ddragon, compara items con la versión anterior. Los que no cambiaron heredan sus signals, solo recalcula los modificados/nuevos.
3. Procesa en lotes de 15 items via Gemini. Guarda progreso parcial en KV por si se corta (524, 503, etc). Al llamar de nuevo retoma donde quedó.
4. Cuando todos los items tienen signals, guarda el resultado final en KV como cache.

### Rate limits (Gemini free tier):
- 5 RPM, 250K TPM, 20 RPD
- Si Gemini devuelve 429, para automáticamente. Hay que volver a llamar cuando se resetee.


## API workers/main (Local, Node):
Se ejecuta localmente. Consume la data de ddragon worker y la data de partidas en tiempo real.

### Flujo:
- Al iniciar el server, dispara un refresh de items-signals en background automáticamente. No bloquea el inicio.
- Llama a `/items-signals` del worker ddragon para obtener items con signals.
- Llama a `/champs-data` para obtener los champs.
- Ambas funciones guardan la respuesta en `data/ddragon/` como fallback local. Si la API falla, usa la data guardada anteriormente. Cuando llega una versión nueva, borra el archivo anterior automáticamente.
- Desde ahí se trabaja la data de la partida en tiempo real.

### Estrategia de data (items-signals):
- Si hay data local → la devuelve al toque sin esperar, y dispara un refresh en background para que la próxima vez tenga data fresca.
- Si no hay data local (primera vez) → espera el fetch completo desde el worker.
- Solo un refresh corre a la vez, si ya hay uno en progreso se ignoran los siguientes.

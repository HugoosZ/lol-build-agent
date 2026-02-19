1. Dado que voy a trabajar con API REST, para conocer una nueva tecnologia, utilizaré wrangler de cloudflare para así trabajar serverless.  Cloudflare a diferencia de Express, no se mantiene un server vivo, si no que se ejecuta por request.
    - npx wrangler init (npx para ejecutar paquetes)

Esta hardcodeada los signals de cada item y eliminado de manera manual todos los items repetidos. (En enero 31 2026 desde el item 8020)



API workers/ddragon:
Esta es la encargada de ser el middleware que permite extraer la data de ddragon y manejarla. La funcion principal es calcular los signals de cada item, los cuales seran los encargados de definir que tipo de item es cada uno para que la IA puede determinar item puede ser el adecuado para cada situacion.

Se actualizan los cambios desarrollados localmente mediante:
- npx wrangler deploy
Se define la API_KEY como:
- npx wrangler secret put GOOGLE_API_KEY

1. La ruta principal es ```/items-signals```. Esta es una ruta GET que retorna el json de los items procesados. Para ello, primero revisa en la DB de cloudflare si ya existe los items con sus respectivos signals, si nó procede a calcularlos mediante un agente que trabaja mediante gemini. Cabe destacar que por cada version donde hagan cambios en los items, se actualizará la DB de ddragon, por lo que recalculará los signals por cada version.
2. El flujo:
    - GET data de champs e items desde ddragon, 
    - Manejo de versiones de la data. Si el json de items con signals está desactualizado, se recalculan los signals.
    - Desde el local (main), se llama a la ruta items-signals, donde obtiene la data de los champs, items con signals y desde ahí se trabaja la data de la partida.

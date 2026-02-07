1. Dado que voy a trabajar con API REST, para conocer una nueva tecnologia, utilizaré wrangler de cloudflare para así trabajar serverless.  Cloudflare a diferencia de Express, no se mantiene un server vivo, si no que se ejecuta por request.
    - npx wrangler init (npx para ejecutar paquetes)
2. La primera ruta es ```/question```. Esta es una ruta POST que recibe el parametro question.
3. Con la API funcionando, la subí a cloudflare-> workers & pages, donde solo es necesario conectarlo con git. 
4. Para la creacion del agente

Esta hardcodeada los signals de cada item y eliminado de manera manual todos los items repetidos. (En enero 31 2026 desde el item 8020)
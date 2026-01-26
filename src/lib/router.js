import { json, parseBody } from "./json.js";

// Adapta el request de Node.js a un objeto compatible con la Web API Request
function createRequest(req) {
  const protocol = req.connection?.encrypted ? "https" : "http";
  const host = req.headers.host || "localhost";
  const url = `${protocol}://${host}${req.url}`;
  
  return {
    url,
    method: req.method,
    headers: req.headers,
    _nodeReq: req, // Guardamos referencia al request original para leer el body
  };
}

export async function route(nodeReq, env, ctx, routes) {
  const request = createRequest(nodeReq);
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = url.pathname;

  // Añadimos método json() al request para compatibilidad
  request.json = () => parseBody(request._nodeReq);

  for (const [m, p, handler] of routes) {
    if (m === method && p === path) {
      return handler(request, env, ctx, {});
    }
  }

  return json({ error: "Not Found" }, 404);
}
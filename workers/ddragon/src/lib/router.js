import { json } from "./json.js";

export async function route(request, env, ctx, routes) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const path = url.pathname;

  for (const [m, p, handler] of routes) {
    if (m === method && p === path) {
      return handler(request, env, ctx, {});
    }
  }

  return json({ error: "Not Found" }, 404);
}
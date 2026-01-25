import { json } from "../lib/json.js";

export async function handleHealth(_request, _env, _ctx) { // No se usa request, env ni ctx. Por eso el guion bajo.
  return json({ status: "ok" });
}
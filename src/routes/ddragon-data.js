import { json } from "../lib/json.js";
import { getDataFromLastVersion } from "../services/ddragon.js";

export async function handleDataFromDdragon(request, env, ctx) {
  try {
    const data = await getDataFromLastVersion();
    return json(data, 200);
  } catch (e) {
    return json({ error: "Could not fetch ddragon data", details: e?.message ?? String(e) }, 500);
  }
}

import { json } from "../lib/json.js";
import { getDataFromLastVersion, getItem } from "../services/ddragon.js";

export async function handleDataFromDdragon(request, env, ctx) {
  try {
    const data = await getDataFromLastVersion(env);
    return json(data, 200);
  } catch (e) {
    return json({ error: "Could not fetch ddragon data", details: e?.message ?? String(e) }, 500);
  }
}

export async function getChampsData(request, env, ctx) {
  try {
    const { champsData } = await getDataFromLastVersion(env);
    return json(champsData, 200);
  } catch (e) {
    return json({ error: "Could not fetch ddragon data", details: e?.message ?? String(e) }, 500);
  }
}

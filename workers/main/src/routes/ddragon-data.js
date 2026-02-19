import { json } from "../lib/json.js";
import { getDataFromLastVersion, getItem } from "../services/ddragon.js";

export async function handleDataFromDdragon(request, env, ctx) {
  try {
    const data = await getDataFromLastVersion();
    return json(data, 200);
  } catch (e) {
    return json({ error: "Could not fetch ddragon data", details: e?.message ?? String(e) }, 500);
  }
}
export async function handleItemFromDdragon(request, env, ctx) {
    try {
    const data = await getDataFromLastVersion();
    const sampleItem = getItem(data.itemsData, request.params.id); // Ejemplo de obtener un item específico
    return json(sampleItem, 200);
  } catch (e) {
    return json({ error: "Could not fetch ddragon data", details: e?.message ?? String(e) }, 500);
  }
}

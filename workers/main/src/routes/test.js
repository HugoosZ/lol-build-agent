import { json } from "../lib/json.js";
import { getMatchData } from "../services/match.js";
import { getAllItemsWithSignals } from "../services/ddragon.js";

const URL = "https://ddragon.hugo-rojas1.workers.dev/test"

export async function test(request, env, ctx) {
  const itemsData = await getAllItemsWithSignals(env);

  



  return json({ itemsData }, 200);
}

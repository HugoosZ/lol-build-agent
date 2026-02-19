import { json } from "../lib/json.js";
import { getDataFromLastVersion } from "../services/ddragon.js";
import { ItemCounter } from "../services/ddragon.js";

export async function test(_request, env, _ctx) {
  const { version: latestVersion } = await getDataFromLastVersion(env);
  console.log("Latest version from ddragon:", latestVersion);
  const itemCounter = await ItemCounter(env);
  console.log("Item counter:", itemCounter);

  return json({ status: "okei", itemCounter, latestVersion });
}
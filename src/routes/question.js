import { json } from "../lib/json.js";
import { getMatchData } from "../services/match.js";
import { normalizeMatch } from "../domain/match/normalizeMatch.js";
import { computeFocus } from "../domain/focus/computeFocus.js";
import { getDataFromLastVersion, getAllItemsWithSignals} from "../services/ddragon.js";
import { buildCompareItemsPrompt } from "../agent/promptBuilder.js";
import { buildChampFilters } from "../domain/ddragon/filterChamps.js";


export async function handleQuestion(request, env, ctx) {
  const body = await request.json().catch(() => ({}));

  const myRiotId = body.riotId ?? "Dressy#Dress";
  const laneOpponentChampion = body.laneOpponentChampion ?? null;
  const laneSupportChampion = body.laneSupportChampion ?? null;
  const requestedItems = body.requestedItems ?? [];

  let raw;
  try {
      raw = await getMatchData();               // Live API

  } catch (error) {
  return json({ error: "Could not fetch match data", details: error.message }, 500);
  }
  const state = normalizeMatch(raw, myRiotId);    // normalizado
  const itemsData = await getAllItemsWithSignals();
  
  
  const { champsData } = await getDataFromLastVersion();
  const focus = computeFocus(state, { laneOpponentChampion, laneSupportChampion, itemsData, champsData });

  const { stateWithChamps } = buildChampFilters(state, champsData);


  return json({ state: stateWithChamps, focus, itemsData}, 200);
}

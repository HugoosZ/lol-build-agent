import { json } from "../lib/json.js";
import { getMatchData } from "../services/match.js";
import { normalizeMatch } from "../domain/match/normalizeMatch.js";
import { computeFocus } from "../domain/focus/computeFocus.js";
import { computeGold } from "../domain/gold/computeGold.js";
import { getDataFromLastVersion, getAllItemsWithSignals} from "../services/ddragon.js";
import { askOpenAI } from "../agent/openia.js";
import { buildMatchBuyAndPlanPrompt } from "../agent/promptBuilder.js";
import { buildChampFilters } from "../domain/ddragon/filterChamps.js";
import { askGemma } from "../agent/gemma.js";

export async function handleRecommend(request, env, ctx) {
    const body = await request.json().catch(() => ({}));

    const laneOpponentChampion = body.laneOpponentChampion ?? null;
    const laneSupportChampion = body.laneSupportChampion ?? null;

    let raw;
    try {
        raw = await getMatchData();               // Live API

    } catch (error) {
    return json({ error: "Could not fetch match data", details: error.message }, 500);
    }
    const stateRaw = normalizeMatch(raw);    // normalizado
    const itemsData = await getAllItemsWithSignals();
    const { champsData } = await getDataFromLastVersion();
    
    // Enriquecer state con información de oro
    const state = computeGold(stateRaw, itemsData);
    
    const focus = computeFocus(state, { laneOpponentChampion, laneSupportChampion, itemsData, champsData });
    
    const { stateWithChamps } = buildChampFilters(state, champsData);
    
    let recommendation = "";
    try {
        const prompt = buildMatchBuyAndPlanPrompt({ state: stateWithChamps, focus, itemsData });
        recommendation = await askGemma(env, prompt, env.GOOGLE_MODEL_RECOMMEND);
    } catch (error) {
        return json({ error: "Could not fetch AI recommendation", details: error.message }, 500);
    }

    return json({ state: stateWithChamps, focus, itemsData, recommendation }, 200);
}

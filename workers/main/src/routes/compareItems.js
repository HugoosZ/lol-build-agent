import { json } from "../lib/json.js";
import { getMatchData } from "../services/match.js";
import { normalizeMatch } from "../domain/match/normalizeMatch.js";
import { computeFocus } from "../domain/focus/computeFocus.js";
import { computeGold } from "../domain/gold/computeGold.js";
import { getDataFromLastVersion, getAllItemsWithSignals} from "../services/ddragon.js";
import { askOpenAI } from "../agent/openia.js";
import { buildCompareItemsPrompt } from "../agent/promptBuilder.js";
import { buildChampFilters } from "../domain/ddragon/filterChamps.js";
import { askGemma } from "../agent/gemma.js";

export async function handleCompareItems(request, env, ctx) {
    const body = await request.json().catch(() => ({}));

    const laneOpponentChampion = body.laneOpponentChampion ?? null;
    const laneSupportChampion = body.laneSupportChampion ?? null;
    // Array de itemIds a comparar: ["3031", "3085", "3072"]
    const candidates = body.candidates ?? [];

    if (!Array.isArray(candidates) || candidates.length < 2) {
        return json({ error: "Debes enviar al menos 2 items en 'candidates' para comparar" }, 400);
    }

    let raw;
    try {
        raw = await getMatchData();               // Live API

    } catch (error) {
        return json({ error: "Could not fetch match data", details: error.message }, 500);
    }
    const stateRaw = normalizeMatch(raw);    // normalizado
    const itemsData = await getAllItemsWithSignals();
    const { champsData } = await getDataFromLastVersion();
    
    // Filtrar solo los items que se están comparando
    const filteredItemsData = Object.fromEntries(
        candidates
            .filter(id => itemsData[id])
            .map(id => [id, itemsData[id]])
    );
    
    // Enriquecer state con información de oro (usa itemsData completo para cálculos)
    const state = computeGold(stateRaw, itemsData);
    
    const focus = computeFocus(state, { laneOpponentChampion, laneSupportChampion, itemsData, champsData });

    const { stateWithChamps } = buildChampFilters(state, champsData);


    let recommendation = "";
    try {
        const prompt = buildCompareItemsPrompt({ state: stateWithChamps, focus, itemsData: filteredItemsData, candidates });
        recommendation = await askGemma(env, prompt, env.GOOGLE_MODEL_COMPARE);
    } catch (error) {
        return json({ error: "Could not fetch AI recommendation", details: error.message }, 500);
    }

    return json({ state: stateWithChamps, focus, itemsData, recommendation }, 200);
}

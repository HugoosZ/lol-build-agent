import { json } from "../lib/json.js";
import { getMatchData } from "../services/match.js";
import { normalizeMatch } from "../domain/match/normalizeMatch.js";
import { computeFocus } from "../domain/focus/computeFocus.js";
import { getDataFromLastVersion, getAllItemsWithSignals} from "../services/ddragon.js";
import { askOpenAI } from "../agent/openia.js";
import { specificRecommendPrompt } from "../agent/promptBuilder.js";

export async function handleRecommend(request, env, ctx) {
    const body = await request.json().catch(() => ({}));

    const myRiotId = body.riotId ?? "Dressy#Dress";
    const laneOpponentChampion = body.laneOpponentChampion ?? null;
    const laneSupportChampion = body.laneSupportChampion ?? null;

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

    let recommendation = "";
    try {
        const prompt = specificRecommendPrompt({ state, focus, itemsData, champsData });
        recommendation = await askOpenAI(env, prompt);
    } catch (error) {
        return json({ error: "Could not fetch AI recommendation", details: error.message }, 500);
    }

    return json({ state, focus, itemsData, champsData, recommendation }, 200);
}

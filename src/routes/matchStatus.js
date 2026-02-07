import { json } from "../lib/json.js";
import { getMatchData } from "../services/match.js";
import { normalizeMatch } from "../domain/match/normalizeMatch.js";
import { computeFocus } from "../domain/focus/computeFocus.js";
import { computeGold } from "../domain/gold/computeGold.js";
import { getDataFromLastVersion, getAllItemsWithSignals } from "../services/ddragon.js";
import { buildChampFilters } from "../domain/ddragon/filterChamps.js";

export async function handleMatchStatus(request, env, ctx) {
    let raw;
    try {
        raw = await getMatchData();
    } catch (error) {
        // No está en partida
        return json({ inGame: false }, 200);
    }

    try {
        const stateRaw = normalizeMatch(raw);
        const itemsData = await getAllItemsWithSignals();
        const { champsData } = await getDataFromLastVersion();
        
        // Enriquecer state con información de oro
        const state = computeGold(stateRaw, itemsData);
        
        const focus = computeFocus(state, { itemsData, champsData });
        const { stateWithChamps } = buildChampFilters(state, champsData);

        return json({
            inGame: true,
            state: stateWithChamps,
            focus,
            gameTime: raw?.gameData?.gameTime ?? null,
        }, 200);
    } catch (error) {
        return json({ inGame: false, error: error.message }, 200);
    }
}

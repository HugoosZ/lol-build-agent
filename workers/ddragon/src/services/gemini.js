import { askGemma } from "../agent/gemma.js";
import { buildItemsInsightsPrompt } from "../agent/promptBuilder.js";

const BATCH_SIZE = 15;
const MIN_INTERVAL_MS = 12_000;
const MAX_RPD = 20;

function chunkObject(obj, size) {
  const entries = Object.entries(obj);
  const chunks = [];
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(Object.fromEntries(entries.slice(i, i + size)));
  }
  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGeminiResponse(raw) {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  }
  return JSON.parse(cleaned);
}

/**
 * Extrae signals del parsed response, manejando multiples formatos:
 * 1. { signals: { id: {...} } }  — formato esperado
 * 2. { id: { tankiness: ... } }  — sin wrapper signals
 * 3. [ { id: "1001", ... } ]    — array
 * Retorna null si no puede extraer.
 */
function extractSignals(parsed, batchIds) {
  // Formato 1: { signals: { ... } }
  if (parsed?.signals && typeof parsed.signals === "object") {
    return parsed.signals;
  }

  // Formato 2: el objeto raiz tiene los IDs directamente
  const keys = Object.keys(parsed || {});
  if (keys.length > 0 && keys.some(k => batchIds.includes(k))) {
    // Verificar que los valores son objetos con signal keys
    const first = parsed[keys.find(k => batchIds.includes(k))];
    if (first && typeof first === "object" && ("tankiness" in first || "TANKINESS" in first || "physicalDps" in first)) {
      return parsed;
    }
  }

  // Formato 3: array de items con id
  if (Array.isArray(parsed)) {
    const result = {};
    for (const item of parsed) {
      if (item.id) {
        const { id, name, ...signals } = item;
        result[String(id)] = signals;
      }
    }
    if (Object.keys(result).length > 0) return result;
  }

  return null;
}

/**
 * Normaliza keys de signals a camelCase esperado.
 */
function normalizeSignalKeys(signals) {
  const keyMap = {
    "TANKINESS": "tankiness", "tankiness": "tankiness",
    "PHYSICAL DPS": "physicalDps", "PHYSICAL_DPS": "physicalDps", "physicalDps": "physicalDps", "physicaldps": "physicalDps",
    "BURST AD": "burstAd", "BURST_AD": "burstAd", "burstAd": "burstAd", "burstad": "burstAd",
    "BURST AP": "burstAp", "BURST_AP": "burstAp", "burstAp": "burstAp", "burstap": "burstAp",
    "ANTI-TANK": "antiTank", "ANTI_TANK": "antiTank", "antiTank": "antiTank", "antitank": "antiTank",
    "SUSTAIN": "sustain", "sustain": "sustain",
    "ANTIHEAL": "antiHeal", "ANTI-HEAL": "antiHeal", "ANTI_HEAL": "antiHeal", "antiHeal": "antiHeal", "antiheal": "antiHeal",
  };
  const normalized = {};
  for (const [id, values] of Object.entries(signals)) {
    const clean = {};
    for (const [k, v] of Object.entries(values)) {
      const mapped = keyMap[k];
      if (mapped) clean[mapped] = v;
    }
    // Solo incluir si tiene al menos una signal valida
    if (Object.keys(clean).length > 0) {
      normalized[id] = clean;
    }
  }
  return normalized;
}

/**
 * Calcula los signals de todos los items usando Gemini en lotes.
 * Guarda progreso parcial en KV para poder retomar si se corta.
 * El flujo se detiene naturalmente cuando Gemini devuelve 429.
 */
export async function computeSignalsInBatches(env, itemsData, version, writer = null) {
  const totalItems = Object.keys(itemsData).length;

  const log = async (msg) => {
    console.log(msg);
    if (writer) {
      await writer.write(new TextEncoder().encode(`data: ${msg}\n\n`));
    }
  };

  // --- Cargar progreso parcial previo ---
  const progressKey = `signals-progress-${version}`;
  await log(`[Signals] Buscando progreso en KV key: ${progressKey}`);
  const savedProgress = await env.DDRAGON_CACHE.get(progressKey, "json");
  const allSignals = savedProgress?.signals ?? {};
  const processedIds = new Set(Object.keys(allSignals));
  await log(`[Signals] Progreso cargado: ${processedIds.size} items guardados previamente`);

  // Filtrar solo los items que faltan
  const pendingItems = {};
  for (const [id, item] of Object.entries(itemsData)) {
    if (!processedIds.has(id)) {
      pendingItems[id] = item;
    }
  }

  const pendingCount = Object.keys(pendingItems).length;
  if (pendingCount === 0) {
    await log(`[Signals] Todos los ${totalItems} items ya tienen signals (progreso previo)`);
    return { allSignals, complete: true };
  }

  const batches = chunkObject(pendingItems, BATCH_SIZE);

  await log(`[Signals] ${pendingCount}/${totalItems} items pendientes, ${batches.length} lotes`);
  if (processedIds.size > 0) {
    await log(`[Signals] Retomando: ${processedIds.size} items ya guardados`);
  }

  let requestCount = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchIds = Object.keys(batch);

    await log(`[Signals] Lote ${i + 1}/${batches.length} - ${batchIds.length} items (${batchIds[0]}..${batchIds[batchIds.length - 1]})`);

    const { system, user } = buildItemsInsightsPrompt({ itemsBatch: batch });

    let raw;
    let elapsed;
    let success = false;

    try {
      const startTime = Date.now();
      requestCount++;

      raw = await askGemma(env, { system, user }, env.GOOGLE_MODEL_INSIGHT);

      elapsed = Date.now() - startTime;
      await log(`[Signals] Lote ${i + 1} OK en ${(elapsed / 1000).toFixed(1)}s (request #${requestCount})`);
      success = true;
    } catch (err) {
      const errMsg = err.message || "";
      await log(`[Signals] Lote ${i + 1} fallo: ${errMsg.slice(0, 200)}`);

      if (errMsg.includes("429")) {
        await log(`[Signals] RPD agotado (429). Guardando progreso.`);
        break;
      }
      // 524/503/otros: nada que guardar de este lote, seguir con el siguiente
      await log(`[Signals] Lote ${i + 1} sin datos — nada que guardar, sigo con el siguiente`);
    }

    if (success) {
      try {
        const parsed = parseGeminiResponse(raw);
        const extracted = extractSignals(parsed, batchIds);
        if (extracted) {
          const normalized = normalizeSignalKeys(extracted);
          const newCount = Object.keys(normalized).length;
          Object.assign(allSignals, normalized);
          const processed = Object.keys(allSignals).length;
          await log(`[Signals] Progreso: ${processed}/${totalItems} items (+${newCount} de este lote)`);
          await env.DDRAGON_CACHE.put(progressKey, JSON.stringify({ signals: allSignals }));
          await log(`[Signals] ✅ Guardado en KV: ${progressKey} (${processed} items)`);
        } else {
          const preview = raw.slice(0, 300).replace(/\n/g, ' ');
          await log(`[Signals] Lote ${i + 1}: respuesta OK pero formato no reconocido. Preview: ${preview}`);
        }
      } catch (parseErr) {
        const preview = raw.slice(0, 200).replace(/\n/g, ' ');
        await log(`[Signals] Error parseando lote ${i + 1}: ${parseErr.message}. Preview: ${preview}`);
      }
    }

    // Respetar RPM
    if (i < batches.length - 1) {
      const remaining = MIN_INTERVAL_MS - (elapsed ?? 0);
      if (remaining > 0) {
        await log(`[Signals] Esperando ${(remaining / 1000).toFixed(1)}s (rate limit)...`);
        await sleep(remaining);
      }
    }
  }

  const processedCount = Object.keys(allSignals).length;
  const complete = processedCount >= totalItems;

  if (complete) {
    await env.DDRAGON_CACHE.delete(progressKey);
    await log(`[Signals] COMPLETADO - ${processedCount}/${totalItems} items con signals (${requestCount} requests usados)`);
  } else {
    const remaining = totalItems - processedCount;
    const batchesLeft = Math.ceil(remaining / BATCH_SIZE);
    await log(`[Signals] PARCIAL - ${processedCount}/${totalItems} items (faltan ${remaining}, ${batchesLeft} lotes, ${requestCount} requests usados)`);
  }

  return { allSignals, complete };
}

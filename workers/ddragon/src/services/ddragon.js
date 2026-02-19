import { normalizeChamps } from "../domain/ddragon/normalizeChamp.js";
import { normalizeItems } from "../domain/ddragon/normalizeItems.js";
import { computeSignalsInBatches } from "./gemini.js";

const VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";

const DEFAULT_SIGNALS = {
  tankiness: 0,
  physicalDps: 0,
  burstAp: 0,
  burstAd: 0,
  sustain: 0,
  antiTank: 0,
  antiHeal: 0,
};

/**
 * Fingerprint de un item para comparar entre versiones.
 * Solo los campos que afectan el cálculo de signals.
 */
function itemFingerprint(item) {
  return JSON.stringify({
    description: item.description,
    stats: item.stats,
    cost: item.cost,
    tags: item.tags,
    from: item.from,
  });
}

export async function getLatestVersion(url = VERSIONS_URL) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} fetching ${url}: ${text}`);
  }

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`Unexpected versions payload from ${url}`);
  }

  return data[0];
}

export async function getDataFromLastVersion(env) {
  
  const version = await getLatestVersion();

  const cachedItems = await env.DDRAGON_CACHE.get(`items-${version}`, "json");
  if (cachedItems) return cachedItems;
  const cachedChamps = await env.DDRAGON_CACHE.get(`champs-${version}`, "json");
  if (cachedChamps) return cachedChamps;

  const previousVersion = await env.DDRAGON_CACHE.get("latest-version");
  if (previousVersion && previousVersion !== version) {
    await env.DDRAGON_CACHE.delete(`items-${previousVersion}`);
    await env.DDRAGON_CACHE.delete(`champs-${previousVersion}`);
    await env.DDRAGON_CACHE.delete("latest-version");
  }

  const itemsURL = `https://ddragon.leagueoflegends.com/cdn/${version}/data/es_ES/item.json`;
  const champsURL = `https://ddragon.leagueoflegends.com/cdn/${version}/data/es_ES/champion.json`;

  const [itemsRes, champsRes] = await Promise.all([
    fetch(itemsURL),
    fetch(champsURL),
  ]);

  if (!itemsRes.ok) {
    const text = await itemsRes.text().catch(() => "");
    throw new Error(`HTTP ${itemsRes.status} fetching items: ${text}`);
  }
  if (!champsRes.ok) {
    const text = await champsRes.text().catch(() => "");
    throw new Error(`HTTP ${champsRes.status} fetching champions: ${text}`);
  }

  const [itemsData, champsData] = await Promise.all([
    itemsRes.json(),
    champsRes.json(),
  ]);

  const normalizedItems = normalizeItems(itemsData.data);
  const normalizedChamps = normalizeChamps(champsData.data);

  const resultChamps = { version, champsData: normalizedChamps };
  const resultItems = { version, itemsData: normalizedItems };
  
  await env.DDRAGON_CACHE.put(`items-${version}`, JSON.stringify(resultItems));
  await env.DDRAGON_CACHE.put(`champs-${version}`, JSON.stringify(resultChamps));
  await env.DDRAGON_CACHE.put("latest-version", version);

  return { version, itemsData: normalizedItems, champsData: normalizedChamps };
}

export function getItem(itemsData, itemId) {
  return itemsData?.[String(itemId)] ?? null;
}

export async function ItemCounter(env) {

  const { itemsData } = await getDataFromLastVersion(env);
  const itemCount = Object.keys(itemsData).length;
  return { count: itemCount };
}

export async function getItemsWithSignals(env, writer = null) {
  const { version, itemsData } = await getDataFromLastVersion(env);

  const log = async (msg) => {
    console.log(msg);
    if (writer) {
      await writer.write(new TextEncoder().encode(`data: ${msg}\n\n`));
    }
  };

  // 1. Cache hit → devolver inmediatamente
  const cacheKey = `items-${version}.with-signals`;
  const cached = await env.DDRAGON_CACHE.get(cacheKey, "json");
  if (cached) {
    console.log(`[Signals] Cache hit para ${cacheKey}`);
    return { cached: true, data: cached };
  }

  // 2. Si no hay progreso para esta versión, intentar heredar de la anterior
  const progressKey = `signals-progress-${version}`;
  const existingProgress = await env.DDRAGON_CACHE.get(progressKey, "json");

  if (!existingProgress) {
    const previousVersion = await env.DDRAGON_CACHE.get("latest-signals-version");
    if (previousVersion && previousVersion !== version) {
      const prevCacheKey = `items-${previousVersion}.with-signals`;
      const prevData = await env.DDRAGON_CACHE.get(prevCacheKey, "json");

      if (prevData) {
        const carried = {};
        let carriedCount = 0;
        let changedCount = 0;
        let newCount = 0;
        let removedCount = 0;

        for (const [id, newItem] of Object.entries(itemsData)) {
          const oldItem = prevData[id];
          if (!oldItem) {
            newCount++;
            continue;
          }
          if (itemFingerprint(oldItem) === itemFingerprint(newItem)) {
            carried[id] = oldItem.signals;
            carriedCount++;
          } else {
            changedCount++;
          }
        }

        for (const id of Object.keys(prevData)) {
          if (!itemsData[id]) removedCount++;
        }

        await log(`[Signals] Migración v${previousVersion} → v${version}: ${carriedCount} heredados, ${changedCount} modificados, ${newCount} nuevos, ${removedCount} eliminados`);

        if (carriedCount > 0) {
          await env.DDRAGON_CACHE.put(progressKey, JSON.stringify({ signals: carried }));
          const toCompute = changedCount + newCount;
          await log(`[Signals] ${carriedCount} signals heredados → solo falta calcular ${toCompute} items`);
        }
      }
    }
  }

  // 3. Calcular signals (retoma automáticamente desde progreso, incluidos los heredados)
  await log(`[Signals] Calculando signals para versión ${version}...`);
  const { allSignals, complete } = await computeSignalsInBatches(env, itemsData, version, writer);

  // 4. Combinar: item original + signals calculados
  const result = {};
  for (const [id, item] of Object.entries(itemsData)) {
    result[id] = {
      ...item,
      signals: allSignals[id] ?? DEFAULT_SIGNALS,
    };
  }

  // 5. Solo guardar en cache final si TODOS los items fueron procesados
  if (complete) {
    await env.DDRAGON_CACHE.put(cacheKey, JSON.stringify(result));

    // Limpiar versión anterior
    const previousVersion = await env.DDRAGON_CACHE.get("latest-signals-version");
    if (previousVersion && previousVersion !== version) {
      await env.DDRAGON_CACHE.delete(`items-${previousVersion}.with-signals`);
    }
    await env.DDRAGON_CACHE.put("latest-signals-version", version);
  }

  return { cached: false, data: result, complete };
}

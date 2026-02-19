import { saveJson } from "../utils/fs.js";
import { extractVersionFromPath, fileExists, loadJson, findLatestFile, cleanOldFiles } from "../utils/fs.js";

const URLItems_Signals = "https://ddragon.hugo-rojas1.workers.dev/items-signals"
const URLChamps = "https://ddragon.hugo-rojas1.workers.dev/champs-data"

// Estado interno: se usa para no disparar múltiples refreshes a la vez
let _refreshingSignals = false;


export async function getDataFromLastVersion() {
  try {
    const champsRes = await fetch(URLChamps);

    if (!champsRes.ok) {
      throw new Error(`HTTP ${champsRes.status}`);
    }

    const champsDataFetch = await champsRes.json();
    const champsData = champsDataFetch?.champsData;
    const version = champsDataFetch?.version;

    const champsPath = `data/ddragon/champs-${version}.json`;
    await saveJson(champsPath, champsData);
    await cleanOldFiles("data/ddragon", "champs-", `champs-${version}.json`);

    return { status: "fetched", version, champsData };
  } catch (err) {
    console.warn(`[ddragon] API falló: ${err.message}. Buscando data local...`);

    const localPath = await findLatestFile("data/ddragon", "champs-");
    if (localPath) {
      const champsData = await loadJson(localPath);
      const version = extractVersionFromPath(localPath);
      console.log(`[ddragon] Usando data local: ${localPath}`);
      return { status: "loaded", version, champsData };
    }

    throw new Error(`API no disponible y no hay data local: ${err.message}`);
  }
}


/**
 * Fetch items-signals desde el worker ddragon (SSE), parsea y guarda local.
 * Retorna la data o null si falla.
 */
async function fetchAndSaveSignals() {
  // Obtener version para nombrar el archivo
  const { version } = await getDataFromLastVersion();
  const itemsPath = `data/ddragon/items.with-signals-${version}.json`;

  const res = await fetch(URLItems_Signals);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const text = await res.text();

  const lines = text.split("\n");
  let jsonStr = null;
  let foundMarker = false;

  for (const line of lines) {
    if (foundMarker && line.startsWith("data: ")) {
      jsonStr = line.slice(6);
      break;
    }
    if (line.includes("---RESULT---")) {
      foundMarker = true;
    }
  }

  if (!jsonStr) {
    throw new Error("No se encontró JSON en la respuesta de items-signals");
  }

  const data = JSON.parse(jsonStr);
  await saveJson(itemsPath, data);
  await cleanOldFiles("data/ddragon", "items.with-signals-", `items.with-signals-${version}.json`);
  return data;
}


/**
 * Devuelve items con signals.
 * Siempre intenta devolver data local primero (instantáneo).
 * Si no hay local, hace el fetch bloqueante.
 * Si hay local, dispara un refresh en background para la próxima vez.
 */
export async function getAllItemsWithSignals() {
  const localPath = await findLatestFile("data/ddragon", "items.with-signals-");
  const local = localPath ? await loadJson(localPath).catch(() => null) : null;

  if (local) {
    // Hay data local → devolver inmediatamente, refrescar en background
    refreshSignalsInBackground();
    return local;
  }

  // No hay data local → toca esperar el fetch
  console.log(`[ddragon] Sin data local de items-signals, esperando fetch...`);
  try {
    return await fetchAndSaveSignals();
  } catch (err) {
    throw new Error(`API no disponible y no hay data local: ${err.message}`);
  }
}


/**
 * Dispara el refresh de signals en background (no bloquea).
 * Si ya hay uno corriendo, no hace nada.
 */
export function refreshSignalsInBackground() {
  if (_refreshingSignals) return;
  _refreshingSignals = true;

  console.log(`[ddragon] Refresh de items-signals en background...`);

  fetchAndSaveSignals()
    .then(() => console.log(`[ddragon] items-signals actualizados en background`))
    .catch((err) => console.warn(`[ddragon] Refresh background falló: ${err.message}`))
    .finally(() => { _refreshingSignals = false; });
}


export function getItem(itemsData, itemId) {
  return itemsData?.[String(itemId)] ?? null;
}

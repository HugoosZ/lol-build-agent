import { saveJson } from "../utils/fs.js";
import { extractVersionFromPath, fileExists, loadJson, findLatestFile, cleanOldFiles } from "../utils/fs.js";

const URLItems_Signals = "https://ddragon.hugo-rojas1.workers.dev/items-signals"
const URLChamps = "https://ddragon.hugo-rojas1.workers.dev/champs-data"


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


export async function getAllItemsWithSignals() {
  const itemsPath = `data/ddragon/items.with-signals.json`;

  try {
    // 1. Fetch desde el worker ddragon (SSE stream)
    const res = await fetch(URLItems_Signals);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();

    // El stream tiene formato: data: [logs]\n\n ... data: ---RESULT---\n\n data: {json}\n\n
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

    // Guardar local para fallback futuro
    await saveJson(itemsPath, data);
    await cleanOldFiles("data/ddragon", "items.with-signals", "items.with-signals.json");

    return data;
  } catch (err) {
    console.warn(`[ddragon] items-signals API falló: ${err.message}. Buscando data local...`);

    const local = await loadJson(itemsPath).catch(() => null);
    if (local) {
      console.log(`[ddragon] Usando items-signals local: ${itemsPath}`);
      return local;
    }

    throw new Error(`API no disponible y no hay data local: ${err.message}`);
  }
}


export function getItem(itemsData, itemId) {
  return itemsData?.[String(itemId)] ?? null;
}

import { saveJson } from "../utils/fs.js";
import { normalizeChamps } from "../domain/ddragon/normalizeChamp.js";
import { normalizeItems } from "../domain/ddragon/normalizeItems.js";
import { extractVersionFromPath, fileExists, loadJson } from "../utils/fs.js";

const URL = "https://ddragon.leagueoflegends.com/api/versions.json";

export async function getLastestVersion(url = URL) {
  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`Could not fetch versions from ${url}: ${e?.message ?? e}`);
  }

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

export async function getDataFromLastVersion(version) {
  if (!version) {
    version = await getLastestVersion();
  }
  
  const itemsPath = `data/ddragon/items-${version}.json`;
  const champsPath = `data/ddragon/champs-${version}.json`;
  
  if (await fileExists(itemsPath) && await fileExists(champsPath)) {
    const itemsData = await loadJson(itemsPath);
    const champsData = await loadJson(champsPath);
    return { status: "loaded" , version, itemsData, champsData};
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

  await saveJson(itemsPath, normalizedItems);
  await saveJson(champsPath, normalizedChamps);

  return { status: "fetched", version, itemsData: normalizedItems, champsData: normalizedChamps };
}


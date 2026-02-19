import fs from "node:fs/promises";

export async function saveJson(path, data) {
  await fs.mkdir(path.split("/").slice(0, -1).join("/"), { recursive: true });
  await fs.writeFile(path, JSON.stringify(data, null, 2), "utf-8");
}

export async function loadJson(path) {
  const raw = await fs.readFile(path, "utf-8");
  return JSON.parse(raw);
}


// Verifica si un archivo existe
export async function fileExists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

// Extrae la versión de un path como "data/ddragon/items-16.2.1.json"
export function extractVersionFromPath(path) {
  const filename = path.split("/").pop(); // "items-16.2.1.json"
  return filename.replace(/^(items|champs)-/, "").replace(".json", "");
}
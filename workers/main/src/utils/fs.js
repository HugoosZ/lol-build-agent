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

/**
 * Busca el archivo más reciente en un directorio que matchee un prefijo.
 * Ej: findLatestFile("data/ddragon", "champs-") → "data/ddragon/champs-16.3.1.json"
 */
export async function findLatestFile(dir, prefix) {
  try {
    const files = await fs.readdir(dir);
    const matches = files
      .filter(f => f.startsWith(prefix) && f.endsWith(".json"))
      .sort()
      .reverse();
    return matches.length > 0 ? `${dir}/${matches[0]}` : null;
  } catch {
    return null;
  }
}

/**
 * Borra archivos anteriores en un directorio que matcheen un prefijo,
 * excepto el archivo que se quiere conservar.
 * Ej: cleanOldFiles("data/ddragon", "champs-", "champs-16.4.json")
 *     → borra champs-16.3.json si existe
 */
export async function cleanOldFiles(dir, prefix, keepFilename) {
  try {
    const files = await fs.readdir(dir);
    const toDelete = files.filter(
      f => f.startsWith(prefix) && f.endsWith(".json") && f !== keepFilename
    );
    for (const f of toDelete) {
      await fs.unlink(`${dir}/${f}`);
      console.log(`[cleanup] Borrado: ${dir}/${f}`);
    }
  } catch {
    // no-op si el directorio no existe
  }
}
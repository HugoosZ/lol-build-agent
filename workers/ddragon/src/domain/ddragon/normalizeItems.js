export function normalizeItems(rawItems) {
  const itemsById = {};
  const seenNames = {};  // name → { id, mapCount }

  for (const [id, item] of Object.entries(rawItems)) {
    // Solo Summoner's Rift (map 11) e items comprables.
    if (!item.maps?.["11"]) continue;
    if (item.gold?.purchasable === false) continue;

    const name = item.name.toLowerCase().trim();
    const mapCount = Object.values(item.maps).filter(Boolean).length;

    // Si ya existe un item con el mismo nombre, quedarse con el de más mapas
    if (seenNames[name]) {
      const prev = seenNames[name];
      if (mapCount <= prev.mapCount) continue; // el anterior es mejor, saltar
      delete itemsById[prev.id]; // el nuevo es mejor, borrar el anterior
    }

    seenNames[name] = { id, mapCount };

    itemsById[id] = {
      id,
      name: item.name,
      description: item.description,
      cost: item.gold?.total ?? 0,
      from: item.from ?? [],
      into: item.into ?? [],
      tags: item.tags ?? [],
      stats: item.stats ?? {},
      depth: item.depth ?? 0,
    };
  }

  return itemsById;
}

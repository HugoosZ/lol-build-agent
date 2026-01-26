export function normalizeItems(rawItems) {
  const itemsById = {};

  for (const [id, item] of Object.entries(rawItems)) {
    // Solo Summoner's Rift (map 11) e items comprables.
    if (!item.maps?.["11"]) continue;
    if (item.gold?.purchasable === false) continue;

    itemsById[id] = {
      id,
      name: item.name,
      short: item.plaintext ?? "",
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

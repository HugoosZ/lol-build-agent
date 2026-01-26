
export function normalizeChamps(rawChamps) {
  const champsById = {};

  for (const champ of Object.values(rawChamps)) {
    champsById[champ.id] = {
      id: champ.id,
      key: champ.key,
      name: champ.name,
      tags: champ.tags ?? [],
      resource: champ.partype ?? "",
      stats: champ.stats ?? {},
    };
  }

  return champsById;
}

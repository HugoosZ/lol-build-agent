export function buildChampFilters(state, champsData) {
  const championNames = [
    state?.me?.champion,
    ...(state?.allies ?? []).map(p => p?.champion),
    ...(state?.enemies ?? []).map(p => p?.champion),
  ].filter(Boolean);

  const champsById = champsData ?? {};
  const champsByName = Object.values(champsById).reduce((acc, champ) => {
    const key = String(champ?.name ?? "").toLowerCase();
    if (key) acc[key] = champ;
    return acc;
  }, {});

  const pickChamp = (name) => {
    const byId = champsById?.[name];
    const byName = champsByName?.[String(name).toLowerCase()];
    return byId ?? byName ?? null;
  };

  const toChampMap = (names) => names.reduce((acc, name) => {
    const champ = pickChamp(name);
    if (champ?.id) acc[champ.id] = champ;
    return acc;
  }, {});

  const filteredChampsData = {
    allies: toChampMap((state?.allies ?? []).map(p => p?.champion).filter(Boolean)),
    enemies: toChampMap((state?.enemies ?? []).map(p => p?.champion).filter(Boolean)),
    me: toChampMap([state?.me?.champion].filter(Boolean)),
  };

  const attachChampData = (player) => {
    if (!player?.champion) return player;
    const champ = pickChamp(player.champion);
    if (!champ) return { ...player, champData: null };
    const { id, name, key, stats, ...rest } = champ;
    const champData = {
      ...rest,
      initial_stats: stats ?? null,
    };
    return { ...player, champData };
  };

  const stateWithChamps = {
    ...state,
    me: attachChampData(state?.me ?? null),
    allies: (state?.allies ?? []).map(attachChampData),
    enemies: (state?.enemies ?? []).map(attachChampData),
  };

  return {
    championNames,
    filteredChampsData,
    stateWithChamps,
  };
}
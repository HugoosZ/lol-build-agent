function parseRiotId(riotId) {
  // "Dressy#Dress" -> { gameName: "Dressy", tagLine: "Dress" }
  const [gameName, tagLine] = String(riotId || "").split("#");
  return { gameName, tagLine };
}

function playerRiotId(p) {
  // intenta definir un riotId completo, si no, riotId o el summonerName
  if (p.riotIdGameName && p.riotIdTagLine) return `${p.riotIdGameName}#${p.riotIdTagLine}`;
  if (p.riotId) return p.riotId;
  if (p.summonerName) return p.summonerName;
  return "";
}

function extractItemIds(items) {
  // Live API suele venir como [{ itemID: 3031, ... }]
  if (!Array.isArray(items)) return [];
  return items
    .map(i => i?.itemID ?? i?.itemId ?? i?.id)
    .filter(x => x != null)
    .map(String);
}

function pickStats(stats = {}) {
  // Quédate con lo que sirve para itemización / amenazas
  return {
    armor: stats.armor,
    magicResist: stats.magicResist,
    maxHealth: stats.maxHealth,
    currentHealth: stats.currentHealth,
    attackDamage: stats.attackDamage,
    abilityPower: stats.abilityPower,
    attackSpeed: stats.attackSpeed,
    critChance: stats.critChance,
    lifeSteal: stats.lifeSteal,
    moveSpeed: stats.moveSpeed,
    // si existen:
    armorPenetration: stats.armorPenetration,
    magicPenetration: stats.magicPenetration,


  };
}

export function normalizeMatch(raw) {
  const all = Array.isArray(raw?.allPlayers) ? raw.allPlayers : [];
  const ap = raw?.activePlayer;

  // Auto-detectar riotId desde activePlayer
  const myRiotId = ap?.riotId 
    ?? (ap?.riotIdGameName && ap?.riotIdTagLine ? `${ap.riotIdGameName}#${ap.riotIdTagLine}` : null)
    ?? ap?.summonerName
    ?? "Unknown";

  const myId = parseRiotId(myRiotId);

  const meFromAll = all.find(p => {
    const rid = playerRiotId(p);
    // match por riotId completo o por summonerName fallback
    if (rid.includes("#") && myId.gameName && myId.tagLine) return rid === `${myId.gameName}#${myId.tagLine}`;
    return rid === myRiotId; // si usas summonerName
  });

  // Decide "me" preferentemente desde allPlayers (para tener team), y completa con activePlayer
  const me = {
    riotId: myRiotId,
    team: meFromAll?.team ?? ap?.team ?? null,
    champion: meFromAll?.championName ?? ap?.championName ?? null,
    level: meFromAll?.level ?? ap?.level ?? null,
    gold: ap?.currentGold ?? ap?.gold ?? null,
    items: extractItemIds(ap?.items ?? meFromAll?.items),
    stats: pickStats(ap?.championStats ?? ap?.stats ?? meFromAll?.stats ?? {}),
    // opcional si existe:
    position: meFromAll?.position ?? null,
  };

  const players = all.map(p => ({
    riotId: playerRiotId(p),
    team: p.team,
    champion: p.championName,
    level: p.level,
    position: p.position ?? null,
    items: extractItemIds(p.items),

    // scores para "fedness"
    scores: {
      kills: p.scores?.kills ?? 0,
      deaths: p.scores?.deaths ?? 0,
      assists: p.scores?.assists ?? 0,
      creepScore: p.scores?.creepScore ?? 0,
    },

    // summoner spells para amenazas/estilo
    summonerSpells: {
      summonerSpellOne: p.summonerSpells?.summonerSpellOne?.displayName ?? null,
      summonerSpellTwo: p.summonerSpells?.summonerSpellTwo?.displayName ?? null,
    },

    // runas 
    runes: p.runes ?? null,

  }));

  const allies = me.team ? players.filter(p => p.team === me.team && p.riotId !== me.riotId) : [];
  const enemies = me.team ? players.filter(p => p.team !== me.team) : [];

  return {
    me,
    allies,
    enemies,
    match: {
      mapId: raw?.mapId ?? 11,
      gameTimeSeconds: raw?.gameData?.gameTime ?? null,
    }
  };
}

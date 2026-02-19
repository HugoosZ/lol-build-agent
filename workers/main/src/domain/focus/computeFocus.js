import { getPhase } from "../phase/getPhase.js";

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Items que NO deberían contar para “perfil”:
 * - ward trinket (3340)
 * - control ward (3364)
 * - pociones (2003)
 * - consumibles / cosas sin costo (regla general)
 */
function isNoiseItem(itemsData, itemId) {
  const id = String(itemId);

  // hard rules (muy estables)
  if (id === "3340") return true; // Warding Totem
  if (id === "3364") return true; // Oracle Lens / Control Ward según modo
  if (id === "2003") return true; // Health Potion

  const it = itemsData?.[id];
  if (!it) return true;

  // regla general
  if (safeNum(it.cost) === 0) return true;

  return false;
}

function pickItemIdsForProfile(itemsData, itemIds = []) {
  if (!Array.isArray(itemIds)) return [];
  return itemIds.filter((id) => !isNoiseItem(itemsData, id));
}

/**
 * Suma signals de items.
 * - tankiness: usamos MAX (no promedio) para no “aplastar” tanques con items neutros
 * - resto: promedio (suave) para no inflar solo por cantidad
 */
function computeItemProfile(itemsData, itemIds = []) {
  const ids = pickItemIdsForProfile(itemsData, itemIds);

  const acc = {
    tankiness: 0,
    physicalDps: 0,
    burstAp: 0,
    burstAd: 0,
    sustain: 0,
    antiTank: 0,
    antiHeal: 0,
  };

  let count = 0;
  let maxTank = 0;

  for (const id of ids) {
    const it = itemsData?.[String(id)];
    const s = it?.signals;
    if (!s) continue;

    maxTank = Math.max(maxTank, safeNum(s.tankiness));

    acc.physicalDps += safeNum(s.physicalDps);
    acc.burstAp += safeNum(s.burstAp);
    acc.burstAd += safeNum(s.burstAd);
    acc.sustain += safeNum(s.sustain);
    acc.antiTank += safeNum(s.antiTank);
    acc.antiHeal += safeNum(s.antiHeal);

    count += 1;
  }

  if (count > 0) {
    acc.physicalDps /= count;
    acc.burstAp /= count;
    acc.burstAd /= count;
    acc.sustain /= count;
    acc.antiTank /= count;
    acc.antiHeal /= count;
  }

  acc.tankiness = maxTank;

  // clamp final
  for (const k of Object.keys(acc)) acc[k] = clamp01(acc[k]);

  return { profile: acc, usedItemIds: ids, usedCount: count };
}

/**
 * Base profile por champion tags (si tienes champsData).
 * Esto evita el caso “Braum sin items tanque => no parece tank”.
 */
function baseProfileFromChampion(champsData, championName) {
  const tags = champsData?.[championName]?.tags ?? [];
  const has = (t) => Array.isArray(tags) && tags.includes(t);

  const base = {
    tankiness: has("Tank") ? 0.70 : has("Fighter") ? 0.40 : 0.10,
    physicalDps: has("Marksman") ? 0.65 : has("Fighter") ? 0.35 : 0.10,
    burstAp: has("Mage") ? 0.60 : 0.0,
    burstAd: has("Assassin") ? 0.60 : 0.0,
    sustain: has("Fighter") ? 0.25 : has("Support") ? 0.20 : 0.05,
    antiTank: 0.10,
    antiHeal: 0.05,
  };

  for (const k of Object.keys(base)) base[k] = clamp01(base[k]);
  return base;
}

/**
 * Fusión base+items.
 * Early (pocos items): manda base.
 * Mid/Late: manda items.
 */
function fuseProfiles(base, itemProfile, usedCount) {
  const c = safeNum(usedCount);

  // pesos por cantidad de items "reales"
  const wItems = c <= 0 ? 0.00 : c === 1 ? 0.35 : c === 2 ? 0.55 : 0.75;
  const wBase = 1 - wItems;

  const out = {};
  for (const k of Object.keys(base)) {
    out[k] = clamp01(wBase * safeNum(base[k]) + wItems * safeNum(itemProfile[k]));
  }

  // tankiness: conserva el MAX de items si supera al prior
  out.tankiness = clamp01(Math.max(out.tankiness, safeNum(itemProfile.tankiness)));

  return out;
}

/**
 * Lane opponent por position (TOP vs TOP, MID vs MID, etc.)
 */
function autoLaneOpponentChampion(state) {
  const myPos = state?.me?.position ?? null;
  if (!myPos) return null;
  const opp = state?.enemies?.find((e) => e.position === myPos);
  return opp?.champion ?? null;
}

function clampFedBoost(scores) {
  const k = safeNum(scores?.kills);
  const d = safeNum(scores?.deaths);
  const a = safeNum(scores?.assists);

  // simple: (kills + 0.5*assists) - deaths
  const raw = (k + 0.5 * a) - d;

  // mapea aprox a 0..1
  // 0 => 0.0, 3 => 0.35, 6 => 0.7, 9+ => 1
  return clamp01(raw / 9);
}

function roleLike(profile) {
  // devuelve 1-2 etiquetas (nunca vacío)
  const entries = Object.entries(profile)
    .filter(([k]) => ["tankiness", "physicalDps", "burstAp", "burstAd", "sustain"].includes(k))
    .sort((a, b) => b[1] - a[1]);

  const top = entries[0];
  const second = entries[1];

  if (!top || top[1] < 0.15) return ["unknown"];
  if (second && second[1] >= top[1] * 0.75 && second[1] >= 0.15) return [top[0], second[0]];
  return [top[0]];
}

function buildVsScore(enemy, phase, laneBoost, fedBoost) {
  // build vs: tanques + sustain + fed
  let s = 0.18;

  s += safeNum(enemy.profile.tankiness) * (phase === "early" ? 0.25 : 0.40);
  s += safeNum(enemy.profile.sustain) * 0.20;

  // si el enemigo está fedeado, más prioridad de itemizar defensivo / counter
  s += fedBoost * 0.22;

  // lane boost fuerte early
  s += laneBoost * (phase === "early" ? 0.40 : 0.15);

  return clamp01(s);
}

function targetScore(enemy, phase, laneBoost, fedBoost) {
  // target: carries squishy y/o fed
  const carry = clamp01(
    0.60 * safeNum(enemy.profile.physicalDps) +
    0.60 * safeNum(enemy.profile.burstAp) +
    0.60 * safeNum(enemy.profile.burstAd)
  );
  const squishy = clamp01(1 - safeNum(enemy.profile.tankiness));

  let s = 0.15;
  s += carry * (phase === "early" ? 0.35 : 0.55);
  s += squishy * 0.30;

  // matar al fed puede ser objetivo
  s += fedBoost * 0.25;

  // lane boost early
  s += laneBoost * (phase === "early" ? 0.35 : 0.10);

  // penaliza tanques
  s -= safeNum(enemy.profile.tankiness) * (phase === "late" ? 0.10 : 0.20);

  return clamp01(s);
}

function threatScore(me, enemy, phase, fedBoost) {
  // amenaza: burst+carry + fed
  const burst = clamp01(safeNum(enemy.profile.burstAp) + safeNum(enemy.profile.burstAd));
  const dps = safeNum(enemy.profile.physicalDps);

  let s = 0.22;
  s += (phase === "early" ? 0.55 : 0.75) * burst;
  s += (phase === "early" ? 0.25 : 0.35) * dps;

  s += fedBoost * 0.25;

  // si tú eres muy squishy por stats reales (sí los tienes en activePlayer)
  const myHP = safeNum(me?.stats?.maxHealth);
  const myArmor = safeNum(me?.stats?.armor);
  const myMR = safeNum(me?.stats?.magicResist);
  const squishyMe = (myHP > 0 && myHP < 2300) && (myArmor < 110) && (myMR < 90);
  if (squishyMe) s += 0.08;

  return clamp01(s);
}

export function computeFocus(state, opts = {}) {
  const { me, enemies, match } = state;
  const phase = getPhase(match?.gameTimeSeconds);

  const itemsData = opts.itemsData ?? null;
  if (!itemsData) throw new Error("computeFocus: opts.itemsData is required");

  const champsData = opts.champsData ?? null;

  const laneOpponentChampion =
    opts.laneOpponentChampion ?? autoLaneOpponentChampion(state);

  const laneSupportChampion = opts.laneSupportChampion ?? null;

  const laneFocus = [];
  if (laneOpponentChampion) laneFocus.push({ champion: laneOpponentChampion, reason: "laneOpponent" });
  if (laneSupportChampion) laneFocus.push({ champion: laneSupportChampion, reason: "laneSupport" });

  const scored = enemies.map((e) => {
    const base = champsData ? baseProfileFromChampion(champsData, e.champion) : {
      tankiness: 0.10, physicalDps: 0.10, burstAp: 0, burstAd: 0, sustain: 0.05, antiTank: 0.10, antiHeal: 0.05
    };

    const { profile: itemProfile, usedItemIds, usedCount } = computeItemProfile(itemsData, e.items ?? []);
    const profile = fuseProfiles(base, itemProfile, usedCount);

    const fedBoost = clampFedBoost(e.scores);

    let laneBoost = 0;
    if (laneOpponentChampion && e.champion === laneOpponentChampion) {
      laneBoost = phase === "early" ? 0.55 : phase === "mid" ? 0.30 : 0.15;
    }

    const build = buildVsScore({ profile }, phase, laneBoost, fedBoost);
    const targ = targetScore({ profile }, phase, laneBoost, fedBoost);
    const thr = threatScore(me, { profile }, phase, fedBoost);

    return {
      champion: e.champion,
      position: e.position ?? null,

      roleLike: roleLike(profile),
      profile,

      buildScore: build,
      targetScore: targ,
      threatScore: thr,

      // debugging útil
      items: e.items,
      usedItemIds,
      usedCount,
      fedBoost,

      tanky: profile.tankiness >= 0.45, // umbral más realista early/mid
    };
  });

  const buildVs = [...scored].sort((a, b) => b.buildScore - a.buildScore).slice(0, 5);
  const target = [...scored].sort((a, b) => b.targetScore - a.targetScore).slice(0, 5);
  const threats = [...scored].sort((a, b) => b.threatScore - a.threatScore).slice(0, 5);

  return { phase, laneFocus, buildVs, target, threats };
}

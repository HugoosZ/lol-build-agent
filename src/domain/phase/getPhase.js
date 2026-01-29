export function getPhase(gameTimeSeconds) {
  const t = Number(gameTimeSeconds ?? 0);
  if (t < 900) return "early";     // < 15 min
  if (t < 1800) return "mid";      // 15-30
  return "late";
}

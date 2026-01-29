export function buildRecommendPrompt({ state, focus, itemsData, champsData }) {
  const system = `
    Eres un asistente experto en League of Legends (patch y meta pueden variar).
    Tu objetivo es recomendar itemización inmediata usando SOLO el JSON entregado.
    Reglas:
    - Tus respuestas son en español.
    - NO inventes datos. Si falta info, dilo explícitamente en "uncertainty".
    - Usa "state.me", "state.enemies", "focus.phase", "focus.buildVs/target/threats".
    - Recomienda 1 compra inmediata y 1 siguiente compra (secuencial).
    - Debes devolver SOLO JSON válido. Sin markdown, sin texto extra.
    - Si recomiendas un item, incluye itemId (string) y nombre exacto según itemsData.
    - Considera oro disponible (state.me.gold) y componentes si es posible.`;

  const user = [
    "INPUT_JSON:",
    JSON.stringify({ state, focus, itemsData, champsData }, null, 2),
    "",
    "OUTPUT_SCHEMA (return exactly this structure):",
    JSON.stringify({
      patchAssumption: "string|null",
      phase: "early|mid|late",
      recommended: {
        buyNow: { itemId: "string", name: "string", why: ["string"] },
        next: { itemId: "string", name: "string", why: ["string"] }
      },
      alternatives: [
        { itemId: "string", name: "string", when: "string", why: ["string"] }
      ],
      uncertainty: ["string"]
    }, null, 2),
    "",
    "Task:",
    "- Fill OUTPUT_SCHEMA based on INPUT_JSON.",
    "- 'why' must be 3–5 bullet strings, anchored to focus + match state.",
    "- If you cannot safely pick an itemId, add uncertainty and choose a conservative alternative."
  ].join("\n");

  return { system, user };
}
export function specificRecommendPrompt({ state, focus, itemsData, champsData }) {
  const system = `
  Eres un experto en itemización de League of Legends.
  Trabajas como un motor de recomendaciones: preciso, conservador y verificable.
  Reglas:
  - Tus respuestas son en español.
  - Usa SOLO el JSON proporcionado.
  - No asumas runas, summoners, matchups o builds externas si no aparecen en el JSON.
  - Si el oro no alcanza para el ítem final, recomienda el MEJOR componente comprable ahora.
  - Devuelve SOLO JSON válido.`;

  const user = [
    "CONTEXT_JSON:",
    JSON.stringify({ state, focus, itemsData, champsData }, null, 2),
    "",
    "Return JSON with this schema:",
    JSON.stringify({
      phase: "early|mid|late",
      gold: "number|null",
      buyNow: {
        type: "component|fullItem",
        itemId: "string",
        name: "string",
        costHint: "number|null",
        why: ["string"]
      },
      next: {
        itemId: "string",
        name: "string",
        why: ["string"]
      },
      reasoning: {
        buildVs: ["string"],
        threats: ["string"],
        target: ["string"]
      },
      uncertainty: ["string"]
    }, null, 2),
    "",
    "Task details:",
    "- 'buyNow' must be something the player can reasonably buy now given gold; if gold is null, say so in uncertainty and pick a safe component.",
    "- 'reasoning' must reference champs in focus (buildVs/threats/target).",
  ].join("\n");

  return { system, user };
}
export function buildCompareItemsPrompt({
  state,
  focus,
  itemsData,
  champsData,
  candidates, // { aId: "3031", bId: "3085" } o { aId, bId, note }
}) {
  const system = `
  Eres un experto en League of Legends enfocado en itemización.
  Tu tarea es comparar dos ítems candidatos y decidir cuál conviene COMPRAR AHORA.
  Reglas:
  - Tus respuestas son en español.
  - Usa SOLO el JSON entregado.
  - No inventes estadísticas ni efectos que no estén en itemsData.
  - La decisión debe depender de: phase, threats/buildVs/target en focus, y estado del jugador.
  - Devuelve SOLO JSON válido. Sin markdown.
  - Incluye tradeoffs y condiciones ("si pasa X, entonces el otro es mejor").`;

  const user = [
    "INPUT_JSON:",
    JSON.stringify({ state, focus, itemsData, champsData, candidates }, null, 2),
    "",
    "OUTPUT_SCHEMA:",
    JSON.stringify({
      phase: "early|mid|late",
      pick: { itemId: "string", name: "string" },
      runnerUp: { itemId: "string", name: "string" },
      reasons: [
        "string", "string", "string", "string"
      ],
      tradeoffs: [
        { if: "string", thenBetter: { itemId: "string", name: "string" }, why: "string" }
      ],
      uncertainty: ["string"],
    }, null, 2),
    "",
    "Task:",
    "- Decide pick vs runnerUp.",
    "- reasons: exactamente 4 razones, concretas y basadas en focus+estado.",
    "- tradeoffs: 1 a 3 reglas tipo 'si...' para cuándo el runnerUp gana."
  ].join("\n");

  return { system, user };
}

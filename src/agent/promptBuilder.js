export function buildMatchBuyAndPlanPrompt({ state, focus, itemsData }) {
  const system = `
Eres un experto en League of Legends (itemización + macro).

Debes recomendar:
- BUY NOW TOP 3: cada opción es un ÍTEM COMPLETO objetivo (ej: Cortasendas),
  y además debes indicar qué COMPONENTE comprar AHORA para avanzar hacia ese ítem.
- NEXT BUY TOP 3: objetivos de ítems completos para los próximos recalls.
- Consejo macro según si voy ahead/even/behind.

Reglas estrictas:
- Responde en español.
- Usa SOLO el JSON entregado (state, focus, itemsData).
- NO inventes campeones, stats, efectos, ítems ni nombres.
- Cada itemId que devuelvas DEBE existir como clave en itemsData.
- NO recomiendes ítems de inicio (Doran items, support starters).
- Devuelve SOLO JSON válido (sin markdown, sin \`\`\`).

Definiciones (usa itemsData):
- Ítem COMPLETO/FINAL: itemsData[itemId].into es vacío ([]), null o no existe.
- COMPONENTE: ítem que aparece en itemsData[targetItemId].from.

BUY NOW TOP 3:
- Son alternativas (NO se compran juntas).
- targetItem debe ser ÍTEM COMPLETO/FINAL (no componente).
- firstComponentNow debe:
  - estar en itemsData[targetItemId].from
  - ser comprable con state.me.gold
  - NO estar ya en state.me.items
- Si para un targetItem no existe ningún componente comprable ahora, NO lo elijas como buyNow.

NEXT BUY TOP 3:
- Son ÍTEMS COMPLETOS/FINALES.
- buildPath:
  - debe usar SOLO componentes de itemsData[itemId].from
  - si no puedes inferir con certeza, buildPath = [] y buildPathConfidence = "low".

Estado de partida:
- Si faltan datos para decidir ahead/even/behind, usa "even" y explícitalo en gameStateEvidence.note.
`;

  const user = [
    "CONTEXT_JSON:",
    JSON.stringify({ state, focus, itemsData }, null, 2),
    "",
    "OUTPUT_SCHEMA:",
    JSON.stringify({
      phase: "early|mid|late",
      myChampion: "string",
      detectedEnemiesUsed: ["string"],

      gameStateTag: "ahead|even|behind",
      gameStateEvidence: {
        goldDiff: "number|null",
        csDiff: "number|null",
        levelDiff: "number|null",
        note: "string"
      },

      buyNowTop3: [
        {
          rank: 1,
          targetItem: { itemId: "string", name: "string" },
          firstComponentNow: { itemId: "string", name: "string", cost: 0 },
          whyTarget: "string",
          whyFirstComponent: "string",
          whenToChoose: "string"
        }
      ],

      nextBuyTop3: [
        {
          rank: 1,
          itemId: "string",
          name: "string",
          whyNext: "string",
          buildPath: [{ step: 1, itemId: "string", name: "string", cost: 0 }],
          buildPathConfidence: "high|medium|low"
        }
      ],

      playAdvice: {
        winCondition: "string",
        ifAhead: ["string"],
        ifEven: ["string"],
        ifBehind: ["string"]
      },

      farmPlan: {
        csStatus: "good|ok|bad|unknown",
        actions: ["string"],
        avoid: ["string"]
      },

      uncertainty: ["string"]
    }, null, 2),
    "",
    "Task:",
    "- buyNowTop3: EXACTAMENTE 3 opciones, ranks 1..3.",
    "- En buyNowTop3: targetItem.itemId debe ser FINAL (itemsData[targetItem.itemId].into vacío/no existe).",
    "- En buyNowTop3: firstComponentNow.itemId debe estar en itemsData[targetItem.itemId].from y cost <= state.me.gold.",
    "- En buyNowTop3: si un targetItem no tiene componente comprable ahora, descártalo.",
    "- nextBuyTop3: EXACTAMENTE 3 objetivos (ítems finales).",
    "- detectedEnemiesUsed: lista enemigos EXACTOS desde state.enemies (no inventes)."
  ].join("\n");

  return { system, user };
}


export function buildCompareItemsPrompt({
  state,
  focus,
  itemsData,
  candidates, // array de itemIds: ["3031", "3085", "3072", ...]
}) {
  const system = `
  Eres un experto en League of Legends enfocado en itemización.
  Tu tarea es comparar N ítems candidatos y decidir cuál es el MEJOR para comprar ahora.
  Reglas:
  - Tus respuestas son en español.
  - Usa SOLO el JSON entregado.
  - No inventes estadísticas ni efectos que no estén en itemsData.
  - Solo considera ítems completos/finales, no componentes.
  - La decisión debe depender de: phase, threats/buildVs/target en focus, y estado del jugador.
  - Devuelve SOLO JSON válido. Sin markdown.
  - Explica detalladamente por qué el ítem elegido es mejor que los demás.`;

  const user = [
    "INPUT_JSON:",
    JSON.stringify({ state, focus, itemsData, candidates }, null, 2),
    "",
    "OUTPUT_SCHEMA:",
    JSON.stringify({
      phase: "early|mid|late",
      myChampion: "string",
      candidatesAnalyzed: [
        { itemId: "string", name: "string", prosForThisMatch: ["string"], consForThisMatch: ["string"] }
      ],
      recommendation: {
        itemId: "string",
        name: "string",
        explanation: "string (explicación detallada de por qué este ítem es el mejor de todos los comparados)"
      },
      alternativeOrder: [
        { rank: 2, itemId: "string", name: "string", whenBetter: "string" }
      ],
      uncertainty: ["string"]
    }, null, 2),
    "",
    "Task:",
    "- Analiza cada ítem en 'candidates' y llena 'candidatesAnalyzed' con pros/cons específicos para esta partida.",
    "- Elige el mejor y ponlo en 'recommendation' con explicación detallada.",
    "- En 'alternativeOrder' ordena los demás ítems del segundo mejor al peor, indicando cuándo serían mejor opción."
  ].join("\n");

  return { system, user };
}

/**
 * Calcula el oro gastado en items para cada jugador y el oro total por equipo.
 * 
 * Para "me": tiene oro exacto disponible (currentGold) + oro gastado en items
 * Para otros jugadores: solo podemos estimar oro gastado basado en sus items
 */

/**
 * Calcula el oro total gastado en items de un jugador
 * @param {string[]} itemIds - Array de itemIds del jugador
 * @param {Object} itemsData - Diccionario de items { id: { cost, ... } }
 * @returns {number} Oro total gastado en items
 */
function calcItemsGold(itemIds, itemsData) {
  if (!Array.isArray(itemIds) || !itemsData) return 0;
  
  return itemIds.reduce((total, itemId) => {
    const item = itemsData[String(itemId)];
    return total + (item?.cost ?? 0);
  }, 0);
}

/**
 * Añade información de oro a un jugador
 * @param {Object} player - Datos del jugador
 * @param {Object} itemsData - Diccionario de items
 * @param {boolean} isMe - Si es el jugador principal (tiene currentGold)
 * @returns {Object} Jugador con goldInfo añadido
 */
function enrichPlayerWithGold(player, itemsData, isMe = false) {
  const spentGold = calcItemsGold(player.items, itemsData);
  
  const goldInfo = {
    spentGold,           // Oro gastado en items
    estimatedTotal: spentGold, // Por defecto, solo sabemos lo gastado
  };

  if (isMe && player.gold != null) {
    goldInfo.currentGold = player.gold;  // Oro disponible ahora
    goldInfo.estimatedTotal = spentGold + player.gold; // Total = gastado + disponible
  }

  return {
    ...player,
    goldInfo,
  };
}

/**
 * Calcula el oro total de un equipo
 * @param {Object[]} players - Array de jugadores con goldInfo
 * @returns {Object} Resumen del oro del equipo
 */
function calcTeamGold(players) {
  const totalSpent = players.reduce((sum, p) => sum + (p.goldInfo?.spentGold ?? 0), 0);
  const avgSpent = players.length > 0 ? Math.round(totalSpent / players.length) : 0;
  
  return {
    totalSpentGold: totalSpent,
    avgSpentGold: avgSpent,
    playerCount: players.length,
  };
}

/**
 * Enriquece el state con información de oro para todos los jugadores
 * @param {Object} state - Estado normalizado { me, allies, enemies, match }
 * @param {Object} itemsData - Diccionario de items
 * @returns {Object} State con goldInfo añadido a cada jugador y teamGold
 */
export function computeGold(state, itemsData) {
  if (!state || !itemsData) return state;

  // Enriquecer cada jugador con su goldInfo
  const me = enrichPlayerWithGold(state.me, itemsData, true);
  const allies = state.allies.map(p => enrichPlayerWithGold(p, itemsData));
  const enemies = state.enemies.map(p => enrichPlayerWithGold(p, itemsData));

  // Calcular oro total por equipo (incluyendo a "me" en aliados)
  const allAllies = [me, ...allies];
  const myTeamGold = calcTeamGold(allAllies);
  const enemyTeamGold = calcTeamGold(enemies);

  // Diferencial de oro entre equipos
  const goldDiff = myTeamGold.totalSpentGold - enemyTeamGold.totalSpentGold;

  return {
    ...state,
    me,
    allies,
    enemies,
    goldAnalysis: {
      myTeam: myTeamGold,
      enemyTeam: enemyTeamGold,
      goldDiff,                     // Positivo = vamos adelante en oro
      goldAdvantage: goldDiff > 500 ? 'ahead' : goldDiff < -500 ? 'behind' : 'even',
    },
  };
}

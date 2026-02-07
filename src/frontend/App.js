const { useMemo, useState, useEffect, useCallback } = React;

// Versión por defecto, se actualizará dinámicamente desde el backend
const DEFAULT_DDRAGON_VERSION = "14.24.1";

const getItemImageUrl = (itemId, version) =>
	`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`;
const getChampImageUrl = (champName, version, champNameMap) => {
	// Buscar el id de DDragon en el mapa (name -> id)
	const ddragonId = champNameMap[champName] || champName;
	return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${ddragonId}.png`;
};

// Función para parsear el string de recommendation que viene con markdown
function parseRecommendation(recommendationStr) {
	if (!recommendationStr) return null;
	if (typeof recommendationStr === "object") return recommendationStr;
	
	try {
		// Quitar los marcadores de markdown ```json y ```
		let cleaned = recommendationStr.trim();
		if (cleaned.startsWith("```json")) {
			cleaned = cleaned.slice(7);
		} else if (cleaned.startsWith("```")) {
			cleaned = cleaned.slice(3);
		}
		if (cleaned.endsWith("```")) {
			cleaned = cleaned.slice(0, -3);
		}
		return JSON.parse(cleaned.trim());
	} catch (e) {
		console.error("Error parsing recommendation:", e);
		return null;
	}
}

// Helpers para localStorage
const STORAGE_KEYS = {
	RECOMMENDATION: "lol-build-recommendation",
	COMPARE_RESULT: "lol-build-compare",
	SELECTED_ITEMS: "lol-build-selected-items",
};

function loadFromStorage(key) {
	try {
		const stored = localStorage.getItem(key);
		return stored ? JSON.parse(stored) : null;
	} catch {
		return null;
	}
}

function saveToStorage(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// localStorage lleno o no disponible
	}
}

function App() {
	const [activeTab, setActiveTab] = useState("recommend"); // "recommend" | "compare"
	const [laneOpponentChampion, setLaneOpponentChampion] = useState("");
	const [laneSupportChampion, setLaneSupportChampion] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [data, setData] = useState(() => loadFromStorage(STORAGE_KEYS.RECOMMENDATION));
	const [notInGame, setNotInGame] = useState(true);

	// Estado de la partida en vivo
	const [matchData, setMatchData] = useState(null);
	const [checkingMatch, setCheckingMatch] = useState(true);

	// Para comparar items
	const [allItems, setAllItems] = useState({});
	const [selectedItems, setSelectedItems] = useState(() => loadFromStorage(STORAGE_KEYS.SELECTED_ITEMS) || []);
	const [searchQuery, setSearchQuery] = useState("");
	const [compareResult, setCompareResult] = useState(() => loadFromStorage(STORAGE_KEYS.COMPARE_RESULT));
	
	// Versión de DDragon (se obtiene del backend)
	const [ddragonVersion, setDdragonVersion] = useState(DEFAULT_DDRAGON_VERSION);
	
	// Mapa de nombres de campeones (name -> id para DDragon)
	const [champNameMap, setChampNameMap] = useState({});

	// Info del jugador detectada
	const playerInfo = matchData?.state?.me || data?.state?.me;
	const isAdc = playerInfo?.position === "ADC" || playerInfo?.position === "BOTTOM";

	// Función para verificar estado de partida
	const checkMatchStatus = useCallback(async () => {
		try {
			const response = await fetch("/match-status");
			const result = await response.json();
			
			if (result.inGame) {
				setMatchData(result);
				setNotInGame(false);
			} else {
				setMatchData(null);
				setNotInGame(true);
			}
		} catch (err) {
			setMatchData(null);
			setNotInGame(true);
		} finally {
			setCheckingMatch(false);
		}
	}, []);

	// Polling cada 5 segundos para detectar partida
	useEffect(() => {
		checkMatchStatus(); // Check inicial
		const interval = setInterval(checkMatchStatus, 5000);
		return () => clearInterval(interval);
	}, [checkMatchStatus]);

	// Persistir datos en localStorage cuando cambien
	useEffect(() => {
		if (data) saveToStorage(STORAGE_KEYS.RECOMMENDATION, data);
	}, [data]);

	useEffect(() => {
		if (compareResult) saveToStorage(STORAGE_KEYS.COMPARE_RESULT, compareResult);
	}, [compareResult]);

	useEffect(() => {
		if (selectedItems.length > 0) {
			saveToStorage(STORAGE_KEYS.SELECTED_ITEMS, selectedItems);
		}
	}, [selectedItems]);

	// Cargar items disponibles al montar
	useEffect(() => {
		fetch("/ddragon-data")
			.then((res) => res.json())
			.then((result) => {
				// Guardar versión de DDragon
				if (result.version) {
					setDdragonVersion(result.version);
				}
				
				// Construir mapa de nombres de campeones (name -> id)
				// Ej: "Wukong" -> "MonkeyKing", "Lee Sin" -> "LeeSin"
				if (result.champsData) {
					const nameMap = {};
					for (const [id, champ] of Object.entries(result.champsData)) {
						// id es el nombre para DDragon (ej: "MonkeyKing")
						// champ.name es el nombre visible (ej: "Wukong")
						if (champ.name && champ.name !== id) {
							nameMap[champ.name] = id;
						}
					}
					setChampNameMap(nameMap);
				}
				
				if (result.itemsData) {
					// Filtrar items completos y botas
					const completeItems = Object.entries(result.itemsData).reduce(
						(acc, [id, item]) => {
							const isComplete =
								!item.into || item.into.length === 0 || (item.depth && item.depth >= 3);
							const isBoots = item.tags?.includes("Boots");
							// Incluir items completos >= 800g O botas mejoradas
							if ((isComplete && item.cost >= 800) || (isBoots && item.cost >= 300)) {
								acc[id] = item;
							}
							return acc;
						},
						{}
					);
					setAllItems(completeItems);
				}
			})
			.catch(() => {});
	}, []);

	// Helpers con versión dinámica
	const itemImg = (itemId) => getItemImageUrl(itemId, ddragonVersion);
	const champImg = (champName) => getChampImageUrl(champName, ddragonVersion, champNameMap);

	// Separar items normales y botas
	const { normalItems, bootsItems } = useMemo(() => {
		const normal = [];
		const boots = [];
		
		Object.entries(allItems).forEach(([id, item]) => {
			const isBoots = item.tags?.includes("Boots");
			if (isBoots) {
				boots.push([id, item]);
			} else {
				normal.push([id, item]);
			}
		});
		
		return { normalItems: normal, bootsItems: boots };
	}, [allItems]);

	const filteredNormalItems = useMemo(() => {
		if (!searchQuery.trim()) return normalItems;
		const q = searchQuery.toLowerCase();
		return normalItems.filter(([id, item]) =>
			item.name.toLowerCase().includes(q)
		);
	}, [normalItems, searchQuery]);

	const filteredBootsItems = useMemo(() => {
		if (!searchQuery.trim()) return bootsItems;
		const q = searchQuery.toLowerCase();
		return bootsItems.filter(([id, item]) =>
			item.name.toLowerCase().includes(q)
		);
	}, [bootsItems, searchQuery]);

	const toggleItemSelection = (itemId) => {
		setSelectedItems((prev) =>
			prev.includes(itemId)
				? prev.filter((id) => id !== itemId)
				: [...prev, itemId]
		);
	};

	const handleRecommend = async (event) => {
		event.preventDefault();
		setError("");
		setData(null);
		setNotInGame(false);

		const payload = {
			laneOpponentChampion: laneOpponentChampion.trim() || null,
			laneSupportChampion: laneSupportChampion.trim() || null,
		};

		try {
			setLoading(true);
			const response = await fetch("/recommend", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const result = await response.json().catch(() => ({}));
				if (
					result.error?.includes("match data") ||
					result.details?.includes("ECONNREFUSED")
				) {
					setNotInGame(true);
					return;
				}
				throw new Error(result.error || "Error en la solicitud.");
			}

			const result = await response.json();
			setData(result);
		} catch (err) {
			if (err.message?.includes("ECONNREFUSED") || err.message?.includes("fetch")) {
				setNotInGame(true);
			} else {
				setError(err.message || "Algo salió mal.");
			}
		} finally {
			setLoading(false);
		}
	};

	const handleCompare = async () => {
		if (selectedItems.length < 2) {
			setError("Selecciona al menos 2 items para comparar.");
			return;
		}

		setError("");
		setCompareResult(null);
		setNotInGame(false);

		const payload = {
			laneOpponentChampion: laneOpponentChampion.trim() || null,
			laneSupportChampion: laneSupportChampion.trim() || null,
			candidates: selectedItems,
		};

		try {
			setLoading(true);
			const response = await fetch("/compare", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const result = await response.json().catch(() => ({}));
				console.error("Compare error:", result);
				if (
					result.error?.includes("match data") ||
					result.details?.includes("ECONNREFUSED")
				) {
					setNotInGame(true);
					setError("No se pudo conectar con la partida. Asegúrate de estar en una partida activa.");
					return;
				}
				throw new Error(result.error || result.details || "Error en la solicitud.");
			}

			const result = await response.json();
			setCompareResult(result);
		} catch (err) {
			console.error("Compare catch error:", err);
			setError(err.message || "Algo salió mal.");
		} finally {
			setLoading(false);
		}
	};

	// Parsear la recommendation (viene como string con markdown)
	const parsedRecommendation = useMemo(() => {
		return parseRecommendation(data?.recommendation);
	}, [data?.recommendation]);

	const buyNowTop3 = parsedRecommendation?.buyNowTop3 || [];
	const nextBuyTop3 = parsedRecommendation?.nextBuyTop3 || [];
	const playAdvice = parsedRecommendation?.playAdvice;
	const gameStateTag = parsedRecommendation?.gameStateTag;

	return (
		<div className="app">
			<style>{`
				* { box-sizing: border-box; }
				.app {
					font-family: "Inter", "Segoe UI", sans-serif;
					max-width: 1100px;
					margin: 24px auto;
					padding: 24px;
					color: #e4e8f0;
					background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
					border-radius: 16px;
					box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
				}
				.header {
					display: flex;
					align-items: center;
					gap: 16px;
					margin-bottom: 24px;
				}
				.header h1 {
					font-size: 28px;
					font-weight: 700;
					margin: 0;
					background: linear-gradient(90deg, #60a5fa, #a78bfa);
					-webkit-background-clip: text;
					-webkit-text-fill-color: transparent;
				}
				.tabs {
					display: flex;
					gap: 8px;
					margin-bottom: 20px;
				}
				.tab {
					padding: 12px 24px;
					border-radius: 10px;
					border: none;
					cursor: pointer;
					font-weight: 600;
					font-size: 14px;
					transition: all 0.2s ease;
					background: #21262d;
					color: #8b949e;
				}
				.tab:hover { background: #30363d; }
				.tab.active {
					background: linear-gradient(135deg, #2563eb, #7c3aed);
					color: white;
				}
				.config-section {
					background: #161b22;
					border-radius: 12px;
					padding: 20px;
					margin-bottom: 20px;
					border: 1px solid #30363d;
				}
				.config-section h3 {
					margin: 0 0 16px;
					font-size: 14px;
					color: #8b949e;
					text-transform: uppercase;
					letter-spacing: 0.5px;
				}
				.form-grid {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
					gap: 16px;
				}
				.field {
					display: flex;
					flex-direction: column;
					gap: 6px;
				}
				.field label {
					font-size: 12px;
					color: #8b949e;
					font-weight: 500;
				}
				.field input, .field select {
					padding: 12px 14px;
					border-radius: 8px;
					border: 1px solid #30363d;
					background: #0d1117;
					color: #e4e8f0;
					font-size: 14px;
					transition: border-color 0.2s;
				}
				.field input:focus, .field select:focus {
					outline: none;
					border-color: #2563eb;
				}
				.button {
					padding: 12px 24px;
					border-radius: 10px;
					border: none;
					font-weight: 600;
					font-size: 14px;
					cursor: pointer;
					transition: all 0.2s;
					background: linear-gradient(135deg, #2563eb, #7c3aed);
					color: white;
				}
				.button:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3); }
				.button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
				.error {
					padding: 14px 16px;
					background: rgba(239, 68, 68, 0.1);
					border: 1px solid rgba(239, 68, 68, 0.3);
					border-radius: 10px;
					color: #f87171;
					margin-bottom: 16px;
				}
				.not-in-game {
					text-align: center;
					padding: 60px 20px;
					background: #161b22;
					border-radius: 12px;
					border: 1px solid #30363d;
				}
				.not-in-game .icon {
					font-size: 48px;
					margin-bottom: 16px;
				}
				.not-in-game h2 {
					margin: 0 0 8px;
					font-size: 20px;
					color: #f0883e;
				}
				.not-in-game p {
					margin: 0;
					color: #8b949e;
				}
				.player-info {
					display: flex;
					align-items: center;
					gap: 16px;
					padding: 16px;
					background: rgba(37, 99, 235, 0.1);
					border: 1px solid rgba(37, 99, 235, 0.3);
					border-radius: 10px;
					margin-bottom: 20px;
				}
				.player-info .avatar {
					width: 48px;
					height: 48px;
					border-radius: 50%;
					border: 2px solid #2563eb;
				}
				.player-info .details {
					flex: 1;
				}
				.player-info .name {
					font-weight: 600;
					font-size: 16px;
					color: #e4e8f0;
				}
				.player-info .meta {
					font-size: 13px;
					color: #8b949e;
					margin-top: 2px;
				}
				.match-panel {
					background: #161b22;
					border-radius: 12px;
					padding: 20px;
					border: 1px solid #30363d;
					margin-bottom: 20px;
				}
				.match-panel h3 {
					margin: 0 0 16px;
					font-size: 16px;
					display: flex;
					align-items: center;
					gap: 8px;
				}
				.match-panel .live-badge {
					background: #22c55e;
					color: #000;
					padding: 2px 8px;
					border-radius: 10px;
					font-size: 11px;
					font-weight: 700;
					animation: pulse 2s infinite;
				}
				@keyframes pulse {
					0%, 100% { opacity: 1; }
					50% { opacity: 0.6; }
				}
				.match-panel .game-time {
					font-size: 13px;
					color: #8b949e;
					margin-left: auto;
				}
				.teams-container {
					display: grid;
					grid-template-columns: 1fr 1fr;
					gap: 16px;
				}
				.team-section h4 {
					margin: 0 0 12px;
					font-size: 13px;
					color: #8b949e;
					text-transform: uppercase;
					letter-spacing: 0.5px;
				}
				.team-section.allies h4 { color: #4ade80; }
				.team-section.enemies h4 { color: #f87171; }
				.player-row {
					display: flex;
					align-items: center;
					gap: 10px;
					padding: 8px;
					background: #0d1117;
					border-radius: 8px;
					margin-bottom: 6px;
				}
				.player-row.me {
					border: 1px solid #2563eb;
					background: rgba(37, 99, 235, 0.1);
				}
				.player-row img {
					width: 32px;
					height: 32px;
					border-radius: 6px;
				}
				.player-row .player-name {
					flex: 1;
					font-size: 13px;
					color: #e4e8f0;
				}
				.player-row .player-level {
					font-size: 11px;
					color: #8b949e;
					background: #21262d;
					padding: 2px 6px;
					border-radius: 4px;
				}
				.results-section {
					background: #161b22;
					border-radius: 12px;
					padding: 24px;
					border: 1px solid #30363d;
					margin-top: 20px;
				}
				.results-section h3 {
					margin: 0 0 20px;
					font-size: 18px;
					display: flex;
					align-items: center;
					gap: 10px;
				}
				.top5-grid {
					display: flex;
					flex-direction: column;
					gap: 16px;
				}
				.item-recommend-card {
					display: flex;
					gap: 16px;
					padding: 16px;
					background: #0d1117;
					border-radius: 12px;
					border: 1px solid #30363d;
					transition: all 0.2s;
				}
				.item-recommend-card:hover {
					border-color: #2563eb;
				}
				.item-rank {
					width: 36px;
					height: 36px;
					border-radius: 50%;
					display: flex;
					align-items: center;
					justify-content: center;
					font-weight: 700;
					font-size: 16px;
					flex-shrink: 0;
				}
				.rank-1 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #000; }
				.rank-2 { background: linear-gradient(135deg, #9ca3af, #6b7280); color: #fff; }
				.rank-3 { background: linear-gradient(135deg, #cd7f32, #b45309); color: #fff; }
				.rank-4, .rank-5 { background: #30363d; color: #8b949e; }
				.item-image {
					width: 64px;
					height: 64px;
					border-radius: 8px;
					border: 2px solid #30363d;
					flex-shrink: 0;
				}
				.item-info { flex: 1; }
				.item-name {
					font-weight: 600;
					font-size: 16px;
					margin-bottom: 6px;
					color: #e4e8f0;
				}
				.item-explanation {
					font-size: 14px;
					color: #8b949e;
					line-height: 1.5;
				}
				.strategy-box {
					margin-top: 20px;
					padding: 16px;
					background: rgba(37, 99, 235, 0.1);
					border: 1px solid rgba(37, 99, 235, 0.3);
					border-radius: 10px;
				}
				.strategy-box h4 {
					margin: 0 0 8px;
					font-size: 14px;
					color: #60a5fa;
				}
				.strategy-box p {
					margin: 0;
					font-size: 14px;
					color: #e4e8f0;
					line-height: 1.5;
				}
				/* Compare Tab */
				.search-bar {
					margin-bottom: 16px;
				}
				.search-bar input {
					width: 100%;
					padding: 12px 16px;
					border-radius: 10px;
					border: 1px solid #30363d;
					background: #0d1117;
					color: #e4e8f0;
					font-size: 14px;
				}
				.search-bar input:focus {
					outline: none;
					border-color: #2563eb;
				}
				.items-grid {
					display: grid;
					grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
					gap: 10px;
					max-height: 400px;
					overflow-y: auto;
					padding: 4px;
				}
				.items-grid::-webkit-scrollbar {
					width: 8px;
				}
				.items-grid::-webkit-scrollbar-track {
					background: #0d1117;
					border-radius: 4px;
				}
				.items-grid::-webkit-scrollbar-thumb {
					background: #30363d;
					border-radius: 4px;
				}
				.item-select-card {
					display: flex;
					flex-direction: column;
					align-items: center;
					padding: 8px;
					background: #0d1117;
					border-radius: 10px;
					border: 2px solid #30363d;
					cursor: pointer;
					transition: all 0.2s;
				}
				.item-select-card:hover {
					border-color: #8b949e;
				}
				.item-select-card.selected {
					border-color: #2563eb;
					background: rgba(37, 99, 235, 0.1);
				}
				.item-select-card img {
					width: 48px;
					height: 48px;
					border-radius: 6px;
				}
				.item-select-card span {
					margin-top: 6px;
					font-size: 10px;
					color: #8b949e;
					text-align: center;
					line-height: 1.2;
					max-width: 100%;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}
				.selected-items-bar {
					display: flex;
					flex-wrap: wrap;
					gap: 8px;
					padding: 16px;
					background: #0d1117;
					border-radius: 10px;
					margin-bottom: 16px;
					min-height: 60px;
					align-items: center;
					border: 1px solid #30363d;
				}
				.selected-item-chip {
					display: flex;
					align-items: center;
					gap: 8px;
					padding: 6px 10px;
					background: #21262d;
					border-radius: 8px;
					font-size: 12px;
				}
				.selected-item-chip img {
					width: 28px;
					height: 28px;
					border-radius: 4px;
				}
				.selected-item-chip button {
					background: none;
					border: none;
					color: #f87171;
					cursor: pointer;
					font-size: 16px;
					padding: 0;
					line-height: 1;
				}
				.empty-selection {
					color: #8b949e;
					font-size: 14px;
				}
				.compare-actions {
					display: flex;
					justify-content: flex-end;
					margin-top: 16px;
				}
				.compare-result {
					margin-top: 20px;
				}
				.winner-card {
					display: flex;
					gap: 20px;
					padding: 20px;
					background: linear-gradient(135deg, rgba(37, 99, 235, 0.15), rgba(124, 58, 237, 0.15));
					border: 1px solid rgba(37, 99, 235, 0.4);
					border-radius: 12px;
					margin-bottom: 20px;
				}
				.winner-card img {
					width: 80px;
					height: 80px;
					border-radius: 10px;
					border: 3px solid #2563eb;
				}
				.winner-info h4 {
					margin: 0 0 8px;
					font-size: 18px;
					color: #60a5fa;
				}
				.winner-info p {
					margin: 0;
					font-size: 14px;
					color: #e4e8f0;
					line-height: 1.6;
				}
				.candidates-analysis {
					display: flex;
					flex-direction: column;
					gap: 12px;
				}
				.candidate-card {
					display: flex;
					gap: 16px;
					padding: 16px;
					background: #0d1117;
					border-radius: 10px;
					border: 1px solid #30363d;
				}
				.candidate-card img {
					width: 48px;
					height: 48px;
					border-radius: 8px;
				}
				.candidate-details { flex: 1; }
				.candidate-details h5 {
					margin: 0 0 8px;
					font-size: 14px;
					color: #e4e8f0;
				}
				.pros-cons {
					display: grid;
					grid-template-columns: 1fr 1fr;
					gap: 12px;
					font-size: 12px;
				}
				.pros h6, .cons h6 {
					margin: 0 0 4px;
					font-size: 11px;
					text-transform: uppercase;
				}
				.pros h6 { color: #4ade80; }
				.cons h6 { color: #f87171; }
				.pros ul, .cons ul {
					margin: 0;
					padding-left: 16px;
					color: #8b949e;
				}
				.loading-spinner {
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 12px;
					padding: 40px;
					color: #8b949e;
				}
				.spinner {
					width: 24px;
					height: 24px;
					border: 3px solid #30363d;
					border-top-color: #2563eb;
					border-radius: 50%;
					animation: spin 1s linear infinite;
				}
				@keyframes spin {
					to { transform: rotate(360deg); }
				}
			`}</style>

			<div className="header">
				<h1>⚔️ LoL Build Assistant</h1>
			</div>

			<div className="tabs">
				<button
					className={`tab ${activeTab === "recommend" ? "active" : ""}`}
					onClick={() => { setActiveTab("recommend"); setError(""); setNotInGame(false); }}
				>
					🎯 Recomendación de Objetos
				</button>
				<button
					className={`tab ${activeTab === "compare" ? "active" : ""}`}
					onClick={() => { setActiveTab("compare"); setError(""); setNotInGame(false); }}
				>
					⚖️ Comparar Items
				</button>
			</div>

			<div className="config-section">
				<h3>Configuración Opcional</h3>
				<div className="form-grid">
					<div className="field">
						<label>Campeón Oponente de Línea</label>
						<input
							type="text"
							placeholder="Ej: Darius"
							value={laneOpponentChampion}
							onChange={(e) => setLaneOpponentChampion(e.target.value)}
						/>
					</div>
					<div className="field">
						<label>Support Aliado (si eres ADC)</label>
						<input
							type="text"
							placeholder="Ej: Lulu"
							value={laneSupportChampion}
							onChange={(e) => setLaneSupportChampion(e.target.value)}
						/>
					</div>
				</div>
			</div>

			{error && <div className="error">{error}</div>}

			{checkingMatch && (
				<div className="loading-spinner">
					<div className="spinner"></div>
					<span>Detectando partida...</span>
				</div>
			)}

			{!checkingMatch && notInGame && activeTab === "recommend" && (
				<div className="not-in-game">
					<div className="icon">🎮</div>
					<h2>No estás en partida</h2>
					<p>Para usar esta herramienta, debes estar en una partida activa de League of Legends.</p>
					<p style={{ marginTop: "12px", fontSize: "13px" }}>Buscando partida automáticamente...</p>
				</div>
			)}

			{!notInGame && matchData && (
				<div className="match-panel">
					<h3>
						<span className="live-badge">EN VIVO</span>
						Partida Detectada
						<span className="game-time">
							{matchData.gameTime ? `${Math.floor(matchData.gameTime / 60)}:${String(Math.floor(matchData.gameTime % 60)).padStart(2, '0')}` : ''}
						</span>
					</h3>
					
					{playerInfo && (
						<div className="player-info" style={{ marginBottom: "16px" }}>
							<img 
								className="avatar" 
								src={champImg(playerInfo.champion)}
								alt={playerInfo.champion}
								onError={(e) => { e.target.style.display = "none"; }}
							/>
							<div className="details">
								<div className="name">{playerInfo.riotId}</div>
								<div className="meta">
									{playerInfo.champion} • {playerInfo.position || "Sin posición"} • Nivel {playerInfo.level} • {playerInfo.gold?.toLocaleString() || 0} oro
								</div>
							</div>
						</div>
					)}

					<div className="teams-container">
						<div className="team-section allies">
							<h4>👥 Tu Equipo</h4>
							{playerInfo && (
								<div className="player-row me">
									<img src={champImg(playerInfo.champion)} alt={playerInfo.champion} onError={(e) => { e.target.style.display = "none"; }} />
									<span className="player-name">{playerInfo.riotId} (Tú)</span>
									<span className="player-level">Nv {playerInfo.level}</span>
								</div>
							)}
							{(matchData.state?.allies || []).map((ally, i) => (
								<div key={i} className="player-row">
									<img src={champImg(ally.champion)} alt={ally.champion} onError={(e) => { e.target.style.display = "none"; }} />
									<span className="player-name">{ally.champion}</span>
									<span className="player-level">Nv {ally.level}</span>
								</div>
							))}
						</div>
						<div className="team-section enemies">
							<h4>⚔️ Enemigos</h4>
							{(matchData.state?.enemies || []).map((enemy, i) => (
								<div key={i} className="player-row">
									<img src={champImg(enemy.champion)} alt={enemy.champion} onError={(e) => { e.target.style.display = "none"; }} />
									<span className="player-name">{enemy.champion}</span>
									<span className="player-level">Nv {enemy.level}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			)}

			{activeTab === "recommend" && !notInGame && (
				<>
					<button
						className="button"
						onClick={handleRecommend}
						disabled={loading}
					>
						{loading ? "Analizando partida..." : "Obtener Recomendaciones"}
					</button>

					{loading && (
						<div className="loading-spinner">
							<div className="spinner"></div>
							<span>Analizando tu partida y generando recomendaciones...</span>
						</div>
					)}

					{parsedRecommendation && buyNowTop3.length > 0 && (
						<div className="results-section">
							<h3>
								🏆 Compra Ahora - Top 3 Opciones
								{gameStateTag && (
									<span style={{
										marginLeft: "12px",
										fontSize: "12px",
										padding: "4px 10px",
										borderRadius: "6px",
										background: gameStateTag === "ahead" ? "rgba(74, 222, 128, 0.2)" : 
										           gameStateTag === "behind" ? "rgba(248, 113, 113, 0.2)" : "rgba(139, 148, 158, 0.2)",
										color: gameStateTag === "ahead" ? "#4ade80" : 
										       gameStateTag === "behind" ? "#f87171" : "#8b949e"
									}}>
										{gameStateTag === "ahead" ? "📈 Adelante" : 
										 gameStateTag === "behind" ? "📉 Atrás" : "⚖️ Parejo"}
									</span>
								)}
							</h3>
							<div className="top5-grid">
								{buyNowTop3.map((option, index) => (
									<div key={option.rank || index} className="item-recommend-card">
										<div className={`item-rank rank-${option.rank || index + 1}`}>
											{option.rank || index + 1}
										</div>
										<img
											className="item-image"
											src={itemImg(option.targetItem?.itemId || option.firstComponentNow?.itemId)}
											alt={option.targetItem?.name}
											onError={(e) => { e.target.style.display = "none"; }}
										/>
										<div className="item-info">
											<div className="item-name">{option.targetItem?.name || "Item"}</div>
											<div className="item-explanation" style={{ marginBottom: "8px" }}>
												<strong>Objetivo:</strong> {option.whyTarget}
											</div>
											{option.firstComponentNow && (
												<div style={{ 
													padding: "8px 12px", 
													background: "rgba(37, 99, 235, 0.1)", 
													borderRadius: "6px",
													marginTop: "8px"
												}}>
													<div style={{ fontSize: "12px", color: "#60a5fa", marginBottom: "4px" }}>
														🛒 Comprar ahora: <strong>{option.firstComponentNow.name}</strong> ({option.firstComponentNow.cost}g)
													</div>
													<div style={{ fontSize: "12px", color: "#8b949e" }}>
														{option.whyFirstComponent}
													</div>
												</div>
											)}
											{option.whenToChoose && (
												<div style={{ fontSize: "12px", color: "#a78bfa", marginTop: "8px" }}>
													💡 {option.whenToChoose}
												</div>
											)}
										</div>
									</div>
								))}
							</div>

							{nextBuyTop3.length > 0 && (
								<div style={{ marginTop: "24px" }}>
									<h3>📋 Próximas Compras Planificadas</h3>
									<div className="top5-grid">
										{nextBuyTop3.map((item, index) => (
											<div key={item.itemId || index} className="item-recommend-card">
												<div className={`item-rank rank-${item.rank || index + 1}`}>
													{item.rank || index + 1}
												</div>
												<img
													className="item-image"
													src={itemImg(item.itemId)}
													alt={item.name}
													onError={(e) => { e.target.style.display = "none"; }}
												/>
												<div className="item-info">
													<div className="item-name">{item.name}</div>
													<div className="item-explanation">{item.whyNext}</div>
													{item.buildPath && (
														<div style={{ 
															marginTop: "8px", 
															display: "flex", 
															gap: "6px", 
															flexWrap: "wrap",
															alignItems: "center"
														}}>
															<span style={{ fontSize: "11px", color: "#8b949e" }}>Ruta:</span>
															{item.buildPath.map((step, i) => (
																<span key={i} style={{ 
																	display: "inline-flex", 
																	alignItems: "center", 
																	gap: "4px",
																	fontSize: "11px",
																	color: "#8b949e"
																}}>
																	{i > 0 && "→"}
																	<img 
																		src={itemImg(step.itemId)} 
																		alt={step.name}
																		style={{ width: "20px", height: "20px", borderRadius: "4px" }}
																		onError={(e) => { e.target.style.display = "none"; }}
																	/>
																</span>
															))}
														</div>
													)}
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{playAdvice && (
								<div className="strategy-box">
									<h4>📋 Consejos de Juego</h4>
									<p style={{ marginBottom: "12px" }}><strong>Win Condition:</strong> {playAdvice.winCondition}</p>
									{playAdvice.ifAhead?.length > 0 && gameStateTag === "ahead" && (
										<div>
											<strong style={{ color: "#4ade80" }}>Como vas adelante:</strong>
											<ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
												{playAdvice.ifAhead.map((tip, i) => <li key={i}>{tip}</li>)}
											</ul>
										</div>
									)}
									{playAdvice.ifBehind?.length > 0 && gameStateTag === "behind" && (
										<div>
											<strong style={{ color: "#f87171" }}>Como vas atrás:</strong>
											<ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
												{playAdvice.ifBehind.map((tip, i) => <li key={i}>{tip}</li>)}
											</ul>
										</div>
									)}
								</div>
							)}
						</div>
					)}
				</>
			)}

			{activeTab === "compare" && (
				<>
					{notInGame && (
						<div style={{
							padding: "12px 16px",
							background: "rgba(251, 191, 36, 0.1)",
							border: "1px solid rgba(251, 191, 36, 0.3)",
							borderRadius: "10px",
							color: "#fbbf24",
							marginBottom: "16px",
							fontSize: "14px"
						}}>
							⚠️ No estás en partida. Puedes seleccionar items, pero la comparación requiere datos de una partida activa.
						</div>
					)}
					<div className="selected-items-bar">
						{selectedItems.length === 0 ? (
							<span className="empty-selection">
								Selecciona items de la lista para compararlos
							</span>
						) : (
							selectedItems.map((itemId) => {
								const item = allItems[itemId];
								return (
									<div key={itemId} className="selected-item-chip">
										<img src={itemImg(itemId)} alt={item?.name} />
										<span>{item?.name || itemId}</span>
										<button onClick={() => toggleItemSelection(itemId)}>×</button>
									</div>
								);
							})
						)}
					</div>

					<div className="search-bar">
						<input
							type="text"
							placeholder="🔍 Buscar item por nombre..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>

					{/* Sección de Items */}
					<h4 style={{ 
						margin: "0 0 12px", 
						fontSize: "14px", 
						color: "#8b949e", 
						textTransform: "uppercase", 
						letterSpacing: "0.5px" 
					}}>
						⚔️ Items ({filteredNormalItems.length})
					</h4>
					<div className="items-grid">
						{filteredNormalItems.map(([id, item]) => (
							<div
								key={id}
								className={`item-select-card ${selectedItems.includes(id) ? "selected" : ""}`}
								onClick={() => toggleItemSelection(id)}
							>
								<img src={itemImg(id)} alt={item.name} />
								<span>{item.name}</span>
							</div>
						))}
					</div>

					{/* Sección de Botas */}
					<h4 style={{ 
						margin: "24px 0 12px", 
						fontSize: "14px", 
						color: "#8b949e", 
						textTransform: "uppercase", 
						letterSpacing: "0.5px" 
					}}>
						👟 Botas y Grebas ({filteredBootsItems.length})
					</h4>
					<div className="items-grid" style={{ maxHeight: "200px" }}>
						{filteredBootsItems.map(([id, item]) => (
							<div
								key={id}
								className={`item-select-card ${selectedItems.includes(id) ? "selected" : ""}`}
								onClick={() => toggleItemSelection(id)}
							>
								<img src={itemImg(id)} alt={item.name} />
								<span>{item.name}</span>
							</div>
						))}
					</div>

					<div className="compare-actions">
						<button
							className="button"
							onClick={handleCompare}
							disabled={loading || selectedItems.length < 2}
						>
							{loading ? "Comparando..." : `Comparar ${selectedItems.length} Items`}
						</button>
					</div>

					{loading && (
						<div className="loading-spinner">
							<div className="spinner"></div>
							<span>Analizando los items seleccionados...</span>
						</div>
					)}

					{(() => {
						const parsedCompare = parseRecommendation(compareResult?.recommendation);
						if (!parsedCompare?.recommendation) return null;
						
						const { recommendation: recItem, candidatesAnalyzed } = parsedCompare;
						
						return (
							<div className="results-section compare-result">
								<h3>🏆 Mejor Opción</h3>
								<div className="winner-card">
									<img
										src={itemImg(recItem.itemId)}
										alt={recItem.name}
									/>
									<div className="winner-info">
										<h4>{recItem.name}</h4>
										<p>{recItem.explanation}</p>
									</div>
								</div>

								{candidatesAnalyzed?.length > 0 && (
									<>
										<h3 style={{ marginTop: "24px" }}>📊 Análisis Detallado</h3>
										<div className="candidates-analysis">
											{candidatesAnalyzed.map((c) => (
												<div key={c.itemId} className="candidate-card">
													<img src={itemImg(c.itemId)} alt={c.name} />
													<div className="candidate-details">
														<h5>{c.name}</h5>
														<div className="pros-cons">
															<div className="pros">
																<h6>✓ Pros</h6>
																<ul>
																	{(c.prosForThisMatch || []).map((p, i) => (
																		<li key={i}>{p}</li>
																	))}
																</ul>
															</div>
															<div className="cons">
																<h6>✗ Contras</h6>
																<ul>
																	{(c.consForThisMatch || []).map((p, i) => (
																		<li key={i}>{p}</li>
																	))}
																</ul>
															</div>
														</div>
													</div>
												</div>
											))}
										</div>
									</>
								)}
							</div>
						);
					})()}
				</>
			)}
		</div>
	);
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
const roles = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];

const { useMemo, useState } = React;

function App() {
	const [riotId, setRiotId] = useState("");
	const [role, setRole] = useState("TOP");
	const [laneOpponentChampion, setLaneOpponentChampion] = useState("");
	const [laneSupportChampion, setLaneSupportChampion] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [data, setData] = useState(null);

	const isAdc = role === "ADC";
	const riotIdIsValid = useMemo(() => {
		const trimmed = riotId.trim();
		return /^.+#.+$/.test(trimmed);
	}, [riotId]);

	const handleSubmit = async (event) => {
		event.preventDefault();
		setError("");
		setData(null);

		const trimmedRiotId = riotId.trim();
		if (!trimmedRiotId) {
			setError("Riot ID is required.");
			return;
		}
		if (!riotIdIsValid) {
			setError("Riot ID must be in the format GameName#TagLine.");
			return;
		}

		const payload = {
			riotId: trimmedRiotId,
			role,
			laneOpponentChampion: laneOpponentChampion.trim() || null,
			laneSupportChampion: isAdc ? laneSupportChampion.trim() || null : null,
		};

		try {
			setLoading(true);
			const response = await fetch("/recommend", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const message = await response.text();
				throw new Error(message || "Request failed.");
			}

			const result = await response.json();
			setData(result);
		} catch (err) {
			setError(err.message || "Something went wrong.");
		} finally {
			setLoading(false);
		}
	};

	const focus = data?.focus;
	const recommendation = data?.recommendation;

	return (
		<div className="app">
			<style>{`
				.app {
					font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
					max-width: 960px;
					margin: 32px auto;
					padding: 24px;
					color: #e9ecf1;
					background: #0f172a;
					border-radius: 12px;
					box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
				}
				.title {
					font-size: 24px;
					font-weight: 600;
					margin-bottom: 16px;
				}
				.form {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
					gap: 12px;
					margin-bottom: 16px;
				}
				.field {
					display: flex;
					flex-direction: column;
					gap: 6px;
				}
				.field label {
					font-size: 13px;
					color: #cbd5f5;
				}
				.field input,
				.field select {
					padding: 10px 12px;
					border-radius: 8px;
					border: 1px solid #27336f;
					background: #111c3f;
					color: #f8fafc;
				}
				.actions {
					display: flex;
					align-items: center;
					gap: 12px;
					margin-top: 8px;
				}
				.button {
					padding: 10px 16px;
					border-radius: 8px;
					border: none;
					background: #2563eb;
					color: white;
					font-weight: 600;
					cursor: pointer;
				}
				.button:disabled {
					opacity: 0.6;
					cursor: not-allowed;
				}
				.error {
					margin-top: 12px;
					color: #f87171;
					background: rgba(248, 113, 113, 0.1);
					padding: 10px 12px;
					border-radius: 8px;
				}
				.section {
					margin-top: 20px;
					background: #121b3b;
					padding: 16px;
					border-radius: 10px;
				}
				.section h3 {
					margin: 0 0 12px;
					font-size: 18px;
				}
				.item-grid {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
					gap: 12px;
				}
				.item-card {
					background: #0b122b;
					border-radius: 10px;
					padding: 12px;
					text-align: center;
					border: 1px solid #1f2a5f;
				}
				.item-card img {
					width: 64px;
					height: 64px;
					object-fit: contain;
					margin-bottom: 8px;
				}
				.explanation {
					margin-top: 16px;
					padding: 14px;
					background: #0a142f;
					border-left: 4px solid #60a5fa;
					white-space: pre-wrap;
					line-height: 1.5;
				}
			`}</style>

			<div className="title">LoL Build Assistant</div>
			<form className="form" onSubmit={handleSubmit}>
				<div className="field">
					<label htmlFor="riotId">Riot ID</label>
					<input
						id="riotId"
						type="text"
						placeholder="GameName#TagLine"
						value={riotId}
						onChange={(event) => setRiotId(event.target.value)}
					/>
				</div>
				<div className="field">
					<label htmlFor="role">Role</label>
					<select
						id="role"
						value={role}
						onChange={(event) => {
							const nextRole = event.target.value;
							setRole(nextRole);
							if (nextRole !== "ADC") {
								setLaneSupportChampion("");
							}
						}}
					>
						{roles.map((option) => (
							<option key={option} value={option}>
								{option}
							</option>
						))}
					</select>
				</div>
				<div className="field">
					<label htmlFor="laneOpponentChampion">Lane Opponent Champion</label>
					<input
						id="laneOpponentChampion"
						type="text"
						placeholder="Optional"
						value={laneOpponentChampion}
						onChange={(event) => setLaneOpponentChampion(event.target.value)}
					/>
				</div>
				{isAdc && (
					<div className="field">
						<label htmlFor="laneSupportChampion">Lane Support Champion</label>
						<input
							id="laneSupportChampion"
							type="text"
							placeholder="Optional"
							value={laneSupportChampion}
							onChange={(event) => setLaneSupportChampion(event.target.value)}
						/>
					</div>
				)}
				<div className="actions">
					<button className="button" type="submit" disabled={loading}>
						{loading ? "Requesting..." : "Get Recommendation"}
					</button>
					{loading && <span>Fetching recommendation...</span>}
				</div>
			</form>

			{error && <div className="error">{error}</div>}

			{data && (
				<div>
					{focus && (
						<div className="section">
							<h3>Match Focus</h3>
							<div>Phase: {focus.phase || "Unknown"}</div>
							<div style={{ marginTop: "10px" }}>
								<strong>Build vs</strong>
								{focus.buildVs?.length ? (
									<ul>
										{focus.buildVs.map((entry, index) => (
											<li key={`${entry.champion}-${index}`}>
												{entry.champion} ({entry.buildScore})
											</li>
										))}
									</ul>
								) : (
									<div>None</div>
								)}
							</div>
							<div style={{ marginTop: "10px" }}>
								<strong>Target</strong>
								{focus.target?.length ? (
									<ul>
										{focus.target.map((entry, index) => (
											<li key={`${entry.champion}-${index}`}>
												{entry.champion} ({entry.targetScore})
											</li>
										))}
									</ul>
								) : (
									<div>None</div>
								)}
							</div>
						</div>
					)}

					{recommendation && (
						<div className="section">
							<h3>Recommended Items</h3>
							<div className="item-grid">
								{recommendation.items?.map((item) => (
									<div key={item.id} className="item-card">
										<img src={item.image} alt={item.name} />
										<div>{item.name}</div>
									</div>
								))}
							</div>
							<div className="explanation">
								{recommendation.explanation || ""}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
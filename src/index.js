import http from "node:http";
import "dotenv/config";

import { handleHealth } from "./routes/health.js";
import { route } from "./lib/router.js";
import { test } from "./routes/test.js";
import { handleQuestion } from "./routes/question.js";
import { handleDataFromDdragon } from "./routes/ddragon-data.js";
import { handleFrontend } from "./routes/frontend.js";
import { handleRecommend } from "./routes/recommend.js";
import { handleCompareItems } from "./routes/compareItems.js";
import { handleMatchStatus } from "./routes/matchStatus.js";

const PORT = process.env.PORT || 3000;

// Variables de entorno disponibles para los handlers
let env = {};
if (process.env.OPENAI_API_KEY) {
	env = {
		OPENAI_API_KEY: process.env.OPENAI_API_KEY,
		AI_LANGUAGE_MODEL: process.env.AI_LANGUAGE_MODEL,
	};
} else {
	env = {
		GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
		GOOGLE_MODEL_RECOMMEND: process.env.GOOGLE_MODEL_RECOMMEND,
		GOOGLE_MODEL_COMPARE: process.env.GOOGLE_MODEL_COMPARE,
	};
}


const routes = [
	["GET", "/", handleFrontend],
	["GET", "/frontend/App.js", handleFrontend],
	["GET", "/health", handleHealth],
	["POST", "/test", test],
	["POST", "/question", handleQuestion],
	["GET", "/ddragon-data", handleDataFromDdragon],
	["POST", "/recommend", handleRecommend],
	["POST", "/compare", handleCompareItems],
	["GET", "/match-status", handleMatchStatus],
];

const server = http.createServer(async (req, res) => {
	const response = await route(req, env, {}, routes);

	// Escribir la respuesta de tipo Response (Web API) a la respuesta de Node
	res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
	res.end(await response.text());
});

server.listen(PORT, () => {
	console.log(`🚀 Server running at http://localhost:${PORT}`);
});

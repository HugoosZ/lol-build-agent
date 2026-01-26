import http from "node:http";
import "dotenv/config";

import { handleHealth } from "./routes/health.js";
import { route } from "./lib/router.js";
import { test } from "./routes/test.js";
import { handleQuestion } from "./routes/question.js";
import { handleDataFromDdragon } from "./routes/ddragon-data.js";

const PORT = process.env.PORT || 3000;

// Variables de entorno disponibles para los handlers
const env = {
	OPENAI_API_KEY: process.env.OPENAI_API_KEY,
	AI_LANGUAGE_MODEL: process.env.AI_LANGUAGE_MODEL,
};

const routes = [
	["GET", "/health", handleHealth],
	["GET", "/test", test],
	["POST", "/question", handleQuestion],
	["GET", "/ddragon-data", handleDataFromDdragon],
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

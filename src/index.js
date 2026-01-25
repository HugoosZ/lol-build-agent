
import { handleHealth } from "./routes/health.js";
import { route } from "./lib/router.js";
import { test } from "./routes/test.js";
import { handleQuestion } from "./routes/question.js";	


export default {
	async fetch(request, env, ctx) { // request de cloudflare en vez de req y res de express. el env es para las variables de entorno. ctx es para la asincronia. 
		return route(request, env, ctx, [
			["GET", "/health", handleHealth],
			["GET", "/test", test],
			["POST", "/question", handleQuestion],

		]);
	},
};

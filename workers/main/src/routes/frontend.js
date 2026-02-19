import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { json, text } from "../lib/json.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "../frontend");

function getContentType(filePath) {
	if (filePath.endsWith(".html")) {
		return "text/html; charset=utf-8";
	}
	if (filePath.endsWith(".js")) {
		return "text/javascript; charset=utf-8";
	}
	if (filePath.endsWith(".css")) {
		return "text/css; charset=utf-8";
	}
	return "text/plain; charset=utf-8";
}

export async function handleFrontend(request) {
	try {
		const url = new URL(request.url);
		const pathname = url.pathname;
		let filePath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
		if (filePath.startsWith("frontend/")) {
			filePath = filePath.replace(/^frontend\//, "");
		}
		const absolutePath = path.join(frontendDir, filePath);
		const content = await fs.readFile(absolutePath, "utf-8");
		return text(content, 200, { "Content-Type": getContentType(filePath) });
	} catch (error) {
        
		return json({ error: "Not Found" }, 404);
	}
}

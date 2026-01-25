import { json } from "../lib/json.js";
import { askOpenAI } from "../agent/openia.js";

export async function handleQuestion(request, env, ctx) {
  const body = await request.json().catch(() => null);
  const question = body?.question.trim();  // trim elimina espacios en blanco al inicio y al final de un string
  if (!question) return json({ error: "Missing question" }, 400);  

  const answer = await askOpenAI(env, question);
  
  return json({ ok: true, received: body.question, answer }, 200);
}
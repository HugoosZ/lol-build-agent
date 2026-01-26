import { json } from "../lib/json.js";
import { askOpenAI } from "../agent/openia.js";
import { getMatchData } from "../services/match.js";

export async function handleQuestion(request, env, ctx) {
  const body = await request.json().catch(() => null);
  const question = body?.question?.trim();  // trim elimina espacios en blanco al inicio y al final de un string
  
  let match;
  try {
    match = await getMatchData(); // usa DEFAULT_LIVE_URL
  } catch (error) {
    return json({ error: "Could not fetch match data", details: error.message }, 500);
  }

  if (!question) return json({ error: "Missing question" }, 400);  

  // const answer = await askOpenAI(env, question);
  
  // return json({ ok: true, received: body.question, answer }, 200);
  return json({ ok: true, received: body.question, match }, 200);
}
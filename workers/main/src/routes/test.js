import { json } from "../lib/json.js";
import { getMatchData } from "../services/match.js";

const URL = "https://ddragon.hugo-rojas1.workers.dev/test"

export async function test(request, env, ctx) {
  const body = await request.json().catch(() => ({}));


  let raw;
  try {
      const response = await fetch(URL);               // Live API
      raw = await response.json();

  } catch (error) {
  return json({ error: "Could not fetch match data", details: error.message }, 500);
  }
  



  return json({ raw }, 200);
}

import { json } from "../lib/json.js";

export async function test(_request, _env, _ctx) {
  return json({ status: "okei" });
}
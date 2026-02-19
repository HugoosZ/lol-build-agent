import { Agent } from "undici";

const dispatcher = new Agent({
  connect: {
    rejectUnauthorized: false, // acepta certificado self-signed
  },
});

const DEFAULT_LIVE_URL = "https://127.0.0.1:2999/liveclientdata/allgamedata";

export async function getMatchData(url = DEFAULT_LIVE_URL) {
  const res = await fetch(url, { dispatcher });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

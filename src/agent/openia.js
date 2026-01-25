export async function askOpenAI(env, question) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in env");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.AI_LANGUAGE_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant. Answer concisely." },
        { role: "user", content: question },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? "";
}
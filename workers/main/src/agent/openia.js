export async function askOpenAI(env, input) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY in env");
  }

  let messages;
  if (typeof input === "string") {
    messages = [
      { role: "system", content: "You are a helpful assistant. Answer concisely." },
      { role: "user", content: input },
    ];
  } else if (input?.messages?.length) {
    messages = input.messages;
  } else {
    const system = input?.system ?? "You are a helpful assistant. Answer concisely.";
    const user = input?.user ?? "";
    messages = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.AI_LANGUAGE_MODEL || "gpt-4o-mini",
      messages,
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

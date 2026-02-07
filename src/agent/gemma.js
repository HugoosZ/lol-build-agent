export async function askGemma(env, input, modelOverride) {
  if (!env.GOOGLE_API_KEY) {
    throw new Error("Missing GOOGLE_API_KEY in env");
  }

  const model = modelOverride || env.GOOGLE_MODEL || "gemini-1.5-flash";

  let systemInstruction = "You are a helpful assistant. Answer concisely.";
  let userContent = "";

  if (typeof input === "string") {
    userContent = input;
  } else if (input?.messages?.length) {
    // Extract system and user messages from messages array
    const systemMsg = input.messages.find(m => m.role === "system");
    const userMsg = input.messages.find(m => m.role === "user");
    if (systemMsg) systemInstruction = systemMsg.content;
    if (userMsg) userContent = userMsg.content;
  } else {
    systemInstruction = input?.system ?? systemInstruction;
    userContent = input?.user ?? "";
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GOOGLE_API_KEY}`;

  // Gemma models don't support systemInstruction, only Gemini does
  const isGemma = model.toLowerCase().startsWith("gemma");

  let requestBody;
  if (isGemma) {
    // For Gemma: prepend system instruction to user content
    const combinedContent = `${systemInstruction}\n\n---\n\n${userContent}`;
    requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: combinedContent }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    };
  } else {
    // For Gemini: use systemInstruction field
    requestBody = {
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userContent }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
      },
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google API error ${res.status}: ${text}`);
  }

  const data = await res.json();

  // Log token usage
  if (data?.usageMetadata) {
    const usage = data.usageMetadata;
    console.log(`[Gemma] Tokens - Input: ${usage.promptTokenCount}, Output: ${usage.candidatesTokenCount}, Total: ${usage.totalTokenCount}`);
  }

  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}
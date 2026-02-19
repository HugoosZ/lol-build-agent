import { json } from "../lib/json.js";
import { getItemsWithSignals, getLatestVersion } from "../services/ddragon.js";

export async function handleItemsWithSignals(request, env, _ctx) {
  const url = new URL(request.url);
  const reset = url.searchParams.get("reset") === "true";

  // Si piden reset, borrar progreso y cache de signals
  if (reset) {
    const version = await getLatestVersion();
    await env.DDRAGON_CACHE.delete(`signals-progress-${version}`);
    await env.DDRAGON_CACHE.delete(`items-${version}.with-signals`);
    return json({ ok: true, message: `Progreso y cache de signals borrados para v${version}.` });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Procesar en background mientras se streamea la respuesta
  (async () => {
    try {
      const { cached, data, complete } = await getItemsWithSignals(env, writer);

      if (cached) {
        await writer.write(encoder.encode("data: [Signals] ✅ Datos cargados desde cache\n\n"));
      } else if (!complete) {
        await writer.write(encoder.encode("data: [Signals] ⏸️ Resultado parcial. Vuelve a llamar /items-signals para continuar los items restantes.\n\n"));
      }

      await writer.write(encoder.encode(`data: ---RESULT---\n\n`));
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch (e) {
      console.error("[items-signals] Error:", e);
      await writer.write(encoder.encode(`data: ---ERROR--- ${e?.message ?? String(e)}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

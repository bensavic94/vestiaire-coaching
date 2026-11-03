import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const { athlete, pin, system, messages } = body || {};
  if (!["aya", "camelia"].includes(athlete) || typeof pin !== "string" || !Array.isArray(messages)) return json({ error: "bad_request" }, 400);

  // Vérifie le code PIN via la fonction SQL
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const chk = await fetch(`${url}/rest/v1/rpc/coaching_get`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_athlete: athlete, p_pin: pin }),
  });
  if (!chk.ok) return json({ error: "code_invalide" }, 401);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "coach_non_configure" }, 503);

  const msgs = messages.slice(-12).map((m: any) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 2000),
  }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ error: "bad_messages" }, 400);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("COACH_MODEL") || "claude-haiku-5-5",
      max_tokens: 700,
      system: String(system || "").slice(0, 12000),
      messages: msgs,
    }),
  });
  if (!r.ok) return json({ error: "llm", status: r.status }, 502);
  const out = await r.json();
  const text = (out.content || []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  return json({ text });
});

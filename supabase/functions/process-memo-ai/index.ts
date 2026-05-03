// Receives { memo_id }, calls Gemini to extract summary / required_action /
// deadline / consequences, and writes them back to the memos row.
// Idempotent: skips memos that already have ai_processed_at.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const SYSTEM_PROMPT = `You are an assistant that converts university memos into a structured, plain-English brief.
Return ONLY a JSON object matching this exact shape:
{
  "summary": "1-2 sentence plain-English explanation",
  "required_action": "What the student must do, or null",
  "deadline": "ISO 8601 date or null",
  "consequences": "What happens if ignored, or null"
}
Be concise. Do not invent dates or actions that are not in the source. Output JSON only — no markdown, no commentary.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("LOVABLE_API_KEY") ?? "";

    if (!GEMINI_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { memo_id } = await req.json();
    if (!memo_id) {
      return new Response(JSON.stringify({ error: "memo_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: memo, error: fetchErr } = await supabase
      .from("memos")
      .select("id, title, body, ai_processed_at, school_id, publisher_id")
      .eq("id", memo_id)
      .single();
    if (fetchErr || !memo) throw new Error(fetchErr?.message ?? "memo not found");
    if (memo.ai_processed_at) {
      return new Response(JSON.stringify({ ok: true, skipped: "already_processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Title: ${memo.title}\n\nBody:\n${memo.body}`;
    const aiResp = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text().catch(() => "");
      console.error("Gemini error", aiResp.status, errText);
      throw new Error(`Gemini ${aiResp.status}`);
    }

    const aiJson = await aiResp.json();
    const raw =
      aiJson?.candidates?.[0]?.content?.parts?.[0]?.text ??
      aiJson?.candidates?.[0]?.content?.parts?.[0]?.functionCall?.args ??
      "";
    let parsed: {
      summary?: string;
      required_action?: string | null;
      deadline?: string | null;
      consequences?: string | null;
    } = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      // best-effort fallback: stuff the whole thing in summary
      parsed = { summary: String(raw).slice(0, 500) };
    }

    const update: Record<string, unknown> = {
      ai_summary: parsed.summary ?? null,
      ai_required_action: parsed.required_action ?? null,
      ai_deadline: parsed.deadline && /^\d{4}-\d{2}-\d{2}/.test(parsed.deadline)
        ? parsed.deadline
        : null,
      ai_consequences: parsed.consequences ?? null,
      ai_processed_at: new Date().toISOString(),
    };

    const { error: updErr } = await supabase
      .from("memos")
      .update(update)
      .eq("id", memo.id);
    if (updErr) throw new Error(updErr.message);

    return new Response(JSON.stringify({ ok: true, ...parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-memo-ai error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

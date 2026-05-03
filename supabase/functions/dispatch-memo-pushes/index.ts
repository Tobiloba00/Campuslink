// Resolve the audience for a memo and call send-push for each unique user.
// Triggered after INSERT on memos when urgency is 'urgent' or 'important'.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH = 200;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { memo_id } = await req.json();
    if (!memo_id) {
      return new Response(JSON.stringify({ error: "memo_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull memo + targets
    const { data: memo } = await supabase
      .from("memos")
      .select("id, title, body, urgency, school_id, publisher_id")
      .eq("id", memo_id)
      .single();
    if (!memo) throw new Error("memo not found");

    const { data: targets } = await supabase
      .from("memo_targets")
      .select("target_type, school_id, faculty_id, department_id, level")
      .eq("memo_id", memo_id);
    if (!targets || targets.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_targets" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the union of audience user_ids by walking each target and querying profiles
    const audience = new Set<string>();
    for (const t of targets) {
      let q = supabase
        .from("profiles")
        .select("id")
        .eq("school_id", t.school_id);

      if (t.target_type === "faculty" && t.faculty_id) {
        q = q.eq("faculty_id", t.faculty_id);
      } else if (t.target_type === "department" && t.department_id) {
        q = q.eq("department_id", t.department_id);
      } else if (t.target_type === "level" && t.level != null) {
        q = q.eq("level", t.level);
      }
      // school target: no extra filter

      const { data: rows } = await q.limit(50000);
      (rows ?? []).forEach((r: any) => audience.add(r.id));
    }

    // Don't push to the publisher themselves
    const { data: pub } = await supabase
      .from("publishers")
      .select("user_id")
      .eq("id", memo.publisher_id)
      .single();
    if (pub?.user_id) audience.delete(pub.user_id);

    const recipients = [...audience];
    const titlePrefix =
      memo.urgency === "urgent" ? "🚨 Urgent memo" : "📌 Important memo";

    let sent = 0;
    for (let i = 0; i < recipients.length; i += BATCH) {
      const slice = recipients.slice(i, i + BATCH);
      await Promise.all(
        slice.map(async (uid) => {
          await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({
              user_id: uid,
              type: "memo",
              title: `${titlePrefix}: ${memo.title}`,
              body: memo.body.slice(0, 140),
              data: { memo_id: memo.id, url: `/memos/${memo.id}` },
            }),
          });
          sent++;
        })
      );
    }

    return new Response(JSON.stringify({ ok: true, recipients: recipients.length, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("dispatch-memo-pushes error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

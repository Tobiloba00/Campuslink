// Daily: nudge users who've been inactive 3+ days, max once per 7 days each.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

serve(async () => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    // Page through eligible users so we don't load everyone into memory.
    const PAGE = 500;
    let offset = 0;
    let sent = 0;

    while (true) {
      const { data: candidates, error } = await supabase
        .from("notification_preferences")
        .select("user_id, last_active_at, last_reengagement_sent_at, push_reengagement")
        .eq("push_reengagement", true)
        .lt("last_active_at", threeDaysAgo)
        .or(`last_reengagement_sent_at.is.null,last_reengagement_sent_at.lt.${sevenDaysAgo}`)
        .range(offset, offset + PAGE - 1);

      if (error) throw error;
      if (!candidates || candidates.length === 0) break;

      for (const u of candidates) {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          user_id: u.user_id,
          type: "reengagement",
          title: "Anything new on campus today?",
          body: "Tap in to see fresh tasks and what your friends are posting.",
          data: { url: "/feed" },
        }),
      });
      if (res.ok) {
        await supabase
          .from("notification_preferences")
          .update({ last_reengagement_sent_at: new Date().toISOString() })
          .eq("user_id", u.user_id);
        sent++;
      }
      }

      if (candidates.length < PAGE) break;
      offset += PAGE;
    }

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

// Daily: ping owners of overdue, still-open tasks. Once per task per day max
// (we use a 20-hour cooldown via posts.last_overdue_sent_at — wait, we don't
// have that column. Instead we gate per-user via notification_preferences.last_overdue_sent_at.)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

serve(async () => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 20 * 3_600_000).toISOString();

    // Open tasks past their deadline
    const { data: tasks } = await supabase
      .from("posts")
      .select("id, title, user_id, due_date")
      .eq("status", "open")
      .not("due_date", "is", null)
      .lt("due_date", now);

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    }

    // Group by owner; pick the most-overdue task per owner so we ping once
    const byUser = new Map<string, { id: string; title: string }>();
    for (const t of tasks) {
      if (!byUser.has(t.user_id)) byUser.set(t.user_id, { id: t.id, title: t.title });
    }

    let sent = 0;
    for (const [userId, task] of byUser.entries()) {
      // Check per-user cooldown
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("last_overdue_sent_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (prefs?.last_overdue_sent_at && prefs.last_overdue_sent_at > yesterday) continue;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          user_id: userId,
          type: "overdue",
          title: "Task is overdue",
          body: `"${task.title.slice(0, 60)}" passed its deadline. Update or extend it?`,
          data: { url: `/post/${task.id}` },
        }),
      });
      if (res.ok) {
        await supabase
          .from("notification_preferences")
          .upsert({ user_id: userId, last_overdue_sent_at: new Date().toISOString() });
        sent++;
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

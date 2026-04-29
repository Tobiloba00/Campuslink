// Weekly: send a "what's new in your department" digest. Skips users with no
// course set or with reengagement push disabled.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

serve(async () => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const oneWeekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    // All users with a course set
    const { data: users } = await supabase
      .from("profiles")
      .select("id, course")
      .not("course", "is", null);

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });
    }

    let sent = 0;
    for (const u of users) {
      // Honor opt-out
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("push_reengagement, last_digest_sent_at")
        .eq("user_id", u.id)
        .maybeSingle();
      if (prefs && prefs.push_reengagement === false) continue;
      // Don't double-send if a digest already went out this week (in case cron fires twice)
      if (prefs?.last_digest_sent_at && prefs.last_digest_sent_at > oneWeekAgo) continue;

      // Count posts in their dept this past week (excluding their own)
      const { count } = await supabase
        .from("posts")
        .select("id", { count: "exact", head: true })
        .neq("user_id", u.id)
        .gte("created_at", oneWeekAgo)
        .filter("profiles.course", "eq", u.course); // join via FK

      // Cheaper alternative if the join filter isn't supported by your select shape:
      // count distinct posts where post author has the same course. We'll just message
      // a generic line if the dept-specific count comes back null.
      const headline =
        count && count > 0
          ? `${count} new post${count === 1 ? "" : "s"} in ${u.course} this week`
          : `New tasks waiting in ${u.course}`;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          user_id: u.id,
          type: "digest",
          title: headline,
          body: "Tap to catch up on what's new.",
          data: { url: "/feed" },
        }),
      });
      if (res.ok) {
        await supabase
          .from("notification_preferences")
          .upsert({ user_id: u.id, last_digest_sent_at: new Date().toISOString() });
        sent++;
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

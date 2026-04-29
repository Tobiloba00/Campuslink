// Sends a Web Push notification to all of a user's subscriptions, AND inserts
// a row into the in-app `notifications` table so the bell badge updates.
// Falls back to email via Resend if no push subscription exists or if every
// push attempt failed.
//
// Required Supabase secrets:
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT (e.g. mailto:admin@example.com)
//   SUPABASE_URL                  (auto-provided)
//   SUPABASE_SERVICE_ROLE_KEY     (auto-provided)
//   RESEND_API_KEY (optional)
//   RESEND_FROM    (optional, e.g. CampusLink <noreply@yourdomain.com>)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  user_id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
};

// Match the same allowed values as the SQL CHECK constraint
const ALLOWED_TYPES = new Set([
  "message", "comment", "applicant", "task_status",
  "task_assigned", "reengagement", "overdue", "digest", "like",
]);

// Map notification type → preference column (so we can honor user opt-outs)
const PREF_COLUMN: Record<string, string | null> = {
  message: "push_messages",
  comment: "push_comments",
  applicant: "push_applicants",
  task_status: "push_task_status",
  task_assigned: "push_task_status",
  reengagement: "push_reengagement",
  overdue: "push_task_status",
  digest: "push_reengagement",
  like: null, // never gated, but never sent currently either
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    const RESEND_FROM = Deno.env.get("RESEND_FROM");

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const payload: Payload = await req.json();
    if (!payload?.user_id || !payload?.type || !payload?.title) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ALLOWED_TYPES.has(payload.type)) {
      return new Response(JSON.stringify({ error: "Invalid type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // ── 1. Insert into in-app notifications feed (always, regardless of push prefs) ──
    const { error: insertErr } = await supabase.from("notifications").insert({
      user_id: payload.user_id,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      data: payload.data ?? {},
    });
    if (insertErr) console.error("Notification insert failed:", insertErr);

    // ── 2. Honor user's push preference (if they opted out of this category) ──
    const prefCol = PREF_COLUMN[payload.type];
    if (prefCol) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select(prefCol)
        .eq("user_id", payload.user_id)
        .maybeSingle();
      // Default to enabled if no row exists
      // deno-lint-ignore no-explicit-any
      const enabled = prefs ? (prefs as any)[prefCol] !== false : true;
      if (!enabled) {
        return new Response(JSON.stringify({ skipped: "user_pref_disabled" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── 3. Fetch all push subscriptions for this user ──
    const { data: subs } = await supabase
      .from("user_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", payload.user_id);

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body ?? "",
      data: payload.data ?? {},
      tag: payload.type,
    });

    let pushSent = 0;
    let pushFailed = 0;
    const deadEndpoints: string[] = [];

    if (subs && subs.length > 0) {
      await Promise.all(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              pushPayload
            );
            pushSent++;
          } catch (err: unknown) {
            pushFailed++;
            // 404/410 means subscription is gone — clean it up
            // deno-lint-ignore no-explicit-any
            const status = (err as any)?.statusCode;
            if (status === 404 || status === 410) deadEndpoints.push(sub.endpoint);
            else console.error("Push send error:", err);
          }
        })
      );
    }

    // ── 4. Prune dead subscriptions ──
    if (deadEndpoints.length > 0) {
      await supabase
        .from("user_push_subscriptions")
        .delete()
        .eq("user_id", payload.user_id)
        .in("endpoint", deadEndpoints);
    }

    // ── 5. Email fallback (only when no push made it through) ──
    let emailSent = false;
    if (pushSent === 0 && RESEND_KEY && RESEND_FROM) {
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("email_fallback")
        .eq("user_id", payload.user_id)
        .maybeSingle();
      const emailEnabled = prefs ? (prefs.email_fallback !== false) : true;

      if (emailEnabled) {
        // Get user's email
        const { data: { user } } = await supabase.auth.admin.getUserById(payload.user_id);
        if (user?.email) {
          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_KEY}` },
              body: JSON.stringify({
                from: RESEND_FROM,
                to: user.email,
                subject: payload.title,
                text: payload.body ?? "",
                html: `<p style="font-family:sans-serif;font-size:15px">${payload.body ?? ""}</p><p style="font-size:13px;color:#666">— CampusLink</p>`,
              }),
            });
            emailSent = res.ok;
          } catch (err) {
            console.error("Resend email failed:", err);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, pushSent, pushFailed, emailSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

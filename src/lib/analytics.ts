// Lightweight client-side event tracking. Calls the track_event RPC,
// which validates the event type and uses auth.uid() server-side.
// All calls are fire-and-forget — analytics must never block the UI
// or surface errors.
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "cl-analytics-session";
const VIEWED_KEY = "cl-analytics-viewed";

const sessionId = (): string => {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
};

const viewedSet = (): Set<string> => {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(VIEWED_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

const markViewed = (key: string) => {
  const s = viewedSet();
  s.add(key);
  // cap so the array can't grow unbounded
  const arr = [...s].slice(-200);
  sessionStorage.setItem(VIEWED_KEY, JSON.stringify(arr));
};

const clientType = (): string => {
  if (typeof window === "undefined") return "web";
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return "pwa";
  } catch {
    /* matchMedia not available — default to web */
  }
  return "web";
};

export async function track(
  eventType: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    await supabase.rpc("track_event", {
      p_event_type: eventType,
      p_metadata: metadata,
      p_session_id: sessionId(),
      p_client: clientType(),
    });
  } catch (e) {
    if (typeof console !== "undefined") console.debug("analytics.track failed", e);
  }
}

// memo_viewed is deduped per memo per session — viewing the same memo twice
// in one session counts as one view.
export function trackMemoView(memoId: string, urgency: string) {
  const k = `mv:${memoId}`;
  if (viewedSet().has(k)) return;
  markViewed(k);
  void track("memo_viewed", { memo_id: memoId, urgency });
}

// session_open is fired once per browser session
export function trackSessionOpen() {
  const k = `so:${sessionId()}`;
  if (viewedSet().has(k)) return;
  markViewed(k);
  void track("session_open", {});
}

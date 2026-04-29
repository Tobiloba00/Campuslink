-- ════════════════════════════════════════════════════════════
-- Notifications system: Web Push subscriptions + in-app feed +
-- per-user prefs. Used by send-push edge function and cron jobs.
-- ════════════════════════════════════════════════════════════

-- pg_net is needed so DB triggers can call the send-push edge function
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ─── 1. Web Push subscriptions ───────────────────────────────
-- One row per (user, browser/device). User_agent helps us identify
-- old subscriptions to prune later.
CREATE TABLE IF NOT EXISTS public.user_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.user_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own push subscriptions"
  ON public.user_push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_sub_user
  ON public.user_push_subscriptions(user_id);

-- ─── 2. In-app notification feed ────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'message', 'comment', 'applicant', 'task_status',
    'task_assigned', 'reengagement', 'overdue', 'digest', 'like'
  )),
  title TEXT NOT NULL,
  body TEXT,
  data JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users mark their own notifications read"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT happens via service_role only (edge functions). No INSERT policy.

CREATE INDEX IF NOT EXISTS idx_notif_user_created
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON public.notifications(user_id) WHERE read_at IS NULL;

-- ─── 3. Per-user preferences + activity tracking ────────────
-- last_active_at drives the re-engagement cron. last_reengagement_sent_at
-- prevents us from spamming inactive users multiple times in a week.
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_messages BOOLEAN NOT NULL DEFAULT TRUE,
  push_comments BOOLEAN NOT NULL DEFAULT TRUE,
  push_applicants BOOLEAN NOT NULL DEFAULT TRUE,
  push_task_status BOOLEAN NOT NULL DEFAULT TRUE,
  push_reengagement BOOLEAN NOT NULL DEFAULT TRUE,
  email_fallback BOOLEAN NOT NULL DEFAULT TRUE,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_reengagement_sent_at TIMESTAMPTZ,
  last_overdue_sent_at TIMESTAMPTZ,
  last_digest_sent_at TIMESTAMPTZ
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read/update their own prefs"
  ON public.notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════
-- Analytics — append-only event log + daily rollup + cron.
-- Self-contained, idempotent. See spec in chat history for details.
-- ════════════════════════════════════════════════════════════

-- ─── 1. The hot layer: event log ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  session_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  client TEXT CHECK (client IN ('web','pwa','ios','android','server')) DEFAULT 'web',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Strict event-type whitelist
ALTER TABLE public.analytics_events DROP CONSTRAINT IF EXISTS analytics_events_type_check;
ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_type_check
  CHECK (event_type IN (
    'user_signup', 'user_login', 'session_open',
    'memo_created', 'memo_viewed', 'memo_explained', 'memo_action_taken',
    'discussion_started', 'reply_posted', 'reply_voted',
    'publisher_applied', 'publisher_approved', 'publisher_rejected',
    'report_submitted', 'report_resolved',
    'post_created', 'post_liked', 'comment_created',
    'message_sent', 'profile_updated'
  ));

CREATE INDEX IF NOT EXISTS idx_events_type_created
  ON public.analytics_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_school_created
  ON public.analytics_events(school_id, created_at DESC) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_user_created
  ON public.analytics_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_created
  ON public.analytics_events(created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_events_self_read ON public.analytics_events;
CREATE POLICY p_events_self_read ON public.analytics_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
-- No INSERT/UPDATE/DELETE policies — writes go through the RPC or triggers
-- (both SECURITY DEFINER so they bypass RLS deliberately).

-- ─── 2. The warm layer: daily rollup table ───────────────────
-- school_id is nullable so we can't use a normal PK; rely on an
-- expression unique index that treats NULL as a sentinel for platform-wide.
CREATE TABLE IF NOT EXISTS public.analytics_daily (
  day DATE NOT NULL,
  event_type TEXT NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  count INT NOT NULL DEFAULT 0,
  unique_users INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_unique
  ON public.analytics_daily (
    day, event_type,
    COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS idx_daily_day ON public.analytics_daily(day DESC);

ALTER TABLE public.analytics_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_daily_admin_read ON public.analytics_daily;
CREATE POLICY p_daily_admin_read ON public.analytics_daily FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ─── 3. track_event RPC (frontend writes) ────────────────────
CREATE OR REPLACE FUNCTION public.track_event(
  p_event_type TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_school_id UUID DEFAULT NULL,
  p_session_id UUID DEFAULT NULL,
  p_client TEXT DEFAULT 'web'
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN; END IF;

  -- Whitelist the events frontend may fire — backend events are gated to triggers.
  IF p_event_type NOT IN (
    'user_login', 'session_open', 'memo_viewed',
    'memo_explained', 'memo_action_taken'
  ) THEN
    RAISE EXCEPTION 'event_type % is server-side only', p_event_type;
  END IF;

  INSERT INTO public.analytics_events (user_id, event_type, school_id, session_id, metadata, client)
  VALUES (
    v_user,
    p_event_type,
    COALESCE(p_school_id, (SELECT school_id FROM public.profiles WHERE id = v_user)),
    p_session_id,
    COALESCE(p_metadata, '{}'::jsonb),
    COALESCE(p_client, 'web')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_event(TEXT, JSONB, UUID, UUID, TEXT) TO authenticated;

-- ─── 4. Trigger function (backend writes) ────────────────────
CREATE OR REPLACE FUNCTION public.tg_log_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event_type TEXT := TG_ARGV[0];
  v_meta JSONB := '{}'::jsonb;
  v_school UUID;
  v_user UUID;
BEGIN
  IF TG_TABLE_NAME = 'memos' THEN
    v_meta := jsonb_build_object('memo_id', NEW.id, 'urgency', NEW.urgency);
    v_school := NEW.school_id;
    -- memos.user_id doesn't exist directly; resolve via publisher
    SELECT user_id INTO v_user FROM public.publishers WHERE id = NEW.publisher_id;

  ELSIF TG_TABLE_NAME = 'publisher_applications' THEN
    v_meta := jsonb_build_object(
      'application_id', NEW.id,
      'requested_role', NEW.requested_role,
      'requested_scope', NEW.requested_scope
    );
    v_school := NEW.school_id;
    v_user := NEW.user_id;

  ELSIF TG_TABLE_NAME = 'memo_reports' THEN
    v_meta := jsonb_build_object(
      'target_type', NEW.target_type,
      'target_id', NEW.target_id,
      'reason', NEW.reason
    );
    v_user := NEW.reporter_id;

  ELSIF TG_TABLE_NAME = 'memo_discussions' THEN
    v_meta := jsonb_build_object('discussion_id', NEW.id, 'memo_id', NEW.memo_id);
    v_user := NEW.user_id;
    SELECT school_id INTO v_school FROM public.memos WHERE id = NEW.memo_id;

  ELSIF TG_TABLE_NAME = 'memo_replies' THEN
    v_meta := jsonb_build_object(
      'reply_id', NEW.id,
      'discussion_id', NEW.discussion_id,
      'is_publisher_reply', NEW.is_publisher_reply
    );
    v_user := NEW.user_id;

  ELSIF TG_TABLE_NAME = 'posts' THEN
    v_meta := jsonb_build_object('post_id', NEW.id, 'category', NEW.category);
    v_user := NEW.user_id;

  ELSIF TG_TABLE_NAME = 'post_likes' THEN
    v_meta := jsonb_build_object('post_id', NEW.post_id);
    v_user := NEW.user_id;

  ELSIF TG_TABLE_NAME = 'comments' THEN
    v_meta := jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id);
    v_user := NEW.user_id;

  ELSIF TG_TABLE_NAME = 'messages' THEN
    v_meta := jsonb_build_object('room_id', NEW.room_id);
    v_user := NEW.sender_id;
  END IF;

  INSERT INTO public.analytics_events (user_id, event_type, school_id, metadata, client)
  VALUES (v_user, v_event_type, v_school, v_meta, 'server');

  RETURN NEW;
END;
$$;

-- Wire triggers — server-side events
DROP TRIGGER IF EXISTS ev_memo_created ON public.memos;
CREATE TRIGGER ev_memo_created AFTER INSERT ON public.memos
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_event('memo_created');

DROP TRIGGER IF EXISTS ev_publisher_applied ON public.publisher_applications;
CREATE TRIGGER ev_publisher_applied AFTER INSERT ON public.publisher_applications
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_event('publisher_applied');

DROP TRIGGER IF EXISTS ev_report_submitted ON public.memo_reports;
CREATE TRIGGER ev_report_submitted AFTER INSERT ON public.memo_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_event('report_submitted');

DROP TRIGGER IF EXISTS ev_discussion_started ON public.memo_discussions;
CREATE TRIGGER ev_discussion_started AFTER INSERT ON public.memo_discussions
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_event('discussion_started');

DROP TRIGGER IF EXISTS ev_reply_posted ON public.memo_replies;
CREATE TRIGGER ev_reply_posted AFTER INSERT ON public.memo_replies
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_event('reply_posted');

DROP TRIGGER IF EXISTS ev_post_created ON public.posts;
CREATE TRIGGER ev_post_created AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_event('post_created');

DROP TRIGGER IF EXISTS ev_post_liked ON public.post_likes;
CREATE TRIGGER ev_post_liked AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_event('post_liked');

DROP TRIGGER IF EXISTS ev_comment_created ON public.comments;
CREATE TRIGGER ev_comment_created AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_event('comment_created');

DROP TRIGGER IF EXISTS ev_message_sent ON public.messages;
CREATE TRIGGER ev_message_sent AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_event('message_sent');

-- ─── 5. user_signup trigger (fires on auth.users) ────────────
CREATE OR REPLACE FUNCTION public.tg_log_user_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.analytics_events (user_id, event_type, metadata, client)
  VALUES (
    NEW.id,
    'user_signup',
    jsonb_build_object(
      'method',
      CASE WHEN NEW.raw_app_meta_data ? 'provider'
           THEN NEW.raw_app_meta_data->>'provider'
           ELSE 'email' END
    ),
    'server'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ev_user_signup ON auth.users;
CREATE TRIGGER ev_user_signup AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_log_user_signup();

-- ─── 6. Append publisher_approved / publisher_rejected to RPCs ──
-- Wrap the existing RPCs with analytics inserts. CREATE OR REPLACE is idempotent.
CREATE OR REPLACE FUNCTION public.approve_publisher_application(p_app_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app public.publisher_applications;
  v_pub_id UUID;
  v_caller UUID := auth.uid();
BEGIN
  IF NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_app FROM public.publisher_applications
   WHERE id = p_app_id AND status = 'pending';
  IF v_app.id IS NULL THEN RAISE EXCEPTION 'Application not found or not pending'; END IF;

  INSERT INTO public.publishers (
    user_id, school_id, role, scope, faculty_id, department_id, verified_by
  ) VALUES (
    v_app.user_id, v_app.school_id, v_app.requested_role,
    v_app.requested_scope, v_app.faculty_id, v_app.department_id, v_caller
  )
  ON CONFLICT (user_id, school_id) DO UPDATE
    SET role = EXCLUDED.role, scope = EXCLUDED.scope,
        faculty_id = EXCLUDED.faculty_id, department_id = EXCLUDED.department_id,
        status = 'active', restriction_reason = NULL, restricted_until = NULL,
        verified_by = EXCLUDED.verified_by, verified_at = NOW()
  RETURNING id INTO v_pub_id;

  UPDATE public.publisher_applications
     SET status = 'approved', reviewed_by = v_caller, reviewed_at = NOW()
   WHERE id = p_app_id;

  -- analytics
  INSERT INTO public.analytics_events (user_id, event_type, school_id, metadata, client)
  VALUES (
    v_caller, 'publisher_approved', v_app.school_id,
    jsonb_build_object(
      'publisher_id', v_pub_id,
      'application_id', p_app_id,
      'role', v_app.requested_role,
      'scope', v_app.requested_scope
    ),
    'server'
  );

  RETURN v_pub_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_publisher_application(p_app_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_school UUID;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT school_id INTO v_school FROM public.publisher_applications WHERE id = p_app_id;

  UPDATE public.publisher_applications
     SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = NOW(),
         rejection_reason = p_reason
   WHERE id = p_app_id AND status = 'pending';

  INSERT INTO public.analytics_events (user_id, event_type, school_id, metadata, client)
  VALUES (
    auth.uid(), 'publisher_rejected', v_school,
    jsonb_build_object('application_id', p_app_id, 'reason', p_reason),
    'server'
  );
END;
$$;

-- ─── 7. Rollup function ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_analytics_daily(p_window_minutes INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rows INT;
BEGIN
  WITH agg AS (
    SELECT
      created_at::date AS day,
      event_type,
      school_id,
      COUNT(*)::int AS count,
      COUNT(DISTINCT user_id)::int AS unique_users
    FROM public.analytics_events
    WHERE created_at >= NOW() - (p_window_minutes || ' minutes')::interval
    GROUP BY created_at::date, event_type, school_id
  )
  INSERT INTO public.analytics_daily (day, event_type, school_id, count, unique_users, updated_at)
  SELECT day, event_type, school_id, count, unique_users, NOW() FROM agg
  ON CONFLICT (day, event_type,
               COALESCE(school_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    count = EXCLUDED.count,
    unique_users = EXCLUDED.unique_users,
    updated_at = NOW();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

-- ─── 8. KPI helpers (admin-only convenience reads) ───────────
CREATE OR REPLACE FUNCTION public.kpi_dau(p_day DATE DEFAULT CURRENT_DATE)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(unique_users), 0)::int
  FROM public.analytics_daily
  WHERE event_type = 'session_open' AND day = p_day;
$$;

CREATE OR REPLACE FUNCTION public.kpi_memos_today()
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(count), 0)::int
  FROM public.analytics_daily
  WHERE event_type = 'memo_created' AND day = CURRENT_DATE;
$$;

GRANT EXECUTE ON FUNCTION public.kpi_dau(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kpi_memos_today() TO authenticated;

-- ─── 9. Cron — rollup every 15m, retention nightly ───────────
DO $$
BEGIN
  PERFORM cron.unschedule('analytics-rollup');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'analytics-rollup',
  '*/15 * * * *',
  $$ SELECT public.refresh_analytics_daily(30); $$
);

DO $$
BEGIN
  PERFORM cron.unschedule('analytics-retention');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'analytics-retention',
  '0 4 * * *',
  $$ DELETE FROM public.analytics_events WHERE created_at < NOW() - INTERVAL '180 days' $$
);

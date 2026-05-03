-- ════════════════════════════════════════════════════════════
-- Smart Memo System — full schema, RLS, functions, triggers.
-- Multi-tenant by school. Idempotent.
-- ════════════════════════════════════════════════════════════

-- ─── 1. Tenancy ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  country TEXT,
  domain TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.faculties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id UUID NOT NULL REFERENCES public.faculties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (faculty_id, name)
);

-- ─── 2. Extend profiles ──────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS faculty_id UUID REFERENCES public.faculties(id) ON DELETE SET NULL;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS level SMALLINT CHECK (level IN (100,200,300,400,500,600));

CREATE INDEX IF NOT EXISTS idx_profiles_school     ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_audience   ON public.profiles(school_id, faculty_id, department_id, level);

-- ─── 3. Publisher pipeline ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.publisher_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('student_union', 'school_admin')),
  requested_scope TEXT NOT NULL CHECK (requested_scope IN ('school', 'faculty', 'department')),
  faculty_id UUID REFERENCES public.faculties(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  proof_email TEXT,
  proof_screenshot_url TEXT,
  proof_whatsapp_link TEXT,
  proof_reference_name TEXT,
  applicant_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one pending application per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_pubapp_one_pending
  ON public.publisher_applications(user_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.publishers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('student_union', 'school_admin')),
  scope TEXT NOT NULL CHECK (scope IN ('school', 'faculty', 'department')),
  faculty_id UUID REFERENCES public.faculties(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  display_name TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restricted', 'revoked')),
  restriction_reason TEXT,
  restricted_until TIMESTAMPTZ,
  UNIQUE (user_id, school_id)
);

CREATE INDEX IF NOT EXISTS idx_publishers_school ON public.publishers(school_id, status);
CREATE INDEX IF NOT EXISTS idx_publishers_user ON public.publishers(user_id);

-- ─── 4. Memos ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE RESTRICT,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 4 AND 200),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 10 AND 10000),
  urgency TEXT NOT NULL DEFAULT 'general' CHECK (urgency IN ('urgent', 'important', 'general')),
  attachment_url TEXT,
  ai_summary TEXT,
  ai_required_action TEXT,
  ai_deadline TIMESTAMPTZ,
  ai_consequences TEXT,
  ai_processed_at TIMESTAMPTZ,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memos_school_urgency ON public.memos(school_id, urgency, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memos_publisher ON public.memos(publisher_id);
CREATE INDEX IF NOT EXISTS idx_memos_pending_ai ON public.memos(created_at DESC) WHERE ai_processed_at IS NULL;

-- ─── 5. Memo targets (declarative audience) ──────────────
CREATE TABLE IF NOT EXISTS public.memo_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id UUID NOT NULL REFERENCES public.memos(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('school', 'faculty', 'department', 'level')),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  faculty_id UUID REFERENCES public.faculties(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  level SMALLINT CHECK (level IN (100,200,300,400,500,600))
);

CREATE INDEX IF NOT EXISTS idx_memo_targets_memo ON public.memo_targets(memo_id);
CREATE INDEX IF NOT EXISTS idx_memo_targets_audience
  ON public.memo_targets(school_id, target_type, faculty_id, department_id, level);

-- ─── 6. Discussions + replies + votes ────────────────────
CREATE TABLE IF NOT EXISTS public.memo_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id UUID NOT NULL REFERENCES public.memos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL CHECK (length(question) BETWEEN 4 AND 500),
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discussions_memo ON public.memo_discussions(memo_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.memo_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES public.memo_discussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reply TEXT NOT NULL CHECK (length(reply) BETWEEN 1 AND 1000),
  is_publisher_reply BOOLEAN NOT NULL DEFAULT FALSE,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_replies_discussion ON public.memo_replies(discussion_id, helpful_count DESC, created_at);

CREATE TABLE IF NOT EXISTS public.memo_reply_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id UUID NOT NULL REFERENCES public.memo_replies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reply_id, user_id)
);

-- ─── 7. Reports ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.memo_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('memo', 'publisher', 'reply')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'misinformation', 'impersonation', 'harassment', 'other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  action_taken TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_target ON public.memo_reports(target_type, target_id, status);

-- ════════════════════════════════════════════════════════════
-- 8. Helper functions (SECURITY DEFINER — used by RLS)
-- ════════════════════════════════════════════════════════════

-- Returns true iff user can see a given memo. Used by SELECT RLS.
CREATE OR REPLACE FUNCTION public.user_can_see_memo(p_user UUID, p_memo UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  u_school UUID; u_faculty UUID; u_dept UUID; u_level SMALLINT;
BEGIN
  IF p_user IS NULL THEN RETURN FALSE; END IF;
  SELECT school_id, faculty_id, department_id, level
    INTO u_school, u_faculty, u_dept, u_level
  FROM public.profiles WHERE id = p_user;

  IF u_school IS NULL THEN RETURN FALSE; END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.memo_targets mt
    WHERE mt.memo_id = p_memo AND mt.school_id = u_school
      AND (
        mt.target_type = 'school'
        OR (mt.target_type = 'faculty'    AND mt.faculty_id    = u_faculty)
        OR (mt.target_type = 'department' AND mt.department_id = u_dept)
        OR (mt.target_type = 'level'      AND mt.level         = u_level)
      )
  );
END;
$$;

-- Active publisher record for the calling user, in a given school
CREATE OR REPLACE FUNCTION public.active_publisher_for(p_user UUID, p_school UUID)
RETURNS public.publishers
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM public.publishers
  WHERE user_id = p_user AND school_id = p_school
    AND status = 'active'
    AND (restricted_until IS NULL OR restricted_until < NOW())
  LIMIT 1;
$$;

-- Validate that a publisher can post to a given target row
CREATE OR REPLACE FUNCTION public.user_can_publish_to(
  p_publisher UUID,
  p_target_type TEXT,
  p_school UUID,
  p_faculty UUID,
  p_department UUID,
  p_level SMALLINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  pub public.publishers;
BEGIN
  SELECT * INTO pub FROM public.publishers
   WHERE id = p_publisher AND status = 'active'
     AND (restricted_until IS NULL OR restricted_until < NOW());

  IF pub.id IS NULL OR pub.school_id <> p_school THEN RETURN FALSE; END IF;

  IF pub.scope = 'school' THEN
    RETURN TRUE;
  ELSIF pub.scope = 'faculty' THEN
    -- Can target school-wide upward? No. Only their own faculty or below.
    IF p_target_type = 'school' THEN RETURN FALSE; END IF;
    IF pub.faculty_id IS NULL THEN RETURN FALSE; END IF;
    IF p_target_type = 'faculty'    AND p_faculty    = pub.faculty_id THEN RETURN TRUE; END IF;
    IF p_target_type = 'department' AND EXISTS (
       SELECT 1 FROM public.departments d
       WHERE d.id = p_department AND d.faculty_id = pub.faculty_id) THEN RETURN TRUE; END IF;
    IF p_target_type = 'level' AND TRUE THEN RETURN TRUE; END IF; -- level is school-wide intersect
    RETURN FALSE;
  ELSIF pub.scope = 'department' THEN
    IF p_target_type = 'school' OR p_target_type = 'faculty' THEN RETURN FALSE; END IF;
    IF p_target_type = 'department' AND p_department = pub.department_id THEN RETURN TRUE; END IF;
    IF p_target_type = 'level' THEN RETURN TRUE; END IF;
    RETURN FALSE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Maintain helpful_count on memo_replies as votes change
CREATE OR REPLACE FUNCTION public.tg_reply_vote_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.memo_replies SET helpful_count = helpful_count + 1 WHERE id = NEW.reply_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.memo_replies SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = OLD.reply_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reply_vote_count ON public.memo_reply_votes;
CREATE TRIGGER reply_vote_count
  AFTER INSERT OR DELETE ON public.memo_reply_votes
  FOR EACH ROW EXECUTE FUNCTION public.tg_reply_vote_count();

-- Mark reply as publisher reply when the user matches the memo's publisher
CREATE OR REPLACE FUNCTION public.tg_flag_publisher_reply()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_publisher_user UUID;
BEGIN
  SELECT p.user_id INTO v_publisher_user
  FROM public.memo_discussions d
  JOIN public.memos m ON d.memo_id = m.id
  JOIN public.publishers p ON m.publisher_id = p.id
  WHERE d.id = NEW.discussion_id;
  IF v_publisher_user IS NOT NULL AND v_publisher_user = NEW.user_id THEN
    NEW.is_publisher_reply := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS flag_publisher_reply ON public.memo_replies;
CREATE TRIGGER flag_publisher_reply
  BEFORE INSERT ON public.memo_replies
  FOR EACH ROW EXECUTE FUNCTION public.tg_flag_publisher_reply();

-- Auto-restrict publisher on 3 unresolved reports in 24h
CREATE OR REPLACE FUNCTION public.tg_auto_restrict_publisher()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT;
  v_publisher UUID;
BEGIN
  IF NEW.target_type = 'publisher' THEN
    v_publisher := NEW.target_id;
  ELSIF NEW.target_type = 'memo' THEN
    SELECT m.publisher_id INTO v_publisher FROM public.memos m WHERE m.id = NEW.target_id;
  ELSE
    RETURN NEW;
  END IF;

  IF v_publisher IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count
  FROM public.memo_reports r
  WHERE (
    (r.target_type = 'publisher' AND r.target_id = v_publisher)
    OR (r.target_type = 'memo' AND r.target_id IN
        (SELECT id FROM public.memos WHERE publisher_id = v_publisher))
  )
  AND r.status = 'pending'
  AND r.created_at > NOW() - INTERVAL '24 hours';

  IF v_count >= 3 THEN
    UPDATE public.publishers
       SET status = 'restricted',
           restriction_reason = 'Auto-restricted after 3+ reports in 24h',
           restricted_until = NOW() + INTERVAL '24 hours'
     WHERE id = v_publisher AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_restrict_publisher ON public.memo_reports;
CREATE TRIGGER auto_restrict_publisher
  AFTER INSERT ON public.memo_reports
  FOR EACH ROW EXECUTE FUNCTION public.tg_auto_restrict_publisher();

-- Trigger: fire AI processing edge function on memo INSERT (best-effort, async)
CREATE OR REPLACE FUNCTION public.tg_process_memo_ai()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_url TEXT := 'https://hthiaombwjumhkenasjt.supabase.co';
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  IF v_key IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/process-memo-ai',
    body := jsonb_build_object('memo_id', NEW.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    )
  );
  -- For urgent / important memos, also fan out push notifications
  IF NEW.urgency IN ('urgent', 'important') THEN
    PERFORM net.http_post(
      url := v_url || '/functions/v1/dispatch-memo-pushes',
      body := jsonb_build_object('memo_id', NEW.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_key
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS process_memo_ai ON public.memos;
CREATE TRIGGER process_memo_ai
  AFTER INSERT ON public.memos
  FOR EACH ROW EXECUTE FUNCTION public.tg_process_memo_ai();

-- updated_at maintenance
DROP TRIGGER IF EXISTS update_memos_updated_at ON public.memos;
CREATE TRIGGER update_memos_updated_at
  BEFORE UPDATE ON public.memos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ════════════════════════════════════════════════════════════
-- 9. Approval RPC — used by super-admin dashboard
-- ════════════════════════════════════════════════════════════
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

  SELECT * INTO v_app FROM public.publisher_applications WHERE id = p_app_id AND status = 'pending';
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

  RETURN v_pub_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_publisher_application(p_app_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.publisher_applications
     SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = NOW(),
         rejection_reason = p_reason
   WHERE id = p_app_id AND status = 'pending';
END;
$$;

-- ════════════════════════════════════════════════════════════
-- 10. RLS
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.schools                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publisher_applications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memos                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_targets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_discussions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_replies             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_reply_votes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_reports             ENABLE ROW LEVEL SECURITY;

-- Schools/faculties/departments: public read; admins manage
DROP POLICY IF EXISTS p_schools_read ON public.schools;
CREATE POLICY p_schools_read ON public.schools FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS p_schools_admin ON public.schools;
CREATE POLICY p_schools_admin ON public.schools FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS p_faculties_read ON public.faculties;
CREATE POLICY p_faculties_read ON public.faculties FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS p_faculties_admin ON public.faculties;
CREATE POLICY p_faculties_admin ON public.faculties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS p_departments_read ON public.departments;
CREATE POLICY p_departments_read ON public.departments FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS p_departments_admin ON public.departments;
CREATE POLICY p_departments_admin ON public.departments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Publisher applications: applicant reads own; admins read/manage all
DROP POLICY IF EXISTS p_pubapp_self_read ON public.publisher_applications;
CREATE POLICY p_pubapp_self_read ON public.publisher_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS p_pubapp_self_create ON public.publisher_applications;
CREATE POLICY p_pubapp_self_create ON public.publisher_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS p_pubapp_admin_update ON public.publisher_applications;
CREATE POLICY p_pubapp_admin_update ON public.publisher_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Publishers: anyone can see (for the verified badge); only admins manage
DROP POLICY IF EXISTS p_publishers_read ON public.publishers;
CREATE POLICY p_publishers_read ON public.publishers FOR SELECT USING (TRUE);
DROP POLICY IF EXISTS p_publishers_admin ON public.publishers;
CREATE POLICY p_publishers_admin ON public.publishers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Memos: visible only if user is in audience; insertable by their own publisher row
DROP POLICY IF EXISTS p_memos_read ON public.memos;
CREATE POLICY p_memos_read ON public.memos FOR SELECT TO authenticated
  USING (
    public.user_can_see_memo(auth.uid(), id)
    OR EXISTS (SELECT 1 FROM public.publishers p WHERE p.id = memos.publisher_id AND p.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS p_memos_insert ON public.memos;
CREATE POLICY p_memos_insert ON public.memos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.publishers p
      WHERE p.id = publisher_id
        AND p.user_id = auth.uid()
        AND p.school_id = memos.school_id
        AND p.status = 'active'
        AND (p.restricted_until IS NULL OR p.restricted_until < NOW())
    )
  );

DROP POLICY IF EXISTS p_memos_update ON public.memos;
CREATE POLICY p_memos_update ON public.memos FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.publishers p WHERE p.id = publisher_id AND p.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Memo targets: read same as memos; insert validated against publisher scope
DROP POLICY IF EXISTS p_targets_read ON public.memo_targets;
CREATE POLICY p_targets_read ON public.memo_targets FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.memos m WHERE m.id = memo_id) -- visibility cascades from memos via app-level join
  );

DROP POLICY IF EXISTS p_targets_insert ON public.memo_targets;
CREATE POLICY p_targets_insert ON public.memo_targets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.memos m
      JOIN public.publishers p ON m.publisher_id = p.id
      WHERE m.id = memo_id
        AND p.user_id = auth.uid()
        AND p.status = 'active'
        AND public.user_can_publish_to(p.id, target_type, school_id, faculty_id, department_id, level)
    )
  );

-- Discussions / replies / votes: anyone who can see the memo can see the discussion; auth users write
DROP POLICY IF EXISTS p_disc_read ON public.memo_discussions;
CREATE POLICY p_disc_read ON public.memo_discussions FOR SELECT TO authenticated
  USING (
    public.user_can_see_memo(auth.uid(), memo_id)
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS p_disc_insert ON public.memo_discussions;
CREATE POLICY p_disc_insert ON public.memo_discussions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.user_can_see_memo(auth.uid(), memo_id));

DROP POLICY IF EXISTS p_disc_update ON public.memo_discussions;
CREATE POLICY p_disc_update ON public.memo_discussions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS p_replies_read ON public.memo_replies;
CREATE POLICY p_replies_read ON public.memo_replies FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.memo_discussions d
            WHERE d.id = discussion_id AND public.user_can_see_memo(auth.uid(), d.memo_id))
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS p_replies_insert ON public.memo_replies;
CREATE POLICY p_replies_insert ON public.memo_replies FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.memo_discussions d
                WHERE d.id = discussion_id AND public.user_can_see_memo(auth.uid(), d.memo_id))
  );

DROP POLICY IF EXISTS p_replies_self_update ON public.memo_replies;
CREATE POLICY p_replies_self_update ON public.memo_replies FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS p_votes_read ON public.memo_reply_votes;
CREATE POLICY p_votes_read ON public.memo_reply_votes FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS p_votes_insert ON public.memo_reply_votes;
CREATE POLICY p_votes_insert ON public.memo_reply_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS p_votes_delete ON public.memo_reply_votes;
CREATE POLICY p_votes_delete ON public.memo_reply_votes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Reports: reporter reads own; admins read/manage all; auth users insert
DROP POLICY IF EXISTS p_reports_self_read ON public.memo_reports;
CREATE POLICY p_reports_self_read ON public.memo_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS p_reports_insert ON public.memo_reports;
CREATE POLICY p_reports_insert ON public.memo_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS p_reports_admin_update ON public.memo_reports;
CREATE POLICY p_reports_admin_update ON public.memo_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ════════════════════════════════════════════════════════════
-- 11. Realtime — surface memo + discussion live updates
-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND tablename = 'memos') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.memos';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND tablename = 'memo_discussions') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.memo_discussions';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND tablename = 'memo_replies') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.memo_replies';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- 12. Add 'memo' to notifications type CHECK
-- ════════════════════════════════════════════════════════════
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'message', 'comment', 'applicant', 'task_status',
    'task_assigned', 'reengagement', 'overdue', 'digest', 'like', 'memo'
  ));

-- ════════════════════════════════════════════════════════════
-- 13. Grant super-admin to the configured account if it exists
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'olujimitoben05@gmail.com';
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

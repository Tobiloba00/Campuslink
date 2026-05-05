-- ════════════════════════════════════════════════════════════
-- Allow publishers to apply with a school that doesn't exist yet.
-- The applicant types the school name; admin approval auto-creates
-- the schools row and links the application to it.
-- ════════════════════════════════════════════════════════════

-- 1. school_id can be NULL during the application phase (filled in
--    on approval if the school is brand new)
ALTER TABLE public.publisher_applications
  ALTER COLUMN school_id DROP NOT NULL;

ALTER TABLE public.publisher_applications
  ADD COLUMN IF NOT EXISTS proposed_school_name TEXT;

-- Must have either an existing school_id or a typed name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pubapp_school_or_proposal'
      AND conrelid = 'public.publisher_applications'::regclass
  ) THEN
    ALTER TABLE public.publisher_applications
      ADD CONSTRAINT pubapp_school_or_proposal
      CHECK (
        school_id IS NOT NULL
        OR (proposed_school_name IS NOT NULL AND length(trim(proposed_school_name)) >= 2)
      );
  END IF;
END $$;

-- 2. Slug helper — derives a unique slug from a typed school name
CREATE OR REPLACE FUNCTION public.slugify_school(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_base TEXT;
  v_slug TEXT;
  v_n INT := 0;
BEGIN
  v_base := lower(regexp_replace(coalesce(trim(p_name), ''), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  IF v_base = '' THEN v_base := 'school'; END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.schools WHERE slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  END LOOP;
  RETURN v_slug;
END;
$$;

-- 3. Updated approve RPC: if the application has a proposed name and no
--    existing school_id, auto-create the schools row first, then proceed.
CREATE OR REPLACE FUNCTION public.approve_publisher_application(p_app_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app public.publisher_applications;
  v_pub_id UUID;
  v_caller UUID := auth.uid();
  v_school_id UUID;
  v_school_name TEXT;
BEGIN
  IF NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_app FROM public.publisher_applications
   WHERE id = p_app_id AND status = 'pending';
  IF v_app.id IS NULL THEN
    RAISE EXCEPTION 'Application not found or not pending';
  END IF;

  -- Resolve the school: either the FK is already set, or we auto-create
  -- from the proposed name. Try a case-insensitive match against existing
  -- schools first so two applicants with the same school don't create
  -- duplicate rows.
  IF v_app.school_id IS NOT NULL THEN
    v_school_id := v_app.school_id;
  ELSIF v_app.proposed_school_name IS NOT NULL THEN
    SELECT id INTO v_school_id
      FROM public.schools
      WHERE lower(name) = lower(trim(v_app.proposed_school_name))
      LIMIT 1;

    IF v_school_id IS NULL THEN
      INSERT INTO public.schools (name, slug)
      VALUES (
        trim(v_app.proposed_school_name),
        public.slugify_school(v_app.proposed_school_name)
      )
      RETURNING id INTO v_school_id;
    END IF;

    -- Backfill the FK on the application for cleanliness in audit views
    UPDATE public.publisher_applications
       SET school_id = v_school_id
     WHERE id = p_app_id;
  ELSE
    RAISE EXCEPTION 'Application has no school';
  END IF;

  SELECT name INTO v_school_name FROM public.schools WHERE id = v_school_id;

  INSERT INTO public.publishers (
    user_id, school_id, role, scope, faculty_id, department_id, verified_by
  ) VALUES (
    v_app.user_id, v_school_id, v_app.requested_role,
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
    v_caller, 'publisher_approved', v_school_id,
    jsonb_build_object(
      'publisher_id', v_pub_id,
      'application_id', p_app_id,
      'role', v_app.requested_role,
      'scope', v_app.requested_scope,
      'school_auto_created', v_app.school_id IS NULL
    ),
    'server'
  );

  -- in-app notification
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_app.user_id,
    'task_status',
    'Application approved 🎉',
    'You can now publish official memos' ||
      CASE WHEN v_school_name IS NOT NULL THEN ' for ' || v_school_name ELSE '' END || '.',
    jsonb_build_object('url', '/memos/new', 'kind', 'publisher_approved')
  );

  RETURN v_pub_id;
END;
$$;

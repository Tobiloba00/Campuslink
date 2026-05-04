-- ════════════════════════════════════════════════════════════
-- Notify applicants when their publisher application changes state.
-- Extends the existing approve / reject RPCs with notification inserts
-- so the new "pending → approved / rejected" UX has something to surface.
-- Idempotent — pure CREATE OR REPLACE on the RPCs.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.approve_publisher_application(p_app_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app public.publisher_applications;
  v_pub_id UUID;
  v_caller UUID := auth.uid();
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

  SELECT name INTO v_school_name FROM public.schools WHERE id = v_app.school_id;

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
      'publisher_id', v_pub_id, 'application_id', p_app_id,
      'role', v_app.requested_role, 'scope', v_app.requested_scope
    ), 'server'
  );

  -- in-app notification to the applicant
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

CREATE OR REPLACE FUNCTION public.reject_publisher_application(p_app_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_app public.publisher_applications;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_app FROM public.publisher_applications
   WHERE id = p_app_id AND status = 'pending';
  IF v_app.id IS NULL THEN RETURN; END IF;

  UPDATE public.publisher_applications
     SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = NOW(),
         rejection_reason = p_reason
   WHERE id = p_app_id;

  -- analytics
  INSERT INTO public.analytics_events (user_id, event_type, school_id, metadata, client)
  VALUES (
    auth.uid(), 'publisher_rejected', v_app.school_id,
    jsonb_build_object('application_id', p_app_id, 'reason', p_reason), 'server'
  );

  -- in-app notification
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_app.user_id,
    'task_status',
    'Application not approved',
    COALESCE(p_reason, 'Your publisher application was not approved.'),
    jsonb_build_object('url', '/profile', 'kind', 'publisher_rejected')
  );
END;
$$;

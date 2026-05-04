-- ════════════════════════════════════════════════════════════
-- Admin role management — let super-admins promote / demote others.
-- Single SECURITY DEFINER RPC plus a self-demotion guard so an admin
-- can't accidentally lock everyone out.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_user_admin(
  p_user_id UUID,
  p_make_admin BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_remaining_admins INT;
BEGIN
  IF NOT public.has_role(v_caller, 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  -- Block accidental self-demotion
  IF NOT p_make_admin AND p_user_id = v_caller THEN
    RAISE EXCEPTION 'You cannot remove your own admin role';
  END IF;

  -- Block removing the last admin on the platform
  IF NOT p_make_admin THEN
    SELECT COUNT(*) INTO v_remaining_admins
      FROM public.user_roles
     WHERE role = 'admin' AND user_id <> p_user_id;
    IF v_remaining_admins = 0 THEN
      RAISE EXCEPTION 'Cannot remove the last admin on the platform';
    END IF;
  END IF;

  IF p_make_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
     WHERE user_id = p_user_id AND role = 'admin';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_admin(UUID, BOOLEAN) TO authenticated;

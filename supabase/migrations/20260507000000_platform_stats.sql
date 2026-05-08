-- ════════════════════════════════════════════════════════════
-- Aggregate platform stats for the public landing page.
--
-- The landing page used to do three separate `select count(*) head:true`
-- queries against profiles / posts / messages. messages is RLS-locked
-- to sender/receiver, so anon clients silently got 0 back regardless
-- of actual volume. Replace the trio with a single SECURITY DEFINER
-- RPC that runs as the function owner (postgres) and bypasses RLS so
-- the marketing surface always sees the real numbers.
--
-- Returns jsonb so we can extend it later without a signature change.
-- Only counts — no row data — so privacy is intact.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.platform_stats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  -- Note: posts has no is_archived column (it tracks state via `status`).
  -- For the marketing surface we just count every post that was ever
  -- created — total volume is the trust signal. memos does have an
  -- is_archived flag so we filter that.
  SELECT jsonb_build_object(
    'users',   (SELECT COUNT(*)::int FROM public.profiles),
    'posts',   (SELECT COUNT(*)::int FROM public.posts),
    'memos',   (SELECT COUNT(*)::int FROM public.memos WHERE COALESCE(is_archived, false) = false),
    'schools', (SELECT COUNT(*)::int FROM public.schools)
  );
$$;

GRANT EXECUTE ON FUNCTION public.platform_stats() TO anon, authenticated;

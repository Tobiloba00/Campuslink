-- ════════════════════════════════════════════════════════════
-- Schedules the cron edge functions. Requires:
--   ALTER DATABASE postgres SET app.supabase_url = '...';
--   ALTER DATABASE postgres SET app.service_role_key = '...';
--
-- Cron expressions are UTC.
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Helper to call a cron edge function
CREATE OR REPLACE FUNCTION public.call_cron_function(p_function TEXT)
RETURNS VOID AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  v_url := current_setting('app.supabase_url', TRUE);
  v_key := current_setting('app.service_role_key', TRUE);
  IF v_url IS NULL OR v_key IS NULL OR v_url = '' OR v_key = '' THEN
    RAISE NOTICE 'Cron skipped — app secrets not configured';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := v_url || '/functions/v1/' || p_function,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-engagement: every day at 17:00 UTC (~ early evening for Lagos / 1pm US ET)
SELECT cron.schedule(
  'campuslink-reengagement',
  '0 17 * * *',
  $$ SELECT public.call_cron_function('cron-reengagement') $$
);

-- Overdue task reminder: every day at 09:00 UTC
SELECT cron.schedule(
  'campuslink-overdue',
  '0 9 * * *',
  $$ SELECT public.call_cron_function('cron-overdue') $$
);

-- Weekly digest: Mondays at 08:00 UTC
SELECT cron.schedule(
  'campuslink-digest',
  '0 8 * * 1',
  $$ SELECT public.call_cron_function('cron-weekly-digest') $$
);

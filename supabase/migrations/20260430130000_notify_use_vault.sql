-- ════════════════════════════════════════════════════════════
-- Switch notify_send_push() from current_setting() (which requires
-- ALTER DATABASE — blocked on Supabase's hosted postgres role) to
-- Supabase Vault.
--
-- Before this migration runs, store the service-role key in Vault:
--
--   SELECT vault.create_secret(
--     '<service-role-key>',
--     'service_role_key',
--     'Service-role key for DB triggers calling edge functions'
--   );
--
-- The Supabase URL is hardcoded since it's already public (it ships in
-- the client bundle and in .env).
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_send_push(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::JSONB
) RETURNS VOID AS $$
DECLARE
  v_url TEXT := 'https://hthiaombwjumhkenasjt.supabase.co';
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  -- If the secret isn't loaded yet, log and skip silently. Triggers
  -- still complete normally; users just don't get a push.
  IF v_key IS NULL OR v_key = '' THEN
    RAISE NOTICE 'Push notification skipped — service_role_key missing from vault';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url || '/functions/v1/send-push',
    body := jsonb_build_object(
      'user_id', p_user_id,
      'type', p_type,
      'title', p_title,
      'body', p_body,
      'data', p_data
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, extensions;

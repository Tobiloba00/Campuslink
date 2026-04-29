-- ════════════════════════════════════════════════════════════
-- DB triggers that fire the send-push edge function via pg_net.
-- Requires app.supabase_url + app.service_role_key set on the DB:
--
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<project>.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<SERVICE_ROLE_KEY>';
-- ════════════════════════════════════════════════════════════

-- Helper: call the send-push edge function asynchronously
CREATE OR REPLACE FUNCTION public.notify_send_push(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_data JSONB DEFAULT '{}'::JSONB
) RETURNS VOID AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  v_url := current_setting('app.supabase_url', TRUE);
  v_key := current_setting('app.service_role_key', TRUE);

  -- If secrets aren't configured, log and skip silently
  IF v_url IS NULL OR v_key IS NULL OR v_url = '' OR v_key = '' THEN
    RAISE NOTICE 'Push notification skipped — app.supabase_url / app.service_role_key not configured';
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Trigger: new message → notify receiver ─────────────────
CREATE OR REPLACE FUNCTION public.trigger_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_sender_name TEXT;
BEGIN
  IF NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;

  PERFORM public.notify_send_push(
    NEW.receiver_id,
    'message',
    COALESCE(v_sender_name, 'Someone') || ' sent you a message',
    LEFT(COALESCE(NEW.message, '📷 Photo'), 100),
    jsonb_build_object('sender_id', NEW.sender_id, 'message_id', NEW.id, 'url', '/messages?userId=' || NEW.sender_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS message_notification ON public.messages;
CREATE TRIGGER message_notification
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_message_notification();

-- ─── Trigger: new comment → notify post owner (= applicant) ─
CREATE OR REPLACE FUNCTION public.trigger_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_post_owner UUID;
  v_post_title TEXT;
  v_commenter_name TEXT;
BEGIN
  SELECT user_id, title INTO v_post_owner, v_post_title FROM public.posts WHERE id = NEW.post_id;

  IF NEW.user_id = v_post_owner THEN
    RETURN NEW; -- don't notify yourself for replying to your own post
  END IF;

  SELECT name INTO v_commenter_name FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.notify_send_push(
    v_post_owner,
    'applicant',
    COALESCE(v_commenter_name, 'Someone') || ' wants to help',
    LEFT(v_post_title, 80),
    jsonb_build_object('post_id', NEW.post_id, 'commenter_id', NEW.user_id, 'comment_id', NEW.id, 'url', '/post/' || NEW.post_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS comment_notification ON public.comments;
CREATE TRIGGER comment_notification
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_comment_notification();

-- ─── Trigger: post status change → notify the assigned student ─
CREATE OR REPLACE FUNCTION public.trigger_task_status_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_name TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_owner_name FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.notify_send_push(
    NEW.assigned_to,
    'task_status',
    'Task ' || REPLACE(NEW.status, '_', ' '),
    COALESCE(v_owner_name, 'The owner') || ' moved "' || LEFT(NEW.title, 60) || '"',
    jsonb_build_object('post_id', NEW.id, 'status', NEW.status, 'url', '/post/' || NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS task_status_notification ON public.posts;
CREATE TRIGGER task_status_notification
  AFTER UPDATE OF status ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_task_status_notification();

-- ─── Trigger: task ASSIGNED (open → in_progress) → notify the chosen student ─
-- This is a separate notification type since the act of being picked deserves its own message
CREATE OR REPLACE FUNCTION public.trigger_task_assigned_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_name TEXT;
BEGIN
  -- Only fire when assigned_to went from NULL to something
  IF NEW.assigned_to IS NULL OR (OLD.assigned_to IS NOT NULL AND OLD.assigned_to = NEW.assigned_to) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_owner_name FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.notify_send_push(
    NEW.assigned_to,
    'task_assigned',
    'You were picked! 🎉',
    COALESCE(v_owner_name, 'The owner') || ' chose you for "' || LEFT(NEW.title, 60) || '"',
    jsonb_build_object('post_id', NEW.id, 'url', '/post/' || NEW.id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS task_assigned_notification ON public.posts;
CREATE TRIGGER task_assigned_notification
  AFTER UPDATE OF assigned_to ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_task_assigned_notification();

-- ─── Activity tracking (drives the re-engagement cron) ──────
CREATE OR REPLACE FUNCTION public.touch_user_activity(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id, last_active_at)
  VALUES (p_user_id, NOW())
  ON CONFLICT (user_id) DO UPDATE SET last_active_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trigger_touch_activity_post()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.touch_user_activity(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS touch_activity_post ON public.posts;
CREATE TRIGGER touch_activity_post
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_touch_activity_post();

CREATE OR REPLACE FUNCTION public.trigger_touch_activity_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.touch_user_activity(NEW.sender_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS touch_activity_message ON public.messages;
CREATE TRIGGER touch_activity_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_touch_activity_message();

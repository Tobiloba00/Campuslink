-- Notify post owners when their post gets liked.
-- Mirrors the existing comment / message trigger pattern.

CREATE OR REPLACE FUNCTION public.trigger_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_post_owner UUID;
  v_post_title TEXT;
  v_liker_name TEXT;
BEGIN
  SELECT user_id, title INTO v_post_owner, v_post_title
  FROM public.posts WHERE id = NEW.post_id;

  -- Don't notify yourself for liking your own post
  IF NEW.user_id = v_post_owner THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_liker_name FROM public.profiles WHERE id = NEW.user_id;

  PERFORM public.notify_send_push(
    v_post_owner,
    'like',
    COALESCE(v_liker_name, 'Someone') || ' liked your post',
    LEFT(COALESCE(v_post_title, ''), 80),
    jsonb_build_object(
      'post_id', NEW.post_id,
      'liker_id', NEW.user_id,
      'url', '/post/' || NEW.post_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS like_notification ON public.post_likes;
CREATE TRIGGER like_notification
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_like_notification();

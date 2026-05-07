-- ════════════════════════════════════════════════════════════
-- Persist replies and embed posts inside messages.
-- - reply_to_message_id: when a user replies to another message,
--   we now store which message they replied to so the bubble can
--   render the quoted excerpt for everyone (not just the sender).
-- - post_id: when a chat is opened from a post (Buy / I Can Help),
--   the FIRST message gets stamped with that post so the receiver
--   sees a post card embedded in the bubble — no more standalone
--   sticky header.
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON public.messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_post
  ON public.messages(post_id) WHERE post_id IS NOT NULL;

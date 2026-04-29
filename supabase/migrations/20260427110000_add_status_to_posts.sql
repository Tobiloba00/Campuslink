-- Tracks whether a posted task is still open, currently being worked on, or done.
-- Enables the "My Tasks" page tabs (Posted / In Progress / Completed) and lets
-- the feed hide already-claimed tasks.
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
CHECK (status IN ('open', 'in_progress', 'completed'));

CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);

-- Optional deadline for tasks/help requests. Renders as "Due Tomorrow"/"Due in N days" on cards.
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- Filter index: "Urgent" pill queries due_date BETWEEN now() AND now() + 48h
CREATE INDEX IF NOT EXISTS idx_posts_due_date ON public.posts(due_date) WHERE due_date IS NOT NULL;

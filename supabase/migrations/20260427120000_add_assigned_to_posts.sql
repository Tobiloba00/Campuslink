-- The student the owner picked to work on the task. NULL until owner moves
-- the post to 'in_progress' and chooses an applicant. Cleared if status
-- reverts to 'open'.
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_assigned_to ON public.posts(assigned_to) WHERE assigned_to IS NOT NULL;

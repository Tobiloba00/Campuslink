-- Add parent_id to comments for nested threading
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;

-- Create an index for performance on large threads
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);

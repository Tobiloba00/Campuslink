-- Add social features to comments table
ALTER TABLE public.comments 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reply_settings TEXT DEFAULT 'everyone',
ADD COLUMN IF NOT EXISTS reposts_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS quotes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bookmarks_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS self_thread BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS thread_position INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS possibly_sensitive BOOLEAN DEFAULT FALSE;

-- Add view_count to posts
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS reposts_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bookmarks_count INTEGER DEFAULT 0;

-- Create reposts table (Polymorphic: references posts or comments)
CREATE TABLE IF NOT EXISTS public.reposts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'repost' CHECK (type IN ('repost', 'quote')),
    quote_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    -- Ensure user can only repost/quote a specific post once
    CONSTRAINT unique_user_post_repost UNIQUE(user_id, post_id),
    -- Ensure user can only repost/quote a specific comment once
    CONSTRAINT unique_user_comment_repost UNIQUE(user_id, comment_id),
    -- Ensure it's either a post or a comment, not both or neither
    CONSTRAINT repost_target_check CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR 
        (post_id IS NULL AND comment_id IS NOT NULL)
    )
);

-- Create bookmarks table (Polymorphic: references posts or comments)
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_user_post_bookmark UNIQUE(user_id, post_id),
    CONSTRAINT unique_user_comment_bookmark UNIQUE(user_id, comment_id),
    CONSTRAINT bookmark_target_check CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL) OR 
        (post_id IS NULL AND comment_id IS NOT NULL)
    )
);

-- RPC for incrementing view counts
CREATE OR REPLACE FUNCTION public.increment_comment_view_count(cid UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.comments
  SET view_count = view_count + 1
  WHERE id = cid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_post_view_count(pid UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.posts
    SET view_count = view_count + 1
    WHERE id = pid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create comment_likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, comment_id)
);

-- Enable RLS
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Policies for comment_likes
CREATE POLICY "Anyone can view comment likes" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "Users can create/delete their own comment likes" ON public.comment_likes FOR ALL TO authenticated 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- Enable RLS
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Policies for reposts
CREATE POLICY "Anyone can view reposts" ON public.reposts FOR SELECT USING (true);
CREATE POLICY "Users can create/delete their own reposts" ON public.reposts FOR ALL TO authenticated 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- Policies for bookmarks
CREATE POLICY "Users can view their own bookmarks" ON public.bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create/delete their own bookmarks" ON public.bookmarks FOR ALL TO authenticated 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

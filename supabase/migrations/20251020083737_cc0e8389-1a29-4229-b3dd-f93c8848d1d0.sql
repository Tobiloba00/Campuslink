-- Add AI-generated fields to posts table
ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS tags text[],
ADD COLUMN IF NOT EXISTS match_suggestions jsonb,
ADD COLUMN IF NOT EXISTS campus_highlight text,
ADD COLUMN IF NOT EXISTS engagement_count integer DEFAULT 0;

-- Add skills and interests to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS skills text[],
ADD COLUMN IF NOT EXISTS interests text[],
ADD COLUMN IF NOT EXISTS year_of_study text;

-- Create index for better matching performance
CREATE INDEX IF NOT EXISTS idx_posts_tags ON posts USING GIN (tags);

-- Add profile_picture to conversation queries (already exists, just documenting)
COMMENT ON COLUMN profiles.profile_picture IS 'User profile picture URL';
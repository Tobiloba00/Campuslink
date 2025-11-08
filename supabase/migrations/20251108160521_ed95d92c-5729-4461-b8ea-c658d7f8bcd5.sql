-- Create chat_rooms table
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  type TEXT DEFAULT 'direct',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create room_participants junction table
CREATE TABLE IF NOT EXISTS public.room_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Add room_id column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE;

-- Add read_at column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NULL;

-- Enable RLS on new tables
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_rooms
DROP POLICY IF EXISTS "Users can view rooms they participate in" ON public.chat_rooms;
CREATE POLICY "Users can view rooms they participate in"
ON public.chat_rooms
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.room_participants
    WHERE room_participants.room_id = chat_rooms.id
    AND room_participants.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;
CREATE POLICY "Users can create rooms"
ON public.chat_rooms
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update rooms they participate in" ON public.chat_rooms;
CREATE POLICY "Users can update rooms they participate in"
ON public.chat_rooms
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.room_participants
    WHERE room_participants.room_id = chat_rooms.id
    AND room_participants.user_id = auth.uid()
  )
);

-- RLS Policies for room_participants
DROP POLICY IF EXISTS "Users can view participants in their rooms" ON public.room_participants;
CREATE POLICY "Users can view participants in their rooms"
ON public.room_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.room_participants rp
    WHERE rp.room_id = room_participants.room_id
    AND rp.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can add participants to rooms" ON public.room_participants;
CREATE POLICY "Users can add participants to rooms"
ON public.room_participants
FOR INSERT
WITH CHECK (true);

-- Update messages RLS policies
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.messages;
CREATE POLICY "Users can view messages in their rooms"
ON public.messages
FOR SELECT
USING (
  room_id IS NULL OR
  EXISTS (
    SELECT 1 FROM public.room_participants
    WHERE room_participants.room_id = messages.room_id
    AND room_participants.user_id = auth.uid()
  )
);

-- Update messages INSERT policy to work with room_id
DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.messages;
CREATE POLICY "Authenticated users can send messages"
ON public.messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON public.messages(read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_room_participants_room_id ON public.room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user_id ON public.room_participants(user_id);

-- Create trigger function to update chat_rooms.updated_at
CREATE OR REPLACE FUNCTION public.update_chat_room_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.room_id IS NOT NULL THEN
    UPDATE public.chat_rooms
    SET updated_at = NOW()
    WHERE id = NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on messages table
DROP TRIGGER IF EXISTS update_chat_room_on_message ON public.messages;
CREATE TRIGGER update_chat_room_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_chat_room_updated_at();
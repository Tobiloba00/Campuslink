-- Fix infinite recursion in room_participants RLS policy
-- The issue: The policy was querying room_participants from within the room_participants policy

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view participants in their rooms" ON room_participants;

-- Create a security definer function to check room membership without triggering RLS
CREATE OR REPLACE FUNCTION public.user_is_in_room(room_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_participants
    WHERE room_id = room_uuid AND user_id = user_uuid
  );
$$;

-- Create new policy using the security definer function (bypasses RLS, no recursion)
CREATE POLICY "Users can view participants in their rooms"
ON room_participants FOR SELECT
USING (user_is_in_room(room_id, auth.uid()));
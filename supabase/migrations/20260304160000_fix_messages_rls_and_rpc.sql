-- Create a function to handle room creation transactionally
-- This avoids RLS check conflicts where a user can't select a room they just created
-- because they aren't a participant yet.
CREATE OR REPLACE FUNCTION public.get_or_create_conversation_room(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_room_id UUID;
BEGIN
    -- 1. Check if a direct room already exists
    SELECT rp1.room_id INTO v_room_id
    FROM public.room_participants rp1
    JOIN public.room_participants rp2 ON rp1.room_id = rp2.room_id
    JOIN public.chat_rooms cr ON rp1.room_id = cr.id
    WHERE rp1.user_id = auth.uid()
    AND rp2.user_id = other_user_id
    AND cr.type = 'direct'
    LIMIT 1;

    -- 2. If no room exists, create one
    IF v_room_id IS NULL THEN
        INSERT INTO public.chat_rooms (type)
        VALUES ('direct')
        RETURNING id INTO v_room_id;

        -- 3. Add participants
        INSERT INTO public.room_participants (room_id, user_id)
        VALUES (v_room_id, auth.uid()), (v_room_id, other_user_id);
    END IF;

    RETURN v_room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update UPDATE policy for messages (read receipts fix)
DROP POLICY IF EXISTS "Users can update read status of received messages" ON public.messages;
CREATE POLICY "Users can update read status of received messages"
ON public.messages FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

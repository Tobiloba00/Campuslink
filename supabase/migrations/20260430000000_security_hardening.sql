-- Security hardening: tighten chat-room creation, add reviews edit/delete,
-- and document intent for the get_or_create_conversation_room flow.

-- ── 1. chat_rooms: only allow inserts via the SECURITY DEFINER RPC ──────────
-- The previous "Users can create rooms" policy let any authenticated user
-- insert a room directly with arbitrary fields. The RPC
-- get_or_create_conversation_room() already runs as SECURITY DEFINER
-- (bypassing RLS), so we can drop the open INSERT policy and force callers
-- through the RPC.
DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;

-- ── 2. room_participants: same story — restrict direct INSERTs ─────────────
-- Old policy was a blanket "Users can add participants to rooms" with
-- WITH CHECK (auth.uid() IS NOT NULL), which let any logged-in user join
-- any room. SECURITY DEFINER RPC handles the legitimate inserts.
DROP POLICY IF EXISTS "Users can add participants to rooms" ON public.room_participants;

-- ── 3. reviews: allow reviewers to edit / retract their own reviews ────────
-- Reviews were write-once because no UPDATE/DELETE policy existed.
DROP POLICY IF EXISTS "Reviewers can update their own reviews" ON public.reviews;
CREATE POLICY "Reviewers can update their own reviews"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Reviewers can delete their own reviews" ON public.reviews;
CREATE POLICY "Reviewers can delete their own reviews"
  ON public.reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = reviewer_id);

-- ── 4. messages: let senders delete their own messages ─────────────────────
-- Previously immutable from the client side. Owners should be able to
-- retract a message they sent.
DROP POLICY IF EXISTS "Senders can delete their own messages" ON public.messages;
CREATE POLICY "Senders can delete their own messages"
  ON public.messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- ── 5. Defensive guard inside get_or_create_conversation_room ─────────────
-- Prevent a user from creating a chat room with themselves (was previously
-- allowed and would inflate conversation counts).
CREATE OR REPLACE FUNCTION public.get_or_create_conversation_room(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF other_user_id = v_caller THEN
    RAISE EXCEPTION 'Cannot start a conversation with yourself';
  END IF;

  -- Look for an existing direct room containing exactly these two users.
  SELECT cr.id INTO v_room_id
  FROM public.chat_rooms cr
  WHERE cr.type = 'direct'
    AND EXISTS (SELECT 1 FROM public.room_participants WHERE room_id = cr.id AND user_id = v_caller)
    AND EXISTS (SELECT 1 FROM public.room_participants WHERE room_id = cr.id AND user_id = other_user_id)
    AND (SELECT COUNT(*) FROM public.room_participants WHERE room_id = cr.id) = 2
  LIMIT 1;

  IF v_room_id IS NOT NULL THEN
    RETURN v_room_id;
  END IF;

  -- Create the room and add both participants.
  INSERT INTO public.chat_rooms (type) VALUES ('direct') RETURNING id INTO v_room_id;
  INSERT INTO public.room_participants (room_id, user_id) VALUES (v_room_id, v_caller);
  INSERT INTO public.room_participants (room_id, user_id) VALUES (v_room_id, other_user_id);

  RETURN v_room_id;
END;
$$;

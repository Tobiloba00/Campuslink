-- Add missing UPDATE policy to messages table for read receipts
-- This allows users to mark messages sent to them as read

DROP POLICY IF EXISTS "Users can update read status of received messages" ON public.messages;

CREATE POLICY "Users can update read status of received messages"
ON public.messages FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

-- Migrate existing messages to room-based chat system

-- Step 1: Create chat rooms for all unique conversation pairs
WITH unique_conversations AS (
  SELECT DISTINCT
    LEAST(sender_id, receiver_id) as user1_id,
    GREATEST(sender_id, receiver_id) as user2_id,
    MIN(created_at) as first_message_at
  FROM messages
  WHERE sender_id IS NOT NULL AND receiver_id IS NOT NULL
  GROUP BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
)
INSERT INTO chat_rooms (type, created_at, updated_at)
SELECT 
  'direct',
  first_message_at,
  first_message_at
FROM unique_conversations;

-- Step 2: Add room participants
WITH unique_conversations AS (
  SELECT DISTINCT
    LEAST(sender_id, receiver_id) as user1_id,
    GREATEST(sender_id, receiver_id) as user2_id,
    MIN(created_at) as first_message_at
  FROM messages
  WHERE sender_id IS NOT NULL AND receiver_id IS NOT NULL
  GROUP BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
),
rooms_with_conv AS (
  SELECT 
    uc.user1_id,
    uc.user2_id,
    uc.first_message_at,
    cr.id as room_id,
    ROW_NUMBER() OVER (ORDER BY uc.first_message_at) as conv_num,
    ROW_NUMBER() OVER (ORDER BY cr.created_at) as room_num
  FROM unique_conversations uc
  CROSS JOIN chat_rooms cr
  WHERE cr.type = 'direct'
)
INSERT INTO room_participants (room_id, user_id, joined_at)
SELECT room_id, user1_id, first_message_at FROM rooms_with_conv WHERE conv_num = room_num
UNION ALL
SELECT room_id, user2_id, first_message_at FROM rooms_with_conv WHERE conv_num = room_num AND user1_id != user2_id;

-- Step 3: Update messages with room_id
WITH unique_conversations AS (
  SELECT DISTINCT
    LEAST(sender_id, receiver_id) as user1_id,
    GREATEST(sender_id, receiver_id) as user2_id,
    MIN(created_at) as first_message_at
  FROM messages
  WHERE sender_id IS NOT NULL AND receiver_id IS NOT NULL
  GROUP BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
),
rooms_with_conv AS (
  SELECT 
    uc.user1_id,
    uc.user2_id,
    cr.id as room_id,
    ROW_NUMBER() OVER (ORDER BY uc.first_message_at) as conv_num,
    ROW_NUMBER() OVER (ORDER BY cr.created_at) as room_num
  FROM unique_conversations uc
  CROSS JOIN chat_rooms cr
  WHERE cr.type = 'direct'
)
UPDATE messages m
SET room_id = rwc.room_id
FROM rooms_with_conv rwc
WHERE rwc.conv_num = rwc.room_num
  AND (
    (m.sender_id = rwc.user1_id AND m.receiver_id = rwc.user2_id) OR
    (m.sender_id = rwc.user2_id AND m.receiver_id = rwc.user1_id)
  );
// ============================================================================
// MESSAGING TYPE DEFINITIONS
// ============================================================================

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'failed';

export interface MessageReaction {
  emoji: string;
  userIds: string[];
  count: number;
}

export interface ReplyContext {
  messageId: string;
  senderName: string;
  text: string | null;
  imageUrl: string | null;
}

export interface MessagePostEmbed {
  id: string;
  title: string;
  image_url: string | null;
  optional_price: number | null;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string | null;
  image_url: string | null;
  created_at: string;
  room_id: string | null;
  read_at: string | null;
  status?: MessageStatus;
  tempId?: string;
  reactions?: MessageReaction[];
  replyTo?: ReplyContext;
  reply_to_message_id?: string | null;
  post_id?: string | null;
  /** Hydrated from the join — present when this message was sent in the
   *  context of a post (e.g. Buy / I Can Help on a feed card). */
  post?: MessagePostEmbed | null;
}

export interface Conversation {
  userId: string;
  userName: string;
  lastMessage: string;
  timestamp: string;
  profilePicture?: string | null;
  roomId: string;
  unreadCount: number;
}

export interface UserProfile {
  id: string;
  name: string;
  profile_picture: string | null;
  rating: number;
  course: string | null;
  bio?: string | null;
  email?: string;
}

export interface PostContext {
  id: string;
  title: string;
  description: string;
  category: string;
  user_id: string;
  image_url?: string | null;
  optional_price?: number | null;
  profiles?: {
    name: string;
    course: string | null;
  };
}

export interface CurrentUser {
  id: string;
  email?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

export interface MessageGroup {
  date: string;
  messages: Message[];
}

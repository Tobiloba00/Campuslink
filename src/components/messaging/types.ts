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

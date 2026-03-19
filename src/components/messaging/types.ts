// Messaging Type Definitions
// Eliminates all 'any' types for type safety

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string | null;
  image_url: string | null;
  created_at: string;
  room_id: string | null;
  read_at: string | null;
  status?: 'sending' | 'sent' | 'delivered' | 'failed'; // For optimistic UI
  tempId?: string; // For optimistic updates
}

export interface Conversation {
  userId: string;
  userName: string;
  lastMessage: string;
  timestamp: string;
  profilePicture?: string | null;
  roomId: string;
  unreadCount?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  profile_picture: string | null;
  rating: number;
  course: string | null;
  bio: string | null;
  email: string;
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

export interface MessageGroup {
  date: string;
  messages: Message[];
}

export interface MessagingState {
  currentUser: any | null; // From Supabase Auth
  conversations: Conversation[];
  selectedConversation: string | null;
  selectedUserProfile: UserProfile | null;
  messages: Message[];
  selectedRoomId: string | null;
  onlineUsers: Set<string>;
  typingUsers: Set<string>;
  postContext: PostContext | null;
  aiSuggestions: string[];
}

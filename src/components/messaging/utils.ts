// ============================================================================
// MESSAGING UTILITIES
// Shared formatting, validation, and helper functions
// ============================================================================

import { Message, MessageGroup } from './types';

export const formatMessageDate = (date: Date): string => {
  const now = new Date();
  const messageDate = new Date(date);

  if (messageDate.toDateString() === now.toDateString()) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (messageDate.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return messageDate.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: messageDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};

export const formatRelativeTime = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const groupMessagesByDate = (messages: Message[]): MessageGroup[] => {
  const groups: MessageGroup[] = [];
  messages.forEach(msg => {
    const dateStr = formatMessageDate(new Date(msg.created_at));
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.date === dateStr) {
      lastGroup.messages.push(msg);
    } else {
      groups.push({ date: dateStr, messages: [msg] });
    }
  });
  return groups;
};

export const isValidImageFile = (file: File): boolean => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024;
};

export const playNotificationSound = (): void => {
  try {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch {
    // Audio not supported
  }
};

export const detectLinks = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

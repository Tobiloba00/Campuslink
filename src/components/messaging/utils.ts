// Messaging Utilities
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

export const detectLinks = (text: string): string[] => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.match(urlRegex) || [];
};

export const playNotificationSound = (shouldPlay: boolean): void => {
  if (!shouldPlay) return;

  try {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(err => console.log('Could not play sound:', err));
  } catch (error) {
    console.log('Audio not supported');
  }
};

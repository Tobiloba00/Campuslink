// Hook for offline message queue with IndexedDB persistence
import { useState, useEffect, useCallback, useRef } from 'react';
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Message } from '@/components/messaging/types';

interface MessageQueueDB extends DBSchema {
  'pending-messages': {
    key: string;
    value: {
      id: string;
      message: Partial<Message>;
      timestamp: number;
    };
  };
}

export const useMessageQueue = (isOnline: boolean) => {
  const [queuedMessages, setQueuedMessages] = useState<Partial<Message>[]>([]);
  const dbRef = useRef<IDBPDatabase<MessageQueueDB> | null>(null);

  useEffect(() => {
    const initDB = async () => {
      dbRef.current = await openDB<MessageQueueDB>('message-queue', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('pending-messages')) {
            db.createObjectStore('pending-messages', { keyPath: 'id' });
          }
        },
      });
      await loadQueuedMessages();
    };
    initDB();
  }, []);

  const loadQueuedMessages = async () => {
    if (!dbRef.current) return;
    const all = await dbRef.current.getAll('pending-messages');
    setQueuedMessages(all.map(item => item.message));
  };

  const addToQueue = useCallback(async (message: Partial<Message>) => {
    if (!dbRef.current) return;

    const queueItem = {
      id: message.tempId || crypto.randomUUID(),
      message,
      timestamp: Date.now()
    };

    await dbRef.current.add('pending-messages', queueItem);
    setQueuedMessages(prev => [...prev, message]);
  }, []);

  const removeFromQueue = useCallback(async (messageId: string) => {
    if (!dbRef.current) return;

    await dbRef.current.delete('pending-messages', messageId);
    setQueuedMessages(prev => prev.filter(m => m.tempId !== messageId));
  }, []);

  const clearQueue = useCallback(async () => {
    if (!dbRef.current) return;

    await dbRef.current.clear('pending-messages');
    setQueuedMessages([]);
  }, []);

  return {
    queuedMessages,
    addToQueue,
    removeFromQueue,
    clearQueue
  };
};

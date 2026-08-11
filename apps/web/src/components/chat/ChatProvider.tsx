'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { auth, db } from './firebase';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  where,
  getDocs,
  updateDoc,
  doc
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { getUserDoc, AppUser } from '@/lib/fb';

interface ChatMessage {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  text: string;
  timestamp: any;
  read: boolean;
  type: 'user' | 'support';
}

interface ChatContextType {
  messages: ChatMessage[];
  unreadCount: number;
  sendMessage: (text: string) => Promise<void>;
  markAsRead: () => Promise<void>;
  isOpen: boolean;
  toggleChat: () => void;
  openChat: () => void;
  closeChat: () => void;
  user: User | null;
  appUser: AppUser | null;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Use your existing Firebase auth
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        const userData = await getUserDoc(user.uid);
        setAppUser(userData);
        console.log('👤 ChatProvider: User loaded:', user.uid, 'AppUser:', userData?.displayName);
      } else {
        setAppUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen for messages in real-time from Firestore
  useEffect(() => {
    if (!user) {
      console.log('🟡 ChatProvider: No user, clearing messages');
      setMessages([]);
      setUnreadCount(0);
      return;
    }

    console.log('🟡 ChatProvider: Setting up listener for user:', user.uid);

    // ✅ FIXED: Only query messages where uid matches the current user
    const q = query(
      collection(db, 'chats'),
      where('uid', '==', user.uid),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(
      q, 
      (snapshot) => {
        console.log('📨 ChatProvider: Snapshot received! Size:', snapshot.size);
        const newMessages: ChatMessage[] = [];
        let unread = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          const msg = { id: doc.id, ...data } as ChatMessage;
          newMessages.push(msg);
          console.log('📄 Message:', msg.text?.slice(0, 30), 'Type:', msg.type, 'UID:', msg.uid);

          // Count unread support messages for this user
          if (data.type === 'support' && data.uid === user.uid && !data.read) {
            unread++;
          }
        });

        console.log('📨 ChatProvider: Total messages:', newMessages.length);
        setMessages(newMessages);
        setUnreadCount(unread);

        if (isOpen && unread > 0) {
          markAsRead();
        }
      },
      (error) => {
        console.error('❌ ChatProvider: Error in snapshot listener:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      console.log('🧹 ChatProvider: Cleaning up listener');
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user, isOpen]);

  const sendMessage = async (text: string) => {
    if (!user) {
      console.error('❌ ChatProvider: No user logged in');
      throw new Error('Please log in to chat');
    }
    if (!text.trim()) {
      console.error('❌ ChatProvider: Empty message');
      return;
    }

    const displayName = appUser?.displayName || user.displayName || user.email?.split('@')[0] || 'Trader';
    console.log('📤 ChatProvider: Sending message:', { uid: user.uid, displayName, text: text.trim() });

    try {
      const docRef = await addDoc(collection(db, 'chats'), {
        uid: user.uid,
        email: user.email || 'anonymous',
        displayName: displayName,
        text: text.trim(),
        timestamp: serverTimestamp(),
        read: false,
        type: 'user'
      });
      console.log('✅ ChatProvider: Message sent with ID:', docRef.id);
    } catch (error) {
      console.error('❌ ChatProvider: Error sending message:', error);
      throw error;
    }
  };

  const markAsRead = async () => {
    if (!user) return;

    try {
      const q = query(
        collection(db, 'chats'),
        where('uid', '==', user.uid),
        where('type', '==', 'support'),
        where('read', '==', false)
      );

      const snapshot = await getDocs(q);
      const updates = snapshot.docs.map((docSnap) =>
        updateDoc(doc(db, 'chats', docSnap.id), { read: true })
      );

      await Promise.all(updates);
      setUnreadCount(0);
      console.log('✅ ChatProvider: Marked messages as read');
    } catch (error) {
      console.error('❌ ChatProvider: Error marking messages as read:', error);
    }
  };

  const toggleChat = () => setIsOpen(!isOpen);
  const openChat = () => setIsOpen(true);
  const closeChat = () => setIsOpen(false);

  return (
    <ChatContext.Provider
      value={{
        messages,
        unreadCount,
        sendMessage,
        markAsRead,
        isOpen,
        toggleChat,
        openChat,
        closeChat,
        user,
        appUser,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
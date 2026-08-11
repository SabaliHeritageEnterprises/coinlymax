'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/components/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
  where,
  getDocs
} from 'firebase/firestore';

interface Message {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  text: string;
  timestamp: any;
  read: boolean;
  type: 'user' | 'support';
  replyToUid?: string; // ✅ ADDED: Track which user this reply is for
}

export default function AdminChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null); // ✅ ADDED: Track selected user

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      console.log('👤 Auth state changed:', user?.email);
      setUser(user);
      if (user) {
        const checkAdminStatus = async () => {
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();
            console.log('👤 User role:', userData?.role);
            setIsAdmin(userData?.role === 'admin' || userData?.role === 'super_admin');
          } catch (error) {
            console.error('Error checking admin status:', error);
            setIsAdmin(false);
          }
          setLoading(false);
        };
        checkAdminStatus();
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !isAdmin) {
      console.log('⛔ Not listening: user=', !!user, 'isAdmin=', isAdmin);
      return;
    }

    console.log('🔍 Setting up Firestore listener for chats...');

    const q = query(
      collection(db, 'chats'),
      orderBy('timestamp', 'asc')
    );

    const unsub = onSnapshot(
      q, 
      (snapshot) => {
        console.log('📨 Snapshot received! Size:', snapshot.size);
        const msgs: Message[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          console.log('📄 Document data:', data);
          msgs.push({ id: doc.id, ...data } as Message);
        });
        console.log('📨 Total messages:', msgs.length);
        setMessages(msgs);
      },
      (error) => {
        console.error('❌ Snapshot listener error:', error);
      }
    );

    return () => {
      console.log('🧹 Cleaning up chat listener');
      unsub();
    };
  }, [user, isAdmin]);

  // ✅ NEW: Handle individual user reply
  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user) return;
    
    // ✅ Check if a user is selected
    if (!selectedUser) {
      alert('Please select a user from the list to reply to');
      return;
    }

    // ✅ Find the selected user's info
    const userMessages = messages.filter(msg => msg.uid === selectedUser);
    const lastUserMsg = userMessages.find(msg => msg.type === 'user');
    const displayName = lastUserMsg?.displayName || 'User';

    try {
      const docRef = await addDoc(collection(db, 'chats'), {
        uid: user.uid,
        email: user.email || 'support@apextrade.com',
        displayName: `Support (to ${displayName})`,
        text: input.trim(),
        timestamp: serverTimestamp(),
        read: false,
        type: 'support',
        replyToUid: selectedUser, // ✅ Track which user this reply is for
        replyToName: displayName
      });
      console.log('✅ Reply sent to user:', selectedUser, 'ID:', docRef.id);
      setInput('');
      
      // ✅ Mark user's messages as read
      await markUserMessagesAsRead(selectedUser);
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Failed to send reply. Please try again.');
    }
  };

  const markUserMessagesAsRead = async (userId: string) => {
    try {
      const q = query(
        collection(db, 'chats'),
        where('uid', '==', userId),
        where('type', '==', 'user'),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);
      const updates = snapshot.docs.map((docSnap) =>
        updateDoc(doc(db, 'chats', docSnap.id), { read: true })
      );
      await Promise.all(updates);
      console.log(`✅ Marked ${updates.length} messages as read for user ${userId}`);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // ✅ Get unique users from messages
  const uniqueUsers = messages.reduce((acc, msg) => {
    if (msg.type === 'user' && !acc.find(u => u.uid === msg.uid)) {
      acc.push({ uid: msg.uid, displayName: msg.displayName, email: msg.email });
    }
    return acc;
  }, [] as { uid: string; displayName: string; email: string }[]);

  // ✅ Filter messages for selected user
  const filteredMessages = selectedUser 
    ? messages.filter(msg => msg.uid === selectedUser || (msg.type === 'support' && msg.replyToUid === selectedUser))
    : messages;

  // ✅ Get user's unread count
  const getUnreadCount = (uid: string) => {
    return messages.filter(m => m.uid === uid && m.type === 'user' && !m.read).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        Loading chat...
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        You don't have permission to view this page.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ✅ Show selected user info */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-400">
          {selectedUser 
            ? `💬 Replying to: ${uniqueUsers.find(u => u.uid === selectedUser)?.displayName || 'User'}`
            : '👤 Select a user from the list to reply'}
        </h3>
        {selectedUser && (
          <button
            onClick={() => setSelectedUser(null)}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            ✕ Clear selection
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* User List */}
        <div className="bg-[#15181d] rounded-xl border border-[#23272f] p-4 max-h-[500px] overflow-y-auto">
          <h2 className="font-semibold text-sm text-gray-400 mb-3">
            Users ({uniqueUsers.length})
          </h2>
          {uniqueUsers.length === 0 ? (
            <p className="text-gray-500 text-sm">No users have messaged yet.</p>
          ) : (
            uniqueUsers.map((u) => {
              const unreadCount = getUnreadCount(u.uid);
              const isSelected = selectedUser === u.uid;
              return (
                <div
                  key={u.uid}
                  onClick={() => setSelectedUser(isSelected ? null : u.uid)}
                  className={`
                    p-3 rounded-lg mb-2 cursor-pointer transition-colors
                    ${isSelected 
                      ? 'bg-gold/20 border border-gold' 
                      : 'hover:bg-[#23272f]'
                    }
                    ${unreadCount > 0 ? 'border-l-2 border-yellow-500' : ''}
                  `}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm text-white">
                      {u.displayName || u.email || 'Unknown'}
                    </span>
                    {unreadCount > 0 && (
                      <span className="bg-yellow-500 text-black text-xs rounded-full px-2 py-0.5">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {u.email || 'No email'}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Messages */}
        <div className="lg:col-span-2 bg-[#15181d] rounded-xl border border-[#23272f] p-4 max-h-[500px] overflow-y-auto">
          <h2 className="font-semibold text-sm text-gray-400 mb-3">
            {selectedUser 
              ? `Messages with ${uniqueUsers.find(u => u.uid === selectedUser)?.displayName || 'User'}`
              : 'All Messages'
            }
            ({filteredMessages.length})
          </h2>
          {filteredMessages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {selectedUser ? 'No messages with this user yet.' : 'No messages yet'}
            </div>
          ) : (
            filteredMessages.map((msg) => {
              const isUser = msg.type === 'user';
              const isSupport = msg.type === 'support';
              return (
                <div key={msg.id} className="mb-3 p-3 bg-[#0a0b0d] rounded-lg border border-[#23272f]">
                  <div className="flex justify-between text-sm">
                    <span className={`font-medium ${
                      isUser ? 'text-blue-400' : 'text-yellow-500'
                    }`}>
                      {isUser ? `👤 ${msg.displayName || msg.email}` : `🟡 ${msg.displayName || 'Support'}`}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {msg.timestamp?.toDate?.()?.toLocaleString() || 'Just now'}
                    </span>
                  </div>
                  <div className="mt-1 text-white text-sm">{msg.text}</div>
                  <div className="mt-1 flex gap-2">
                    {isUser && !msg.read && (
                      <span className="text-xs text-yellow-500">🟡 Unread</span>
                    )}
                    {isSupport && msg.replyToUid && (
                      <span className="text-xs text-gray-500">
                        → to {uniqueUsers.find(u => u.uid === msg.replyToUid)?.displayName || 'User'}
                      </span>
                    )}
                    {isSupport && !msg.replyToUid && (
                      <span className="text-xs text-gray-500">→ All users</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Reply Input */}
      <div className="bg-[#15181d] rounded-xl border border-[#23272f] p-4">
        <form onSubmit={handleReply} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              selectedUser 
                ? `Reply to ${uniqueUsers.find(u => u.uid === selectedUser)?.displayName || 'User'}...`
                : 'Select a user from the list to reply...'
            }
            disabled={!selectedUser}
            className={`flex-1 bg-[#0a0b0d] border rounded-lg px-4 py-3 text-white focus:outline-none ${
              selectedUser 
                ? 'border-[#23272f] focus:border-yellow-500' 
                : 'border-[#23272f] opacity-50 cursor-not-allowed'
            }`}
          />
          <button
            type="submit"
            disabled={!selectedUser || !input.trim()}
            className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Reply
          </button>
        </form>
      </div>
    </div>
  );
}
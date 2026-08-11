'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChat } from './ChatProvider';

export function ChatWidget() {
  const { user, isOpen, toggleChat, unreadCount, messages } = useChat();

  console.log('💬 ChatWidget: Rendering with messages:', messages.length, 'user:', user?.uid);

  // Only show chat to logged-in users
  if (!user) return null;

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black rounded-full w-14 h-14 flex items-center justify-center text-2xl shadow-lg hover:scale-110 transition-transform duration-200 hover:shadow-yellow-500/50"
        aria-label="Open chat"
      >
        💬
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && <ChatWindow />}
    </>
  );
}

function ChatWindow() {
  const { messages, sendMessage, closeChat, unreadCount, markAsRead, user, appUser } = useChat();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  console.log('💬 ChatWindow: Rendering with', messages.length, 'messages');

  // Mark messages as read when window opens
  useEffect(() => {
    if (unreadCount > 0) {
      markAsRead();
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(input);
      setInput('');
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Get user display name
  const userDisplayName = appUser?.displayName || user?.displayName || user?.email?.split('@')[0] || 'You';

  // Filter messages to show only user's messages and support replies
  const userMessages = messages.filter(msg => 
    msg.uid === user?.uid || msg.type === 'support'
  );

  console.log('💬 ChatWindow: User messages after filter:', userMessages.length);

  return (
    <div className="fixed bottom-24 right-6 z-50 w-96 max-h-[540px] bg-[#15181d] rounded-2xl border border-[#23272f] shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-[#111317] px-4 py-3 border-b border-[#23272f] flex justify-between items-center">
        <div className="flex items-center gap-3">
          <span className="text-xl">💬</span>
          <div>
            <div className="font-semibold text-sm text-white">Support Chat</div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-400 rounded-full inline-block"></span>
              <span className="text-xs text-gray-400">Online</span>
            </div>
          </div>
        </div>
        <button
          onClick={closeChat}
          className="text-gray-400 hover:text-white transition-colors text-xl"
          aria-label="Close chat"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[340px] min-h-[300px]">
        {userMessages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            No messages yet. Start a conversation!
          </div>
        ) : (
          userMessages.slice(-50).map((msg) => {
            const isSupport = msg.type === 'support';
            const isOwn = msg.uid === user?.uid;
            const align = isSupport ? 'items-start' : 'items-end';
            const bg = isSupport ? 'bg-[#23272f]' : isOwn ? 'bg-yellow-500' : 'bg-gray-600';
            const textColor = isSupport ? 'text-white' : isOwn ? 'text-black' : 'text-white';
            const sender = isSupport ? 'Support' : (msg.displayName || 'You');
            const time = msg.timestamp?.toDate?.() || new Date();

            return (
              <div key={msg.id} className={`flex flex-col ${align} gap-1`}>
                <div className="text-xs text-gray-500 px-1">
                  {sender} · {time.toLocaleTimeString()}
                </div>
                <div
                  className={`${bg} ${textColor} px-3 py-2 rounded-2xl max-w-[85%] break-words text-sm`}
                  style={{
                    borderBottomLeftRadius: isSupport ? '4px' : '12px',
                    borderBottomRightRadius: isSupport ? '12px' : '4px',
                  }}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-[#111317] border-t border-[#23272f] flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message as ${userDisplayName}...`}
          className="flex-1 bg-[#0a0b0d] border border-[#23272f] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
        />
        <button
          type="submit"
          disabled={sending}
          className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {sending ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
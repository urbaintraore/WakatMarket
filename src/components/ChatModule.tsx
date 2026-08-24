import React from 'react';
import { ChatLayout } from './chat/ChatLayout';
import { UserProfile, ChatMessage } from '../types';

interface ChatModuleProps {
  currentUser: UserProfile;
  users: UserProfile[];
  messages?: ChatMessage[];
  onSendMessage?: (receiverId: string, text: string) => void;
}

export default function ChatModule({ currentUser, users, messages = [], onSendMessage }: ChatModuleProps) {
  console.log(`[ChatModule] Rendered for user: ${currentUser?.id} (${currentUser?.name}) | Users count: ${users?.length || 0} | Messages count: ${messages?.length || 0}`);

  return (
    <div className="w-full h-[600px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden flex shadow-sm">
      <ChatLayout currentUser={currentUser} users={users} />
    </div>
  );
}

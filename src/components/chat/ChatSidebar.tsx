import React, { useState } from 'react';
import { Search, Plus, MessageSquare, Users } from 'lucide-react';
import { Conversation, UserProfile } from '../../types';
import { useAuthContext } from '../../context/AuthContext';
import { db } from '../../data';

interface ChatSidebarProps {
  currentUser?: UserProfile | null;
  conversations: Conversation[];
  users: UserProfile[];
  activeConvId: string | null;
  onSelectConversation: (id: string) => void;
  onStartNewChat: () => void;
}

export function ChatSidebar({ currentUser: propCurrentUser, conversations, users, activeConvId, onSelectConversation, onStartNewChat }: ChatSidebarProps) {
  const { dbUser } = useAuthContext();
  const currentUser = propCurrentUser || (dbUser ? {
    id: dbUser.uid,
    name: `${dbUser.prénom} ${dbUser.nom}`,
    email: dbUser.email,
    role: dbUser.rôle as any,
    phone: dbUser.téléphone || '',
    avatar: dbUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    country: dbUser.pays || "Côte d'Ivoire",
    status: "ACTIVE" as const,
    region: dbUser.région || "Abidjan"
  } : null);

  const [searchTerm, setSearchTerm] = useState('');

  const getUserDetails = (userId: string) => users.find(u => u.id === userId) || db.getUsers().find(u => u.id === userId);

  const getConvDisplay = (conv: Conversation) => {
    if (conv.type === "GROUP") {
      return {
        key: `group-${conv.id}`,
        name: conv.groupName || "Groupe",
        image: conv.groupImage || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150",
        isGroup: true
      };
    } else {
      const parts = Array.isArray(conv.participants)
        ? conv.participants
        : (typeof conv.participants === "string" ? JSON.parse((conv.participants as any) || "[]") : []);
      const otherUserId = parts.find((p: string) => p !== currentUser?.id);
      const otherUser = getUserDetails(otherUserId || "");
      const normEmail = otherUser?.email ? otherUser.email.toLowerCase().trim() : "";
      const normCompany = otherUser?.companyName ? otherUser.companyName.toLowerCase().trim() : "";
      const key = normEmail || normCompany || otherUserId || conv.id;
      return {
        key,
        name: otherUser?.companyName || otherUser?.name || conv.groupName || "Partenaire B2B",
        image: otherUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        isGroup: false,
        role: otherUser?.role
      };
    }
  };

  const uniqueConvsMap = new Map<string, Conversation>();
  conversations.forEach(conv => {
    const display = getConvDisplay(conv);
    if (!uniqueConvsMap.has(display.key)) {
      uniqueConvsMap.set(display.key, conv);
    } else {
      const existing = uniqueConvsMap.get(display.key)!;
      const existingTime = new Date(existing.lastMessageDate || existing.updatedAt || 0).getTime();
      const currentTime = new Date(conv.lastMessageDate || conv.updatedAt || 0).getTime();
      if (currentTime > existingTime) {
        uniqueConvsMap.set(display.key, conv);
      }
    }
  });

  const uniqueConvs = Array.from(uniqueConvsMap.values());

  const filteredConvs = uniqueConvs.filter(conv => {
    const display = getConvDisplay(conv);
    return display.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="w-full md:w-80 lg:w-96 bg-white border-r border-gray-200 flex flex-col h-full overflow-hidden shrink-0 dark:bg-slate-900 dark:border-slate-800">
      <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Messages</h2>
        <button 
          onClick={onStartNewChat}
          className="p-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm flex items-center justify-center cursor-pointer"
          title="Nouvelle conversation"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="p-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher une conversation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredConvs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-700 mb-3" />
            <p className="text-sm font-medium">Aucune conversation trouvée</p>
            <p className="text-xs text-gray-400 mt-1">Cliquez sur le bouton + en haut pour démarrer une discussion.</p>
          </div>
        ) : (
          filteredConvs.map(conv => {
            const display = getConvDisplay(conv);
            const unread = conv.unreadCount[currentUser?.id || ""] || 0;
            const isSelected = activeConvId === conv.id;

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full p-4 flex items-center gap-3 border-b border-gray-100 dark:border-slate-800 transition-colors text-left ${
                  isSelected ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="relative shrink-0">
                  <img 
                    src={display.image} 
                    alt={display.name}
                    className="w-12 h-12 rounded-full object-cover bg-gray-200 border border-gray-200 dark:border-slate-700"
                  />
                  {display.isGroup && (
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-0.5">
                      <div className="bg-emerald-500 rounded-full p-1 text-white">
                        <Users size={10} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                      {display.name}
                    </h3>
                    {conv.lastMessageDate && (
                      <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                        {new Date(conv.lastMessageDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <p className={`text-xs truncate ${unread > 0 ? 'text-gray-900 font-semibold dark:text-gray-200' : 'text-gray-500'}`}>
                      {conv.lastMessage || "Nouvelle conversation"}
                    </p>
                    {unread > 0 && (
                      <span className="shrink-0 ml-2 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

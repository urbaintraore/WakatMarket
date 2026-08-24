import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../context/AuthContext';
import { chatService } from '../../services/chatService';
import { connectionService } from '../../services/connectionService';
import { Conversation, UserProfile, Connection } from '../../types';
import { db } from '../../data';
import { ChatSidebar } from './ChatSidebar';
import { ChatWindow } from './ChatWindow';
import { Search, X, MessageSquare, User } from 'lucide-react';

interface ChatLayoutProps {
  currentUser?: UserProfile | null;
  users: UserProfile[];
}

export function ChatLayout({ currentUser: propCurrentUser, users }: ChatLayoutProps) {
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

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchUserQuery, setSearchUserQuery] = useState('');

  useEffect(() => {
    if (currentUser) {
      const unsubscribeChat = chatService.subscribeToUserConversations(currentUser.id, (convs) => {
        setConversations(convs);
      });
      const unsubscribeConn = connectionService.subscribeToUserConnections(currentUser.id, (conns) => {
        setConnections(conns);
      });
      return () => {
        unsubscribeChat();
        unsubscribeConn();
      };
    }
  }, [currentUser?.id]);

  const getAllowedChatPartners = () => {
    if (!currentUser) return [];
    let list: UserProfile[] = [];
    if (currentUser.role === 'ADMIN') {
      list = users.filter(u => u.id !== currentUser.id);
    } else {
      const activeConns = connections.filter(c => {
        const st = (c.status || (c as any).statut || "").toLowerCase();
        return st === "active" || st === "actif";
      });

      const allKnownUsers = db.getUsers();
      activeConns.forEach(c => {
        const partnerId = c.senderId === currentUser.id ? c.receiverId : c.senderId;
        if (partnerId && partnerId !== currentUser.id) {
          const found = users.find(u => u.id === partnerId) || allKnownUsers.find(u => u.id === partnerId);
          if (found) {
            list.push(found);
          } else {
            const partnerName = c.senderId === currentUser.id ? c.receiverName : c.senderName;
            const partnerRole = c.senderId === currentUser.id ? c.receiverRole : c.senderRole;
            list.push({
              id: partnerId,
              name: partnerName || "Partenaire B2B",
              companyName: partnerName || "Entreprise Partenaire",
              role: (partnerRole as any) || "SEMI_WHOLESALER",
              email: "",
              phone: "",
              country: "Burkina Faso",
              region: "Ouagadougou",
              status: "ACTIVE",
              avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
            });
          }
        }
      });
    }

    const map = new Map<string, UserProfile>();
    list.forEach(u => {
      if (u.id !== currentUser.id && !map.has(u.id)) {
        map.set(u.id, u);
      }
    });

    return Array.from(map.values());
  };

  const allowedPartners = getAllowedChatPartners();
  const filteredPartners = allowedPartners.filter(u => {
    const query = searchUserQuery.toLowerCase();
    const nameMatch = u.name ? u.name.toLowerCase().includes(query) : false;
    const companyMatch = u.companyName ? u.companyName.toLowerCase().includes(query) : false;
    const roleMatch = u.role ? u.role.toLowerCase().includes(query) : false;
    return nameMatch || companyMatch || roleMatch;
  });

  const handleStartNewChat = () => {
    if (!currentUser) {
      alert("Veuillez vous connecter pour démarrer une discussion.");
      return;
    }
    setShowNewChatModal(true);
  };

  const handleSelectUserToChat = async (otherUser: UserProfile) => {
    if (!currentUser) return;
    try {
      const convId = await chatService.getOrCreatePrivateConversation(currentUser.id, otherUser.id);
      if (convId) {
        setActiveConvId(convId);
        setShowNewChatModal(false);
        setSearchUserQuery('');
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la création de la conversation.");
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-300';
      case 'MANUFACTURER': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300';
      case 'WHOLESALER': return 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300';
      case 'SEMI_WHOLESALER': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300';
      case 'RETAILER': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300';
      case 'CLIENT': return 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300';
      default: return 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'Administrateur';
      case 'MANUFACTURER': return 'Usine / Fabricant';
      case 'WHOLESALER': return 'Grossiste';
      case 'SEMI_WHOLESALER': return 'Demi-Grossiste';
      case 'RETAILER': return 'Détaillant / Épicerie';
      case 'CLIENT': return 'Client Final';
      default: return 'Livreur / Transporteur';
    }
  };

  const activeConv = conversations.find(c => c.id === activeConvId);

  return (
    <div className="flex h-full bg-white dark:bg-slate-900 overflow-hidden shadow-lg border border-gray-100 dark:border-slate-800 rounded-2xl relative w-full">
      {/* View logic for Mobile vs Desktop */}
      <div className={`w-full md:w-auto h-full ${activeConvId ? 'hidden md:flex' : 'flex'}`}>
        <ChatSidebar 
          currentUser={currentUser}
          conversations={conversations} 
          users={users} 
          activeConvId={activeConvId}
          onSelectConversation={setActiveConvId}
          onStartNewChat={handleStartNewChat}
        />
      </div>

      <div className={`flex-1 h-full ${!activeConvId ? 'hidden md:flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-950/50' : 'flex'}`}>
        {activeConv ? (
          <ChatWindow 
            conversation={activeConv} 
            users={users}
            onBack={() => setActiveConvId(null)}
          />
        ) : (
          <div className="text-center text-gray-500 max-w-sm px-6">
            <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-light text-gray-800 dark:text-gray-200 mb-2">WakatChat</h2>
            <p className="text-sm">Sélectionnez une conversation ou cliquez sur le bouton <span className="font-bold text-emerald-600">+</span> pour contacter un partenaire.</p>
          </div>
        )}
      </div>

      {/* New Chat Modal with User Search */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-500" /> Nouvelle Discussion
              </h3>
              <button 
                onClick={() => { setShowNewChatModal(false); setSearchUserQuery(''); }}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-3 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher par nom, entreprise, rôle..."
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-900 dark:text-white"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredPartners.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <User className="mx-auto w-10 h-10 text-zinc-300 dark:text-zinc-700 mb-2" />
                  <p className="text-sm">Aucun utilisateur trouvé</p>
                  <p className="text-xs text-zinc-400 mt-1">Essayez un autre terme de recherche.</p>
                </div>
              ) : (
                filteredPartners.map(partner => (
                  <button
                    key={partner.id}
                    onClick={() => handleSelectUserToChat(partner)}
                    className="w-full p-3 flex items-center gap-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left border border-zinc-100 dark:border-zinc-800/60"
                  >
                    <img 
                      src={partner.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"} 
                      alt={partner.name}
                      className="w-11 h-11 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shrink-0" 
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-zinc-900 dark:text-white truncate">
                        {partner.companyName || partner.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${getRoleBadge(partner.role)}`}>
                          {getRoleLabel(partner.role)}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{partner.name}</span>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-lg shrink-0">
                      Discuter
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../context/AuthContext';
import { chatService } from '../../services/chatService';
import { connectionService } from '../../services/connectionService';
import { Conversation, UserProfile, Connection, isConnectionActive, normalizeUserRole } from '../../types';
import { db } from '../../data';
import { userService, UserProfileData } from '../../services/userService';
import { ChatSidebar } from './ChatSidebar';
import { ChatWindow } from './ChatWindow';
import { Search, X, MessageSquare, User, UserPlus, CheckCircle2, Bell } from 'lucide-react';

// Persistance locale des demandes de partenariat envoyées depuis le chat,
// afin que l'état "Envoyée" survive au rechargement (clé par utilisateur).
const sentRequestsKey = (userId: string) => `wakat_erp_v2_sent_requests_${userId}`;
function loadSentRequests(userId: string): Record<string, { partnerId: string; sentAt: string }> {
  try {
    return JSON.parse(localStorage.getItem(sentRequestsKey(userId)) || "{}") || {};
  } catch {
    return {};
  }
}

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
  const [marketUsers, setMarketUsers] = useState<UserProfile[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [partnersRequested, setPartnersRequested] = useState<Record<string, boolean>>({});
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);
  const hydratedConnRef = React.useRef(false);
  const toastedConnIdsRef = React.useRef<Set<string>>(new Set());

  // Index complet des profils du marché (recherche de partenaires au-delà des
  // contacts existants) — paginé par userService.getAllUsers (cache 5 min).
  useEffect(() => {
    let cancelled = false;
    if (currentUser) {
      if (currentUser) {
        const persisted = loadSentRequests(currentUser.id);
        setPartnersRequested(
          Object.values(persisted).reduce<Record<string, boolean>>((acc, entry) => {
            if (entry?.partnerId) acc[entry.partnerId] = true;
            return acc;
          }, {})
        );
      }
      setMarketLoading(true);
      userService
        .getAllUsers()
        .then((rows) => {
          if (cancelled) return;
          const mapped = (rows || []).map((p: UserProfileData): UserProfile => ({
            id: p.id || p.uid,
            name: [p.prénom, p.nom].filter(Boolean).join(' ').trim() || p.companyName || p.nomDEntreprise || 'Utilisateur',
            email: p.email,
            phone: p.téléphone || p.phone || '',
            role: normalizeUserRole(p.rôle || p.role || ''),
            status: 'ACTIVE',
            companyName: p.companyName || p.nomDEntreprise,
            avatar: p.logoUrl || '',
            country: p.pays || "Burkina Faso",
            region: p.ville || ''
          }));
          setMarketUsers(mapped);
          setMarketLoading(false);
        })
        .catch(() => {
          if (!cancelled) setMarketLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

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
    return users.filter(u => {
      if (u.id === currentUser.id) return false;
      const conn = connections.find(c => 
        (c.senderId === currentUser.id && c.receiverId === u.id) ||
        (c.senderId === u.id && c.receiverId === currentUser.id)
      );
      return !!conn && isConnectionActive(conn);
    });
  };

  const allowedPartners = getAllowedChatPartners();

  // Demandes envoyées en attente, dérivées des vraies connexions (survit à un reload).
  const pendingSentPartnerIds = React.useMemo(() => {
    if (!currentUser?.id) return new Set<string>();
    const s = new Set<string>();
    connections.forEach(c => {
      const statut = String((c as any).statut || c.status || "").toLowerCase();
      if (c.senderId === currentUser.id && (c.status === "en_attente" || statut === "pending" || statut === "en_attente" || statut === "p"))
        s.add(c.receiverId);
    });
    return s;
  }, [connections, currentUser?.id]);

  // Annuaire complet : profils distants (index marché) complétés par les données locales.
  const searchDirectory = React.useMemo(() => {
    const map = new Map<string, UserProfile>();
    marketUsers.forEach((u) => map.set(u.id, u));
    users.forEach((u) => map.set(u.id, u));
    const all = Array.from(map.values()).filter((u) => u.id !== currentUser?.id);
    const partnerIds = new Set(allowedPartners.map((p) => p.id));
    return all.sort((a, b) => (partnerIds.has(b.id) ? 1 : 0) - (partnerIds.has(a.id) ? 1 : 0));
  }, [marketUsers, users, allowedPartners, currentUser?.id]);

  const filteredPartners = searchDirectory.filter(u => {
    const query = searchUserQuery.toLowerCase();
    const nameMatch = u.name ? u.name.toLowerCase().includes(query) : false;
    const companyMatch = u.companyName ? u.companyName.toLowerCase().includes(query) : false;
    const emailMatch = u.email ? u.email.toLowerCase().includes(query) : false;
    const phoneMatch = u.phone ? u.phone.replace(/[^0-9+]/g, '').includes(query.replace(/[^0-9+]/g, '')) : false;
    const roleMatch = u.role ? u.role.toLowerCase().includes(query) : false;
    return nameMatch || companyMatch || emailMatch || phoneMatch || roleMatch;
  });

  // Demandes de partenariat REÇUES en attente (côté destinataire) — affichées
  // sous forme de bannière dans le chat pour qu'elles soient impossibles à rater.
  const pendingReceived = React.useMemo(() => {
    if (!currentUser?.id) return [] as { connection: Connection; partner?: UserProfile }[];
    const result: { connection: Connection; partner?: UserProfile }[] = [];
    connections.forEach(c => {
      const statut = String((c as any).statut || c.status || "").toLowerCase();
      const isPending = c.status === "en_attente" || statut === "pending" || statut === "p";
      if (c.receiverId === currentUser.id && isPending) {
        const partner = searchDirectory.find(u => u.id === c.senderId);
        result.push({ connection: c, partner });
      }
    });
    return result;
  }, [connections, currentUser?.id, searchDirectory]);

  // Toast à l'arrivée d'une nouvelle demande reçue (une fois par demande).
  React.useEffect(() => {
    if (!currentUser?.id || !hydratedConnRef.current) {
      hydratedConnRef.current = true;
      return;
    }
    pendingReceived.forEach(({ connection, partner }) => {
      if (toastedConnIdsRef.current.has(connection.id)) return;
      toastedConnIdsRef.current.add(connection.id);
      const nom = partner?.companyName || partner?.name || "Un partenaire B2B";
      setToastMsg(`Nouvelle demande de partenariat de ${nom}`);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 6000);
    });
  }, [pendingReceived, currentUser?.id]);

  const handleRelance = async (senderId: string, receiverId: string, nomCible: string) => {
    const relationId = [senderId, receiverId].sort().join("_");
    try {
      await connectionService.relancerDemande(relationId);
      alert(`Relance envoyée à ${nomCible}. Le destinataire est averti à nouveau.`);
    } catch (e: any) {
      if (e?.status === 429) {
        alert(e?.details?.error || "Relance déjà envoyée récemment. Réessayez dans une minute.");
      } else {
        console.error(e);
        alert("Relance impossible pour le moment (backend indisponible ?). Réessayez plus tard.");
      }
    }
  };

  const handleAcceptRequest = async (conn: Connection, partner?: UserProfile) => {
    if (!currentUser) return;
    try {
      await connectionService.acceptConnection(conn.id, currentUser.id);
      if (partner) {
        try {
          const convId = await chatService.getOrCreatePrivateConversation(currentUser.id, partner.id);
          if (convId) setActiveConvId(convId);
        } catch (e) {
          console.error("Ouverture de la conversation après acceptation:", e);
        }
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'acceptation du partenariat.");
    }
  };

  const handleRefuseRequest = async (conn: Connection) => {
    if (!currentUser) return;
    if (!window.confirm("Refuser cette demande de partenariat ?")) return;
    try {
      await connectionService.rejectConnection(conn.id, currentUser.id);
    } catch (e) {
      console.error(e);
      alert("Erreur lors du refus de la demande.");
    }
  };

  const handleStartNewChat = () => {
    if (!currentUser) {
      alert("Veuillez vous connecter pour démarrer une discussion.");
      return;
    }
    setSearchUserQuery('');
    setShowNewChatModal(true);
  };

  const handleSelectUserToChat = async (otherUser: UserProfile) => {
    if (!currentUser) return;
    const isPartner = allowedPartners.some(p => p.id === otherUser.id);
    if (isPartner) {
      try {
        const convId = await chatService.getOrCreatePrivateConversation(currentUser.id, otherUser.id);
        if (convId) {
          setActiveConvId(convId);
          setShowNewChatModal(false);
          setSearchUserQuery('');
          return;
        }
      } catch (e) {
        console.error(e);
        alert("Erreur lors de la création de la conversation.");
        return;
      }
      return;
    }

    // Pas encore partenaire → envoyer une demande de partenariat (MVP réseau B2B).
    const nomCible = otherUser.companyName || otherUser.name;
    if (partnersRequested[otherUser.id] || pendingSentPartnerIds.has(otherUser.id)) {
      const relance = window.confirm(
        `Une demande de partenariat est déjà en attente chez ${nomCible}.\n\n` +
        `Voulez-vous envoyer une relance pour le prévenir à nouveau ?\n` +
        `(1 relance max toutes les 60 secondes)\n\n` +
        `Pour suivre le statut : Tableau de bord → Partenaires → « En attente ».`
      );
      if (relance) await handleRelance(currentUser.id, otherUser.id, nomCible);
      return;
    }
    const init = window.confirm(
      `Envoyer une demande de partenariat à ${nomCible} ?\nLe chat s'ouvrira une fois la demande acceptée.`
    );
    if (!init) return;
    try {
      await connectionService.sendConnectionRequest(currentUser, otherUser);
      setPartnersRequested((prev) => ({ ...prev, [otherUser.id]: true }));
      try {
        const persisted = loadSentRequests(currentUser.id);
        persisted[otherUser.id] = { partnerId: otherUser.id, sentAt: new Date().toISOString() };
        localStorage.setItem(sentRequestsKey(currentUser.id), JSON.stringify(persisted));
      } catch { /* best-effort */ }
      alert(`Demande de partenariat envoyée à ${nomCible} (en attente de confirmation).`);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'envoi de la demande de partenariat.");
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
        <div className="flex flex-col w-full md:w-80 lg:w-96 h-full overflow-hidden relative">
          {pendingReceived.length > 0 && (
            <div className="shrink-0 p-3 bg-amber-50 dark:bg-amber-950/40 border-b-2 border-amber-200 dark:border-amber-900/50 space-y-2 z-10">
              {pendingReceived.map(({ connection, partner }) => (
                <div key={connection.id} className="rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/60 p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <img
                      src={partner?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"}
                      alt={partner?.name || "Partenaire"}
                      className="w-9 h-9 rounded-full object-cover border border-amber-200 shrink-0 bg-gray-100"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {partner?.companyName || partner?.name || "Un partenaire B2B"}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {partner ? getRoleLabel(partner.role) : "Partenariat"} — demande de partenariat reçue
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleAcceptRequest(connection, partner)}
                      className="flex-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg py-2 transition-colors"
                    >
                      Accepter
                    </button>
                    <button
                      onClick={() => handleRefuseRequest(connection)}
                      className="flex-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-lg py-2 transition-colors"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 min-h-0 relative">
            <ChatSidebar 
              currentUser={currentUser}
              conversations={conversations} 
              users={users} 
              activeConvId={activeConvId}
              onSelectConversation={setActiveConvId}
              onStartNewChat={handleStartNewChat}
            />
          </div>
        </div>
      </div>

      {/* Toast d'arrivée de nouvelle demande de partenariat */}
      {toastMsg && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top fade-in">
          <div className="flex items-center gap-2 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg border border-emerald-500/40">
            <Bell className="w-4 h-4 text-emerald-400 shrink-0" /> {toastMsg}
          </div>
        </div>
      )}

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
                  placeholder="Rechercher par nom, entreprise, email, téléphone..."
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-900 dark:text-white"
                  autoFocus
                />
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2">
                Partenaires actifs en premier — les autres profils peuvent être invités en demande de partenariat.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {marketLoading && filteredPartners.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <div className="mx-auto mb-3 w-8 h-8 border-2 border-zinc-300 dark:border-zinc-600 border-t-emerald-500 rounded-full animate-spin" />
                  <p className="text-sm">Chargement des profils...</p>
                </div>
              ) : filteredPartners.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <User className="mx-auto w-10 h-10 text-zinc-300 dark:text-zinc-700 mb-2" />
                  <p className="text-sm">Aucun profil trouvé</p>
                  <p className="text-xs text-zinc-400 mt-1">Essayez un autre nom, email ou téléphone.</p>
                </div>
              ) : (
                filteredPartners.map(partner => {
                  const isPartner = allowedPartners.some(p => p.id === partner.id);
                  const requested = partnersRequested[partner.id] || pendingSentPartnerIds.has(partner.id);
                  return (
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
                      {isPartner ? (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-lg shrink-0">
                          Discuter
                        </span>
                      ) : requested ? (
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Envoyée
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-3 py-1.5 rounded-lg shrink-0 flex items-center gap-1">
                          <UserPlus className="w-3.5 h-3.5" /> Demander
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

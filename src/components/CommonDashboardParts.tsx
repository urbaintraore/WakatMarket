import React, { useState, useEffect, useMemo } from 'react';
import { Cloud, CloudOff, AlertTriangle, Users, BookOpen, Calculator, History, Search, UserCheck, UserX, MessageSquare, Bell, Send, CheckCircle2, Trash2, UserMinus, TrendingUp, TrendingDown, Package, Store, ShoppingCart, ShieldCheck } from 'lucide-react';
import { formatCFA, db } from '../data';
import { LightClient, StockMovement, DebtPayment, Order, Product, InventoryItem, UserRole, UserProfile, Connection, Notification } from '../types';
import { useAuthContext } from '../context/AuthContext';
import { connectionService } from '../services/connectionService';
import { ClientSendMessageModal } from './ClientSendMessageModal';
import { PartnerStockModal } from './PartnerStockModal';

import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

interface SyncStatusProps {
  isOnline: boolean;
  pendingCount: number;
}

export const SyncStatusIndicator: React.FC<SyncStatusProps> = ({ isOnline, pendingCount }) => {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm transition-all duration-300">
      {isOnline ? (
        <Cloud className="w-4 h-4 text-emerald-500" />
      ) : (
        <CloudOff className="w-4 h-4 text-amber-500" />
      )
      }
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
        {isOnline ? (pendingCount > 0 ? `${pendingCount} en attente` : 'Synchronisé') : 'Hors-ligne'}
      </span>
    </div>
  );
};

interface LowStockAlertsProps {
  inventory: InventoryItem[];
  products: Product[];
  currentUserId: string;
}

export const LowStockAlerts: React.FC<LowStockAlertsProps> = ({ inventory, products, currentUserId }) => {
  const alerts = inventory.filter(i => i.ownerId === currentUserId && i.stock <= (i.lowStockThreshold || i.threshold));
  
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-5 h-5" />
        <h3 className="font-bold text-sm uppercase tracking-tight">Alertes de Stock ({alerts.length})</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {alerts.map(item => {
          const prod = products.find(p => p.id === item.productId);
          return (
            <div key={item.id} className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-bold text-xs">{prod?.name}</p>
                <p className="text-[10px] text-amber-700 dark:text-amber-300">Stock: {item.stock} / Seuil: {item.lowStockThreshold || item.threshold}</p>
              </div>
              <div className="px-2 py-1 bg-amber-200 dark:bg-amber-900 rounded-lg text-[10px] font-bold">REAPPRO</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ClientListProps {
  clients: LightClient[];
  orders: Order[];
  payments: DebtPayment[];
  onCreateClient: (identifier: string, notes?: string, role?: UserRole, isPartnerRegistration?: boolean) => void;
  onAddPayment: (clientId: string, amount: number) => void;
  onDeleteClient: (clientId: string) => void;
  currentUserRole?: UserRole;
  users?: UserProfile[];
}

export const ClientManagement: React.FC<ClientListProps> = ({ clients, orders, payments, onCreateClient, onAddPayment, onDeleteClient, currentUserRole, users = [] }) => {
  const { dbUser } = useAuthContext();
  const currentUser: UserProfile | null = useMemo(() => {
    if (!dbUser) return null;
    return {
      id: dbUser.uid,
      name: `${dbUser.prénom} ${dbUser.nom}`,
      email: dbUser.email,
      role: dbUser.rôle as any,
      phone: dbUser.téléphone || '',
      avatar: dbUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
      country: dbUser.pays || "Côte d'Ivoire",
      status: "ACTIVE" as const,
      region: dbUser.région || "Abidjan"
    };
  }, [dbUser]);

  const [connections, setConnections] = useState<Connection[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeViewTab, setActiveViewTab] = useState<"b2b" | "creances">("b2b");

  useEffect(() => {
    if (currentUser) {
      const unsubConns = connectionService.subscribeToUserConnections(currentUser.id, (conns) => {
        setConnections(conns);
      });
      const unsubNotifs = connectionService.subscribeToUserNotifications(currentUser.id, (notifs) => {
        setNotifications(notifs);
      });
      return () => {
        unsubConns();
        unsubNotifs();
      };
    }
  }, [currentUser?.id]);

  const [isAdding, setIsAdding] = useState(false);
  const [isRegisteringPartner, setIsRegisteringPartner] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Message modal state
  const [selectedClientForMessage, setSelectedClientForMessage] = useState<{
    id: string;
    name: string;
    phone?: string;
    email?: string;
    role?: string;
    companyName?: string;
    debtAmount?: number;
    isRealUser?: boolean;
  } | null>(null);

  // Partner stock modal state
  const [selectedPartnerForStock, setSelectedPartnerForStock] = useState<UserProfile | null>(null);

  const pendingReceived = useMemo(() => {
    if (!currentUser) return [];
    return connections.filter(c => c.receiverId === currentUser.id && c.status === "en_attente");
  }, [connections, currentUser?.id]);

  const pendingSent = useMemo(() => {
    if (!currentUser) return [];
    return connections.filter(c => c.senderId === currentUser.id && c.status === "en_attente");
  }, [connections, currentUser?.id]);

  const activeConnections = useMemo(() => {
    if (!currentUser) return [];
    return connections.filter(c => c.status === "active");
  }, [connections, currentUser?.id]);

  const handleRespondToRequest = async (conn: Connection, status: "active" | "refusée") => {
    try {
      await connectionService.respondToConnectionRequest(conn, status);
    } catch (e) {
      console.error(e);
    }
  };

  const getAllowedRoles = () => {
    switch (currentUserRole) {
      case UserRole.MANUFACTURER:
        return [
          { role: UserRole.WHOLESALER, label: "Grossiste B2B" }
        ];
      case UserRole.WHOLESALER:
        return [
          { role: UserRole.MANUFACTURER, label: "Fabricant" },
          { role: UserRole.SEMI_WHOLESALER, label: "Demi-Grossiste" },
          { role: UserRole.RETAILER, label: "Détaillant" }
        ];
      case UserRole.SEMI_WHOLESALER:
        return [
          { role: UserRole.WHOLESALER, label: "Grossiste B2B" },
          { role: UserRole.RETAILER, label: "Détaillant" },
          { role: UserRole.CLIENT, label: "Client final" }
        ];
      case UserRole.RETAILER:
        return [
          { role: UserRole.WHOLESALER, label: "Grossiste B2B" },
          { role: UserRole.SEMI_WHOLESALER, label: "Demi-Grossiste" },
          { role: UserRole.CLIENT, label: "Client final" }
        ];
      case UserRole.CLIENT:
        return [
          { role: UserRole.RETAILER, label: "Détaillant" },
          { role: UserRole.SEMI_WHOLESALER, label: "Demi-Grossiste" }
        ];
      default:
        return [
          { role: UserRole.CLIENT, label: "Client final" }
        ];
    }
  };

  const allowedRoles = getAllowedRoles();
  const [selectedRole, setSelectedRole] = React.useState<UserRole>(allowedRoles[0]?.role || UserRole.CLIENT);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedTargetUser, setSelectedTargetUser] = React.useState<UserProfile | null>(null);
  const [notesInput, setNotesInput] = React.useState("");
  
  const [paymentAmount, setPaymentAmount] = React.useState<string>("");
  const [showPaymentForm, setShowPaymentForm] = React.useState(false);
  
  const allKnownUsers = React.useMemo(() => {
    const dbList = db.getUsers();
    const map = new Map<string, UserProfile>();
    [...dbList, ...users].forEach(u => {
      if (u && u.id) map.set(u.id, u);
    });
    return Array.from(map.values());
  }, [users]);

  const filteredUsers = React.useMemo(() => {
    return allKnownUsers.filter(u => {
      if (u.role !== selectedRole) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      const cleanQ = q.replace(/[\s\-\+]/g, '');
      const uPhone = (u.phone || "").toLowerCase().replace(/[\s\-\+]/g, '');
      const uEmail = (u.email || "").toLowerCase();
      const uName = (u.name || "").toLowerCase();

      return (
        (uPhone && (uPhone.includes(cleanQ) || cleanQ.includes(uPhone))) ||
        (uEmail && uEmail.includes(q)) ||
        (uName && uName.includes(q))
      );
    });
  }, [allKnownUsers, selectedRole, searchQuery]);

  const calculateDebt = (clientId: string) => {
    const clientOrders = orders.filter(o => o.clientId === clientId);
    const totalOrdered = clientOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const clientPayments = payments.filter(p => p.clientId === clientId);
    const totalPaid = clientPayments.reduce((sum, p) => sum + p.amount, 0);
    return totalOrdered - totalPaid;
  };

  const handleAddPaymentClick = () => {
    const amount = parseFloat(paymentAmount);
    if (selectedClientId && !isNaN(amount) && amount > 0) {
      onAddPayment(selectedClientId, amount);
      setPaymentAmount("");
      setShowPaymentForm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-sm uppercase tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <BookOpen className="w-5 h-5" /> Carnet de Créances & Relations d'Affaires
        </h3>
        <div className="flex gap-2">
          {activeViewTab === "b2b" && (
            <button 
              onClick={() => {
                setIsRegisteringPartner(true);
                setIsAdding(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
            >
              Enregistrer Partenaire
            </button>
          )}
          <button 
            onClick={() => {
              setIsRegisteringPartner(false);
              setIsAdding(!isAdding);
            }}
            className="bg-zinc-600 hover:bg-zinc-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
          >
            {isAdding ? 'Fermer' : (activeViewTab === "b2b" ? 'Rechercher Partenaire' : 'Nouveau Client Local')}
          </button>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveViewTab("b2b")}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-colors relative ${
            activeViewTab === "b2b"
              ? "text-emerald-600 border-b-2 border-emerald-600"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          Relations d'Affaires B2B ({activeConnections.length})
          {pendingReceived.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-bold rounded-full animate-pulse">
              {pendingReceived.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveViewTab("creances")}
          className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-colors relative ${
            activeViewTab === "creances"
              ? "text-emerald-600 border-b-2 border-emerald-600"
              : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          }`}
        >
          Créances & Comptes Locaux ({clients.length})
        </button>
      </div>

      {/* PRIORITY: Incoming connection requests */}
      {pendingReceived.length > 0 && (
        <div className="space-y-3 bg-rose-50/50 dark:bg-rose-950/20 p-4 rounded-2xl border-2 border-rose-300 dark:border-rose-800 shadow-md">
          <h4 className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Bell className="w-4 h-4 animate-bounce text-rose-600" /> VOUS AVEZ DES DEMANDES DE CONNEXION ({pendingReceived.length})
            </span>
            <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded-full font-bold">Action Requise</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingReceived.map(req => {
              const senderUser = allKnownUsers.find(u => u.id === req.senderId);
              return (
                <div key={req.id} className="p-4 bg-white dark:bg-zinc-900 border-2 border-rose-200 dark:border-rose-900 rounded-2xl flex flex-col justify-between gap-3 shadow-sm">
                  <div>
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{req.senderName}</p>
                      <span className="text-[9px] px-2 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded-full font-bold uppercase">{req.senderRole}</span>
                    </div>
                    {req.notes && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 italic">"{req.notes}"</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRespondToRequest(req, "active")}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Accepter
                      </button>
                      <button
                        onClick={() => handleRespondToRequest(req, "refusée")}
                        className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl text-xs font-bold transition flex items-center justify-center border border-zinc-200 dark:border-zinc-700"
                        title="Refuser"
                        type="button"
                      >
                        <UserX className="w-3.5 h-3.5" /> Refuser
                      </button>
                    </div>

                    <div className="flex gap-2">
                      {senderUser && (
                        <button
                          onClick={() => setSelectedPartnerForStock(senderUser)}
                          className="flex-1 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 border border-zinc-200 dark:border-zinc-700"
                        >
                          <Store className="w-3 h-3 text-emerald-600" /> Voir Profil/Stock
                        </button>
                      )}
                      {senderUser && (
                        <button
                          onClick={() => setSelectedClientForMessage({
                            id: senderUser.id,
                            name: senderUser.name,
                            phone: senderUser.phone,
                            email: senderUser.email,
                            role: senderUser.role,
                            companyName: senderUser.companyName,
                            isRealUser: true
                          })}
                          className="py-1.5 px-3 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 border border-emerald-200 dark:border-emerald-800"
                        >
                          <MessageSquare className="w-3 h-3" /> Discuter
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isAdding && (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-5 shadow-sm">
          <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
            Rechercher un client ou partenaire existant sur la plateforme
          </h4>

          {/* 1. Profil du client */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-500">1. Profil recherché (Règles appliquées)</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allowedRoles.map(r => (
                <button
                  key={r.role}
                  type="button"
                  onClick={() => {
                    setSelectedRole(r.role);
                    setSelectedTargetUser(null);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                    selectedRole === r.role
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20'
                      : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Barre de recherche */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-500">2. Rechercher par nom, numéro de téléphone ou e-mail</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-400" />
              <input 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedTargetUser(null);
                }}
                placeholder="Ex: Amadou, +22670000000, ou email@..." 
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" 
              />
            </div>
          </div>

          {/* 3. Résultats de recherche */}
          {searchQuery.trim() && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-zinc-500">
                Résultats trouvés ({filteredUsers.length})
              </label>
              
              {filteredUsers.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                  Aucun utilisateur trouvé avec le rôle "{selectedRole}" correspondant à "{searchQuery}".
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {filteredUsers.map(u => {
                    const isSelected = selectedTargetUser?.id === u.id;
                    return (
                      <div 
                        key={u.id}
                        onClick={() => setSelectedTargetUser(u)}
                        className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition ${
                          isSelected 
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20' 
                            : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img src={u.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
                          <div>
                            <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100">{u.name}</p>
                            <p className="text-[10px] text-zinc-500">{u.phone} • {u.email} • <span className="font-semibold text-emerald-600">{u.role}</span></p>
                          </div>
                        </div>
                        <div>
                          {isSelected ? (
                            <span className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold">Sélectionné ✓</span>
                          ) : (
                            <span className="px-3 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs">Choisir</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. Informations récupérées */}
          {selectedTargetUser && (
            <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2 animate-fadeIn">
              <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                ✓ Profil trouvé :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-zinc-500">Nom complet :</span> <strong className="text-zinc-900 dark:text-zinc-100">{selectedTargetUser.name}</strong>
                </div>
                <div>
                  <span className="text-zinc-500">Téléphone :</span> <strong className="text-zinc-900 dark:text-zinc-100">{selectedTargetUser.phone || 'Non renseigné'}</strong>
                </div>
                <div>
                  <span className="text-zinc-500">E-mail :</span> <strong className="text-zinc-900 dark:text-zinc-100">{selectedTargetUser.email || 'Non renseigné'}</strong>
                </div>
                <div>
                  <span className="text-zinc-500">Rôle :</span> <strong className="text-emerald-600 font-semibold">{selectedTargetUser.role}</strong>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-zinc-500">Adresse / Région :</span> <strong className="text-zinc-900 dark:text-zinc-100">{selectedTargetUser.address || selectedTargetUser.region || 'Non spécifié'}</strong>
                </div>
              </div>
            </div>
          )}

          {/* 4. Notes */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-zinc-500">Message d'accompagnement (Optionnel)</label>
            <input 
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              placeholder="Ex: Bonjour, je souhaite vous ajouter pour faciliter nos échanges..." 
              className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm" 
            />
          </div>

          <button 
            type="button"
            disabled={!selectedTargetUser && !searchQuery.trim()}
            onClick={() => {
              const targetIdentifier = selectedTargetUser ? selectedTargetUser.id : searchQuery.trim();
              if (targetIdentifier) {
                onCreateClient(targetIdentifier, notesInput, selectedRole, isRegisteringPartner);
                setIsAdding(false);
                setIsRegisteringPartner(false);
                setSearchQuery("");
                setSelectedTargetUser(null);
                setNotesInput("");
              }
            }}
            className={`w-full py-3 rounded-xl text-xs font-bold shadow-lg transition ${
              (!selectedTargetUser && !searchQuery.trim()) 
                ? 'bg-zinc-300 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
            }`}
          >
            {selectedTargetUser ? 
              (isRegisteringPartner 
                ? `Enregistrer ${selectedTargetUser.name} comme partenaire` 
                : (activeViewTab === "b2b" ? `Envoyer la demande de connexion à ${selectedTargetUser.name}` : `Enregistrer ${selectedTargetUser.name}`)
              ) 
              : (searchQuery.trim() 
                  ? `Envoyer la demande de connexion à "${searchQuery.trim()}"`
                  : 'Saisissez un numéro/e-mail ou choisissez un utilisateur'
                )
            }
          </button>
        </div>
      )}

      {activeViewTab === "b2b" ? (
        <div className="space-y-6 animate-fade-in">
          {/* Outgoing connection requests */}
          {pendingSent.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Demandes Envoyées ({pendingSent.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingSent.map(req => (
                  <div key={req.id} className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{req.receiverName}</p>
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-tight">{req.receiverRole}</p>
                      </div>
                      {confirmDeleteId === req.id ? (
                        <div className="flex gap-1 animate-in fade-in slide-in-from-right-2">
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setConnections(prev => prev.filter(c => c.id !== req.id));
                              await connectionService.deleteConnection(req.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[9px] font-bold"
                            type="button"
                          >
                            OUI
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg text-[9px] font-bold"
                            type="button"
                          >
                            NON
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setConfirmDeleteId(req.id);
                          }}
                          className="p-2 text-rose-500 bg-rose-50 dark:bg-rose-950/20 rounded-xl hover:bg-rose-500 hover:text-white border border-rose-100 dark:border-rose-900/30 transition-all"
                          title="Annuler la demande"
                          type="button"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <span className="self-start text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-lg">
                      EN ATTENTE DE VALIDATION
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Connected Partners */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Mes Partenaires Connectés ({activeConnections.length})
            </h4>
            {activeConnections.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 bg-zinc-50 dark:bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30 text-emerald-600" />
                <p className="text-xs font-medium">Aucun partenaire B2B connecté pour le moment.</p>
                <p className="text-[10px] text-zinc-400 mt-1">Recherchez un acteur existant sur la plateforme pour initier une relation d'affaires.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeConnections.map(conn => {
                  const otherPartyId = conn.senderId === currentUser?.id ? conn.receiverId : conn.senderId;
                  const otherPartyName = conn.senderId === currentUser?.id ? conn.receiverName : conn.senderName;
                  const otherPartyRole = conn.senderId === currentUser?.id ? conn.receiverRole : conn.senderRole;
                  
                  return (
                    <div key={conn.id} className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between gap-4 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition relative group">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-bold text-sm text-zinc-900 dark:text-white">{otherPartyName}</p>
                          <span className="inline-block text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {otherPartyRole}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {confirmDeleteId === conn.id ? (
                            <div className="flex gap-1 animate-in fade-in slide-in-from-right-2">
                              <button
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setConnections(prev => prev.filter(c => c.id !== conn.id));
                                  await connectionService.deleteConnection(conn.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[9px] font-bold"
                                type="button"
                              >
                                CONFIRMER
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg text-[9px] font-bold"
                                type="button"
                              >
                                ANNULER
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setConfirmDeleteId(conn.id);
                              }}
                              className="p-2 text-rose-500 bg-rose-50 dark:bg-rose-950/20 rounded-xl hover:bg-rose-500 hover:text-white border border-rose-100 dark:border-rose-900/30 transition-all shadow-sm"
                              title="Supprimer la connexion"
                              type="button"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                            <UserCheck className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            const partnerObj = allKnownUsers.find(u => u.id === otherPartyId) || {
                              id: otherPartyId,
                              name: otherPartyName,
                              companyName: otherPartyName,
                              role: otherPartyRole as any,
                              country: currentUser?.country || "Burkina Faso",
                              region: currentUser?.region || "Ouagadougou",
                              status: "ACTIVE" as const,
                              email: "",
                              phone: ""
                            };
                            setSelectedPartnerForStock(partnerObj as UserProfile);
                          }}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Package className="w-3.5 h-3.5" /> Voir Stock & Établissement
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClientForMessage({
                              id: otherPartyId,
                              name: otherPartyName,
                              role: otherPartyRole,
                              isRealUser: true
                            });
                          }}
                          className="py-2 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Message
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Traditional local client debts & entries */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map(client => {
              const debt = calculateDebt(client.id);
              return (
                <div 
                  key={client.id} 
                  className={`p-5 rounded-2xl border transition cursor-pointer ${
                    selectedClientId === client.id 
                    ? 'bg-zinc-50 dark:bg-zinc-900 border-emerald-500 ring-2 ring-emerald-500/20' 
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                  }`}
                  onClick={() => {
                    setSelectedClientId(client.id);
                    setShowPaymentForm(false);
                  }}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-100">{client.name}</h4>
                      <p className="text-xs text-zinc-500">{client.phone}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        {confirmDeleteId === client.id ? (
                          <div className="flex gap-1 animate-in fade-in slide-in-from-right-2">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onDeleteClient(client.id);
                                if (selectedClientId === client.id) setSelectedClientId(null);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[9px] font-bold shadow-sm"
                              type="button"
                            >
                              OUI
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg text-[9px] font-bold"
                              type="button"
                            >
                              NON
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setConfirmDeleteId(client.id);
                            }}
                            className="p-2 text-rose-500 bg-rose-50 dark:bg-rose-950/20 rounded-xl hover:bg-rose-500 hover:text-white border border-rose-100 dark:border-rose-900/30 transition-all shadow-sm"
                            title="Supprimer le client"
                            type="button"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      {debt > 0 && (
                        <div className="px-2.5 py-1 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg text-[10px] font-bold">
                          CRÉANCE
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-zinc-400">Solde Courant</p>
                      <p className={`text-lg font-bold font-mono ${debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatCFA(debt)}
                      </p>
                    </div>
                    <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                      <History className="w-4 h-4 text-zinc-400" />
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3 mt-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClientForMessage({
                          id: client.id,
                          name: client.name,
                          phone: client.phone,
                          debtAmount: debt,
                          isRealUser: false
                        });
                      }}
                      className="flex-1 py-2 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Envoyer un message
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {selectedClientId && (
            <div className="animate-fade-in space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-zinc-500">Historique des transactions</h4>
                
                <div className="flex items-center gap-2">
                  {showPaymentForm ? (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                      <input 
                        type="number" 
                        placeholder="Montant CFA" 
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs w-32 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                      <button 
                        onClick={handleAddPaymentClick}
                        disabled={!paymentAmount || isNaN(parseFloat(paymentAmount)) || parseFloat(paymentAmount) <= 0}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-500 transition shadow-lg shadow-emerald-500/10"
                      >
                        Valider
                      </button>
                      <button 
                        onClick={() => setShowPaymentForm(false)}
                        className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg text-[10px] font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowPaymentForm(true)}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-500/10 flex items-center gap-2"
                    >
                      <Calculator className="w-4 h-4" /> Enregistrer un paiement
                    </button>
                  )}
                </div>
              </div>
              
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase text-zinc-400">Date</th>
                      <th className="px-4 py-3 font-bold uppercase text-zinc-400">Type</th>
                      <th className="px-4 py-3 font-bold uppercase text-zinc-400">Détail</th>
                      <th className="px-4 py-3 font-bold uppercase text-zinc-400 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {[
                      ...orders.filter(o => o.clientId === selectedClientId).map(o => ({
                        date: o.createdAt,
                        type: 'VENTE',
                        detail: `Commande #${o.id.split('-').pop()}`,
                        amount: o.totalAmount,
                        isDebt: true
                      })),
                      ...payments.filter(p => p.clientId === selectedClientId).map(p => ({
                        date: p.date,
                        type: 'PAIEMENT',
                        detail: p.saleId ? `Paiement Vente #${p.saleId.split('-').pop()}` : 'Paiement libre',
                        amount: p.amount,
                        isDebt: false
                      }))
                    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((row, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                        <td className="px-4 py-3 text-zinc-500">{new Date(row.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] ${
                            row.type === 'VENTE' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'
                          }`}>
                            {row.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{row.detail}</td>
                        <td className={`px-4 py-3 text-right font-bold font-mono ${row.isDebt ? 'text-red-500' : 'text-emerald-500'}`}>
                          {row.isDebt ? '-' : '+'}{formatCFA(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Direct Messaging Modal for Client et Adresses */}
      {selectedClientForMessage && (
        <ClientSendMessageModal
          client={selectedClientForMessage}
          currentUser={currentUser}
          isOpen={true}
          onClose={() => setSelectedClientForMessage(null)}
          onOpenGlobalChat={() => {
            const chatToggle = document.getElementById("header-chat-toggle") as HTMLButtonElement;
            if (chatToggle) chatToggle.click();
          }}
        />
      )}

      {/* Partner Stock & Establishment Modal */}
      {selectedPartnerForStock && (
        <PartnerStockModal
          partner={selectedPartnerForStock}
          currentUser={currentUser}
          products={db.getProducts()}
          inventory={db.getInventory()}
          isOpen={true}
          onClose={() => setSelectedPartnerForStock(null)}
          onOpenChat={(partnerId) => {
            setSelectedClientForMessage({
              id: partnerId,
              name: selectedPartnerForStock.companyName || selectedPartnerForStock.name,
              role: selectedPartnerForStock.role,
              isRealUser: true
            });
          }}
          onInitiateOrder={(partnerId) => {
            setSelectedClientForMessage({
              id: partnerId,
              name: selectedPartnerForStock.companyName || selectedPartnerForStock.name,
              role: selectedPartnerForStock.role,
              isRealUser: true
            });
          }}
        />
      )}
    </div>
  );
};

interface SyncHistoryProps {
  queue: any[];
}

export const SyncHistory: React.FC<SyncHistoryProps> = ({ queue }) => {
  return (
    <div className="space-y-3">
      <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-2">
        <Cloud className="w-4 h-4" /> File d'attente de synchronisation ({queue.length})
      </h3>
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        {queue.length === 0 ? (
          <div className="p-8 text-center text-zinc-400">
            <Cloud className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-xs">Toutes les données sont synchronisées.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {queue.map((item, idx) => (
              <div key={idx} className="p-4 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                    <History className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div>
                    <p className="font-bold text-xs uppercase tracking-tight">{item.type}</p>
                    <p className="text-[10px] text-zinc-500">{new Date(item.timestamp).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-600 rounded-md text-[9px] font-bold">EN ATTENTE</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface WeeklySalesChartProps {
  orders: Order[];
  currentUserId: string;
}

export const WeeklySalesChart: React.FC<WeeklySalesChartProps> = ({ orders, currentUserId }) => {
  const [chartType, setChartType] = useState<'revenue' | 'count'>('revenue');

  const chartData = useMemo(() => {
    // Filter orders where receiverId is currentUserId (this actor is the supplier/seller)
    const sellerOrders = orders.filter(o => o.receiverId === currentUserId);
    
    const daysData = [];
    const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      const dayName = daysOfWeek[d.getDay()];
      const dayLabel = `${dayName} ${d.getDate()}/${d.getMonth() + 1}`;
      
      const dayOrders = sellerOrders.filter(o => {
        if (!o.createdAt) return false;
        return o.createdAt.startsWith(dateString);
      });
      
      const revenue = dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const count = dayOrders.length;
      
      daysData.push({
        date: dateString,
        label: dayLabel,
        revenue,
        count,
      });
    }
    
    return daysData;
  }, [orders, currentUserId]);

  const totalRevenue = chartData.reduce((sum, d) => sum + d.revenue, 0);
  const totalCount = chartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <RechartsBarChart className="w-4 h-4 text-emerald-600 inline-block" />
            Suivi de la Demande & Ventes Hebdomadaires
          </h3>
          <p className="text-[11px] text-zinc-500">
            Évolution de la demande de vos partenaires sur les 7 derniers jours.
          </p>
        </div>
        
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setChartType('revenue')}
            className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
              chartType === 'revenue' 
                ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-300 shadow-xs' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Chiffre d'Affaires
          </button>
          <button
            onClick={() => setChartType('count')}
            className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
              chartType === 'count' 
                ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-300 shadow-xs' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Volume de Commandes
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 py-1.5 border-y border-zinc-100 dark:border-zinc-800">
        <div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase">Revenu Global (7j)</p>
          <p className="text-sm font-bold text-emerald-600 font-mono mt-0.5">{formatCFA(totalRevenue)}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-zinc-400 uppercase">Commandes Traitées</p>
          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 font-mono mt-0.5">{totalCount} commande{totalCount > 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="h-48 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(120, 120, 120, 0.1)" />
            <XAxis 
              dataKey="label" 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#888888', fontSize: 9 }}
            />
            <YAxis 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#888888', fontSize: 9 }}
              tickFormatter={(v) => chartType === 'revenue' ? (v >= 1000 ? `${v / 1000}k` : v) : v}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-zinc-900 text-white p-2.5 rounded-xl text-xs border border-zinc-800 shadow-lg font-sans">
                      <p className="font-semibold text-[10px] mb-1 text-zinc-400">{data.label}</p>
                      <p className="text-[11px] font-bold">
                        {chartType === 'revenue' 
                          ? `Revenu: ${formatCFA(data.revenue)}` 
                          : `Volume: ${data.count} commande(s)`}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar 
              dataKey={chartType === 'revenue' ? 'revenue' : 'count'} 
              fill={chartType === 'revenue' ? '#10b981' : '#3b82f6'} 
              radius={[4, 4, 0, 0]} 
            />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// Analytical Module: Debt vs. Revenue Chart (Recharts)
// ----------------------------------------------------------------------
interface DebtVsRevenueChartProps {
  orders: Order[];
  payments: DebtPayment[];
  currentUserId: string;
}

export const DebtVsRevenueChart: React.FC<DebtVsRevenueChartProps> = ({ orders, payments, currentUserId }) => {
  const [viewType, setViewType] = useState<'monthly' | 'weekly'>('monthly');

  const chartData = useMemo(() => {
    // Sales of this user (currentUserId as supplier/receiver of orders)
    const mySales = orders.filter(o => o.receiverId === currentUserId);
    const myPayments = payments; 

    const periodsData = [];

    if (viewType === 'monthly') {
      const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
      const now = new Date();
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const monthIndex = d.getMonth();
        const label = `${months[monthIndex]} ${year}`;
        
        // Filter sales in this specific month
        const periodSales = mySales.filter(o => {
          if (!o.createdAt) return false;
          const od = new Date(o.createdAt);
          return od.getFullYear() === year && od.getMonth() === monthIndex;
        });

        // Chiffre d'Affaires (CA)
        const ca = periodSales.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        // Debt initially created in this period
        const initialDebt = periodSales.reduce((sum, o) => sum + ((o.totalAmount || 0) - (o.amountPaid || 0)), 0);

        // Subsequent payments registered in this month
        const periodPayments = myPayments.filter(p => {
          if (!p.date) return false;
          const pd = new Date(p.date);
          return pd.getFullYear() === year && pd.getMonth() === monthIndex;
        });
        const extraPaid = periodPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        // Remaining Debt on this month's transactions
        const debt = Math.max(0, initialDebt - extraPaid);

        periodsData.push({
          label,
          ca,
          dette: debt,
        });
      }
    } else {
      // Weekly view (last 6 weeks)
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i * 7);
        // Find week boundaries
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay() + 1); // Monday
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const label = `Sem. du ${startOfWeek.getDate()}/${startOfWeek.getMonth() + 1}`;

        const periodSales = mySales.filter(o => {
          if (!o.createdAt) return false;
          const od = new Date(o.createdAt);
          return od >= startOfWeek && od <= endOfWeek;
        });

        const ca = periodSales.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
        const initialDebt = periodSales.reduce((sum, o) => sum + ((o.totalAmount || 0) - (o.amountPaid || 0)), 0);

        const periodPayments = myPayments.filter(p => {
          if (!p.date) return false;
          const pd = new Date(p.date);
          return pd >= startOfWeek && pd <= endOfWeek;
        });
        const extraPaid = periodPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        const debt = Math.max(0, initialDebt - extraPaid);

        periodsData.push({
          label,
          ca,
          dette: debt,
        });
      }
    }

    return periodsData;
  }, [orders, payments, currentUserId, viewType]);

  const totalCA = useMemo(() => chartData.reduce((sum, d) => sum + d.ca, 0), [chartData]);
  const totalDette = useMemo(() => chartData.reduce((sum, d) => sum + d.dette, 0), [chartData]);
  
  const recoveryRate = useMemo(() => {
    if (totalCA === 0) return 100;
    return Math.max(0, Math.min(100, ((totalCA - totalDette) / totalCA) * 100));
  }, [totalCA, totalDette]);

  const ratioDetteCA = useMemo(() => {
    if (totalCA === 0) return 0;
    return (totalDette / totalCA) * 100;
  }, [totalCA, totalDette]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-5" id="debt-vs-revenue-chart">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-emerald-600" />
            Suivi Analytique : Chiffre d'Affaires vs. Dette Client
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Analyse comparative de vos encours de crédits par rapport à vos ventes réelles.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setViewType('monthly')}
            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
              viewType === 'monthly' 
                ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-300 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Vue Mensuelle
          </button>
          <button
            onClick={() => setViewType('weekly')}
            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
              viewType === 'weekly' 
                ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-300 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            Vue Hebdomadaire
          </button>
        </div>
      </div>

      {/* Summary Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-y border-zinc-100 dark:border-zinc-800 py-3">
        <div className="space-y-0.5">
          <p className="text-[9px] uppercase font-black tracking-wider text-zinc-400">CA Cumulé (Période)</p>
          <p className="text-sm font-black text-zinc-900 dark:text-white font-mono">{formatCFA(totalCA)}</p>
          <p className="text-[9.5px] text-zinc-500">Volume global des ventes</p>
        </div>
        <div className="space-y-0.5 border-t sm:border-t-0 sm:border-x border-zinc-100 dark:border-zinc-800 pt-3 sm:pt-0 sm:px-4">
          <p className="text-[9px] uppercase font-black tracking-wider text-zinc-400">Encours de Dette</p>
          <p className={`text-sm font-black font-mono ${totalDette > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
            {formatCFA(totalDette)}
          </p>
          <p className="text-[9.5px] text-zinc-500">
            Ratio de {ratioDetteCA.toFixed(1)}% sur CA
          </p>
        </div>
        <div className="space-y-0.5 border-t sm:border-t-0 pt-3 sm:pt-0 sm:pl-4">
          <p className="text-[9px] uppercase font-black tracking-wider text-zinc-400">Taux de Recouvrement</p>
          <p className="text-sm font-black text-emerald-600 font-mono">
            {recoveryRate.toFixed(1)}%
          </p>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full mt-1 overflow-hidden">
            <div 
              className={`h-full rounded-full ${
                recoveryRate >= 90 ? 'bg-emerald-500' : recoveryRate >= 75 ? 'bg-amber-500' : 'bg-rose-500'
              }`} 
              style={{ width: `${recoveryRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Recharts Bar Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(120, 120, 120, 0.1)" />
            <XAxis 
              dataKey="label" 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#888888', fontSize: 9, fontWeight: 600 }}
            />
            <YAxis 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: '#888888', fontSize: 9, fontWeight: 600 }}
              tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-zinc-900 text-white p-3 rounded-xl text-xs border border-zinc-800 shadow-xl font-sans space-y-1.5">
                      <p className="font-bold text-[10px] text-zinc-400 uppercase tracking-wider">{data.label}</p>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-400">Chiffre d'Affaires :</span>
                        <span className="font-mono font-bold text-emerald-400">{formatCFA(data.ca)}</span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-zinc-400">Créance Client :</span>
                        <span className="font-mono font-bold text-rose-400">{formatCFA(data.dette)}</span>
                      </div>
                      {data.ca > 0 && (
                        <div className="border-t border-zinc-800 pt-1 flex justify-between gap-4 text-[10px] text-zinc-500 font-semibold">
                          <span>Ratio Dette / CA :</span>
                          <span>{((data.dette / data.ca) * 100).toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36} 
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 10, fontWeight: 700 }}
              formatter={(value) => {
                if (value === 'ca') return <span className="text-zinc-600 dark:text-zinc-400 uppercase">Chiffre d'Affaires</span>;
                if (value === 'dette') return <span className="text-zinc-600 dark:text-zinc-400 uppercase">Dette Client</span>;
                return value;
              }}
            />
            <Bar 
              dataKey="ca" 
              name="ca"
              fill="#10b981" 
              radius={[4, 4, 0, 0]} 
            />
            <Bar 
              dataKey="dette" 
              name="dette"
              fill="#f43f5e" 
              radius={[4, 4, 0, 0]} 
            />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>

      {/* Recommendation alert */}
      <div className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-wider ${
        ratioDetteCA >= 20 
          ? 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400' 
          : ratioDetteCA >= 10 
            ? 'bg-amber-50 border-amber-100 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400' 
            : 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400'
      }`}>
        <span className="text-xs">
          {ratioDetteCA >= 20 ? '⚠️' : ratioDetteCA >= 10 ? '⚡' : '✅'}
        </span>
        <span>
          {ratioDetteCA >= 20 
            ? "Attention : niveau de créances élevé (> 20% du CA). Veuillez restreindre les limites de crédit." 
            : ratioDetteCA >= 10 
              ? "Prudence : les encours de crédit approchent du seuil de tolérance (10% - 20% du CA)." 
              : "Excellent : vos créances clients sont saines et inférieures à 10% de votre chiffre d'affaires."}
        </span>
      </div>
    </div>
  );
};


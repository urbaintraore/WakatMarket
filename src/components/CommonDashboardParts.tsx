import React, { useState, useEffect, useMemo } from 'react';
import { Cloud, CloudOff, AlertTriangle, Users, BookOpen, Calculator, History, Search, UserCheck, UserX, MessageSquare, Bell, Send, CheckCircle2, Trash2, UserMinus, TrendingUp, TrendingDown, Package, Store, ShoppingCart, ShieldCheck, Landmark, Plus, Phone, Mail, Building2 } from 'lucide-react';
import { formatCFA, db } from '../data';
import { LightClient, StockMovement, DebtPayment, Order, OrderStatus, Product, InventoryItem, UserRole, UserProfile, Connection, Notification, isConnectionActive } from '../types';
import { useAuthContext } from '../context/AuthContext';
import { connectionService } from '../services/connectionService';
import { ClientSendMessageModal } from './ClientSendMessageModal';
import { PartnerStockModal } from './PartnerStockModal';

import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, AreaChart, Area, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

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
  const alerts = inventory.filter(i => {
    if (i.ownerId !== currentUserId) return false;
    const estSousSeuilFixe = i.stock <= (i.lowStockThreshold || i.threshold);
    const estSousSeuilJours = (i as any).joursRestants !== undefined && (i as any).joursRestants !== null && (i as any).joursRestants <= ((i as any).seuilAlerte || 5);
    return estSousSeuilFixe || estSousSeuilJours;
  });
  
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-5 h-5" />
        <h3 className="font-bold text-sm uppercase tracking-tight">Alertes de Stock & Réapprovisionnement ({alerts.length})</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {alerts.map((item, idx) => {
          const prod = products.find(p => p.id === item.productId);
          const vitesse = (item as any).vitesseVenteJournaliere || 0;
          const joursRestants = (item as any).joursRestants;

          const isCritique = joursRestants !== null && joursRestants !== undefined && joursRestants <= 5;
          const isAttention = joursRestants !== null && joursRestants !== undefined && joursRestants > 5 && joursRestants <= 10;

          return (
            <div key={`${item.id}_${idx}`} className={`p-3 border rounded-xl flex items-center justify-between ${
              isCritique ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50' :
              isAttention ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50' :
              'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
            }`}>
              <div>
                <p className="font-bold text-xs">{prod?.name || (item as any).nom || 'Produit'}</p>
                <p className="text-[10px] text-zinc-600 dark:text-zinc-400 mt-0.5">
                  Stock: <strong className="font-bold">{item.stock} u</strong> (Seuil: {item.lowStockThreshold || item.threshold} u)
                </p>
                {vitesse > 0 && (
                  <p className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    ⚡ Vitesse : {vitesse} u/jour (14j)
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                {joursRestants !== undefined && joursRestants !== null ? (
                  <span className={`px-2 py-1 rounded-lg text-[9px] font-extrabold uppercase ${
                    joursRestants <= 5 ? 'bg-rose-600 text-white animate-pulse' :
                    joursRestants <= 10 ? 'bg-amber-500 text-white' :
                    'bg-emerald-600 text-white'
                  }`}>
                    {joursRestants <= 0 ? 'RUPTURE' : `${joursRestants} j restants`}
                  </span>
                ) : (
                  <span className="px-2 py-1 bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 rounded-lg text-[10px] font-bold">
                    REAPPRO
                  </span>
                )}
              </div>
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
  products?: Product[];
  inventory?: InventoryItem[];
}

export const ClientManagement: React.FC<ClientListProps> = ({ clients, orders, payments, onCreateClient, onAddPayment, onDeleteClient, currentUserRole, users = [], products = [], inventory = [] }) => {
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
  const [txStartDate, setTxStartDate] = useState<string>("");
  const [txEndDate, setTxEndDate] = useState<string>("");

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
    return connections.filter(c => isConnectionActive(c));
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
      const q = searchQuery.trim().toLowerCase();
      const cleanQ = q.replace(/[\s\-\+]/g, '');
      const uPhone = (u.phone || (u as any).téléphone || "").toLowerCase().replace(/[\s\-\+]/g, '');
      const uEmail = (u.email || "").toLowerCase();
      const uName = (u.name || "").toLowerCase();

      if (q) {
        const matchesQuery = 
          (uPhone && (uPhone.includes(cleanQ) || cleanQ.includes(uPhone))) ||
          (uEmail && uEmail.includes(q)) ||
          (uName && uName.includes(q));
        if (matchesQuery) return true;
      }

      if (u.role !== selectedRole) return false;
      if (!q) return true;

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
            {pendingReceived.map((req, idx) => {
              const senderUser = allKnownUsers.find(u => u.id === req.senderId);
              return (
                <div key={`${req.id}_${idx}`} className="p-4 bg-white dark:bg-zinc-900 border-2 border-rose-200 dark:border-rose-900 rounded-2xl flex flex-col justify-between gap-3 shadow-sm">
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
                {pendingSent.map((req, idx) => (
                  <div key={`${req.id}_${idx}`} className="p-4 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between gap-3">
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
                {activeConnections.map((conn, idx) => {
                  const otherPartyId = conn.senderId === currentUser?.id ? conn.receiverId : conn.senderId;
                  const otherPartyName = conn.senderId === currentUser?.id ? conn.receiverName : conn.senderName;
                  const otherPartyRole = conn.senderId === currentUser?.id ? conn.receiverRole : conn.senderRole;
                  
                  return (
                    <div key={`${conn.id}_${idx}`} className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between gap-4 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition relative group">
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
              
              <div className="flex flex-wrap items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl border border-zinc-200 dark:border-zinc-750 text-xs mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-zinc-500">Du :</span>
                  <input
                    type="date"
                    value={txStartDate}
                    onChange={(e) => setTxStartDate(e.target.value)}
                    className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-zinc-500">Au :</span>
                  <input
                    type="date"
                    value={txEndDate}
                    onChange={(e) => setTxEndDate(e.target.value)}
                    className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-medium"
                  />
                </div>
                {(txStartDate || txEndDate) && (
                  <button
                    onClick={() => { setTxStartDate(""); setTxEndDate(""); }}
                    className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer ml-auto"
                  >
                    Réinitialiser
                  </button>
                )}
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
                    {(() => {
                      const allTx = [
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
                      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                      const filtered = allTx.filter(row => {
                        const d = new Date(row.date).getTime();
                        if (txStartDate && d < new Date(txStartDate).getTime()) return false;
                        if (txEndDate) {
                          const end = new Date(txEndDate);
                          end.setHours(23, 59, 59, 999);
                          if (d > end.getTime()) return false;
                        }
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={4} className="px-4 py-8 text-center text-zinc-400 italic">
                              Aucune transaction trouvée pour cette période.
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((row, idx) => (
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
                      ));
                    })()}
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
          products={products && products.length > 0 ? products : db.getProducts()}
          inventory={inventory && inventory.length > 0 ? inventory : db.getInventory()}
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
          onInitiateOrder={(partnerId, productId, mode) => {
            const product = productId ? db.getProducts().find(p => p.id === productId) : null;
            let initialMsg = "";
            if (mode === "SELL") {
              initialMsg = product 
                ? `Bonjour, je souhaite vous soumettre une offre d'approvisionnement pour le produit : ${product.name}. Pouvons-nous en discuter ?`
                : `Bonjour, je souhaite vous proposer une offre complète de ravitaillement pour vos stocks.`;
            } else {
              initialMsg = product
                ? `Bonjour, je souhaiterais passer commande pour le produit : ${product.name}. Quels sont vos conditions et délais ?`
                : `Bonjour, je souhaiterais passer une commande d'approvisionnement complète auprès de votre établissement.`;
            }

            setSelectedClientForMessage({
              id: partnerId,
              name: selectedPartnerForStock.companyName || selectedPartnerForStock.name,
              role: selectedPartnerForStock.role,
              isRealUser: true,
              initialMessage: initialMsg
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

export interface SupplierSelectorProps {
  currentUser: UserProfile;
  users: UserProfile[];
  connections?: Connection[];
  lightClients?: LightClient[];
  selectedSupplierId: string;
  onSelectSupplier: (supplierId: string) => void;
  targetRoles?: UserRole[];
  title?: string;
  description?: string;
  onCreateLightClient?: (identifier: string, notes?: string, role?: any, isPartnerRegistration?: boolean) => void;
}

export const SupplierSelector: React.FC<SupplierSelectorProps> = ({
  currentUser,
  users = [],
  connections = [],
  lightClients = [],
  selectedSupplierId,
  onSelectSupplier,
  targetRoles,
  title = "Sélection du Fournisseur",
  description = "Choisissez un fournisseur dans votre carnet d'adresses ou tapez son numéro ou son email.",
  onCreateLightClient
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Determine active connection IDs
  const connectedPartnerUserIds = useMemo(() => {
    const set = new Set<string>();
    connections.forEach(c => {
      if (isConnectionActive(c)) {
        if (c.senderId === currentUser.id) set.add(c.receiverId);
        if (c.receiverId === currentUser.id) set.add(c.senderId);
      }
    });
    return set;
  }, [connections, currentUser.id]);

  // Address book entries owned by current user
  const addressBookEntries = useMemo(() => {
    return lightClients.filter(lc => lc.ownerId === currentUser.id);
  }, [lightClients, currentUser.id]);

  // Helper to test if a candidate role is forbidden (e.g. Retailer/Customer for Wholesaler or SemiWholesaler)
  const isForbiddenSupplier = (candidateRole?: UserRole | string, linkedUserRole?: UserRole | string): boolean => {
    const rolesToTest = [candidateRole, linkedUserRole].filter(Boolean) as (UserRole | string)[];
    
    // 1. Grossiste or Demi-Grossiste cannot procure from Retailer or Client
    if (currentUser.role === UserRole.WHOLESALER || currentUser.role === UserRole.SEMI_WHOLESALER) {
      for (const r of rolesToTest) {
        const rStr = r.toString().toUpperCase();
        if (
          rStr === UserRole.RETAILER ||
          rStr === UserRole.CLIENT ||
          rStr === "RETAILER" ||
          rStr === "CLIENT" ||
          rStr.includes("DÉTAILLANT") ||
          rStr.includes("DETAILLANT") ||
          rStr.includes("BOUTIQUE") ||
          rStr.includes("CLIENT")
        ) {
          return true;
        }
      }
    }

    // 2. If targetRoles is specified, candidate must match targetRoles
    if (targetRoles && targetRoles.length > 0) {
      const hasTargetMatch = rolesToTest.some(r => {
        const rStr = r.toString().toUpperCase();
        return targetRoles.some(tr => tr.toString().toUpperCase() === rStr);
      });
      // If we know the role and it doesn't match targetRoles, forbid it
      if (rolesToTest.length > 0 && !hasTargetMatch) {
        return true;
      }
    }

    return false;
  };

  // Combine users & light clients into unified list
  const allSuppliers = useMemo(() => {
    const items: Array<{
      id: string;
      name: string;
      companyName?: string;
      phone?: string;
      email?: string;
      role?: UserRole | string;
      region?: string;
      country?: string;
      isAddressBook: boolean;
      isConnected: boolean;
      isUser: boolean;
      realUserId?: string;
    }> = [];

    const addedKeys = new Set<string>();

    const isDuplicate = (id: string, email?: string, companyName?: string) => {
      const normEmail = email ? email.toLowerCase().trim() : "";
      const normCompany = companyName ? companyName.toLowerCase().trim() : "";
      if (addedKeys.has(id)) return true;
      if (normEmail && addedKeys.has(`email:${normEmail}`)) return true;
      if (normCompany && normCompany !== "entreprise" && addedKeys.has(`company:${normCompany}`)) return true;
      return false;
    };

    const markAdded = (id: string, email?: string, companyName?: string) => {
      addedKeys.add(id);
      const normEmail = email ? email.toLowerCase().trim() : "";
      const normCompany = companyName ? companyName.toLowerCase().trim() : "";
      if (normEmail) addedKeys.add(`email:${normEmail}`);
      if (normCompany && normCompany !== "entreprise") addedKeys.add(`company:${normCompany}`);
    };

    // 1. Address book light clients (filter out retailers/incompatible roles)
    addressBookEntries.forEach(lc => {
      const linkedUser = lc.linkedUserId ? users.find(u => u.id === lc.linkedUserId) : null;
      const itemId = lc.linkedUserId || lc.id;
      const compName = lc.companyName || linkedUser?.companyName;
      const emailAddr = lc.email || linkedUser?.email;

      if (isDuplicate(itemId, emailAddr, compName)) return;

      const effectiveRole = linkedUser?.role || lc.role;
      if (isForbiddenSupplier(effectiveRole, linkedUser?.role)) {
        return; // Exclude retailers or non-matching roles from supplier list
      }

      markAdded(itemId, emailAddr, compName);

      items.push({
        id: itemId,
        name: lc.name,
        companyName: compName,
        phone: lc.phone || linkedUser?.phone,
        email: emailAddr,
        role: effectiveRole || "Partenaire Carnet",
        region: linkedUser?.region || "Local",
        country: linkedUser?.country || "",
        isAddressBook: true,
        isConnected: lc.linkedUserId ? connectedPartnerUserIds.has(lc.linkedUserId) : false,
        isUser: !!linkedUser,
        realUserId: lc.linkedUserId
      });
    });

    // 2. Connected partners & target role users
    users.forEach(u => {
      if (u.id === currentUser.id) return;
      if (isDuplicate(u.id, u.email, u.companyName)) return;

      if (isForbiddenSupplier(u.role)) {
        return; // Exclude retailers or forbidden roles
      }

      const isConnected = connectedPartnerUserIds.has(u.id);
      const matchesRole = !targetRoles || targetRoles.length === 0 || targetRoles.includes(u.role);

      if (matchesRole || isConnected) {
        markAdded(u.id, u.email, u.companyName);
        items.push({
          id: u.id,
          name: u.name,
          companyName: u.companyName,
          phone: u.phone,
          email: u.email,
          role: u.role,
          region: u.region,
          country: u.country,
          isAddressBook: false,
          isConnected: isConnected,
          isUser: true,
          realUserId: u.id
        });
      }
    });

    return items;
  }, [addressBookEntries, users, connectedPartnerUserIds, targetRoles, currentUser.id, currentUser.role]);

  // Filter address book / connected suppliers for quick selector
  const addressBookSuppliers = useMemo(() => {
    return allSuppliers.filter(s => s.isAddressBook || s.isConnected);
  }, [allSuppliers]);

  // Filtered suppliers based on search query
  const cleanPhone = (str?: string) => str ? str.replace(/[^0-9]/g, '') : '';

  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return allSuppliers;
    const term = searchTerm.toLowerCase().trim();
    const termNum = cleanPhone(term);

    const matchedSupplierIds = new Set<string>();
    const results: typeof allSuppliers = [];

    // 1. Search in allSuppliers
    allSuppliers.forEach(s => {
      const sPhoneClean = cleanPhone(s.phone);
      const matchesName = s.name.toLowerCase().includes(term);
      const matchesCompany = s.companyName?.toLowerCase().includes(term);
      const matchesEmail = s.email?.toLowerCase().includes(term);
      const matchesPhoneRaw = s.phone?.toLowerCase().includes(term);
      const matchesPhoneClean = termNum.length >= 3 && sPhoneClean.includes(termNum);

      if (matchesName || matchesCompany || matchesEmail || matchesPhoneRaw || matchesPhoneClean) {
        matchedSupplierIds.add(s.id);
        results.push(s);
      }
    });

    // 2. Search in all users (only if matching targetRoles and not forbidden)
    users.forEach(u => {
      if (u.id === currentUser.id) return;
      if (matchedSupplierIds.has(u.id)) return;
      if (isForbiddenSupplier(u.role)) return;

      const uPhoneClean = cleanPhone(u.phone);
      const matchesName = u.name.toLowerCase().includes(term);
      const matchesCompany = u.companyName?.toLowerCase().includes(term);
      const matchesEmail = u.email?.toLowerCase().includes(term);
      const matchesPhoneRaw = u.phone?.toLowerCase().includes(term);
      const matchesPhoneClean = termNum.length >= 3 && uPhoneClean.includes(termNum);

      if (matchesName || matchesCompany || matchesEmail || matchesPhoneRaw || matchesPhoneClean) {
        matchedSupplierIds.add(u.id);
        results.push({
          id: u.id,
          name: u.name,
          companyName: u.companyName,
          phone: u.phone,
          email: u.email,
          role: u.role,
          region: u.region,
          country: u.country,
          isAddressBook: false,
          isConnected: connectedPartnerUserIds.has(u.id),
          isUser: true,
          realUserId: u.id
        });
      }
    });

    // 3. Search in light clients
    lightClients.forEach(lc => {
      if (lc.ownerId !== currentUser.id) return;
      const itemId = lc.linkedUserId || lc.id;
      if (matchedSupplierIds.has(itemId)) return;

      const linkedUser = lc.linkedUserId ? users.find(u => u.id === lc.linkedUserId) : null;
      const effectiveRole = linkedUser?.role || lc.role;

      if (isForbiddenSupplier(effectiveRole, linkedUser?.role)) return;

      const lcPhoneClean = cleanPhone(lc.phone);
      const matchesName = lc.name.toLowerCase().includes(term);
      const matchesCompany = lc.companyName?.toLowerCase().includes(term);
      const matchesEmail = lc.email?.toLowerCase().includes(term);
      const matchesPhoneRaw = lc.phone?.toLowerCase().includes(term);
      const matchesPhoneClean = termNum.length >= 3 && lcPhoneClean.includes(termNum);

      if (matchesName || matchesCompany || matchesEmail || matchesPhoneRaw || matchesPhoneClean) {
        matchedSupplierIds.add(itemId);
        results.push({
          id: itemId,
          name: lc.name,
          companyName: lc.companyName,
          phone: lc.phone,
          email: lc.email,
          role: effectiveRole || "Carnet d'adresses",
          region: "Local",
          country: "",
          isAddressBook: true,
          isConnected: lc.linkedUserId ? connectedPartnerUserIds.has(lc.linkedUserId) : false,
          isUser: !!lc.linkedUserId,
          realUserId: lc.linkedUserId
        });
      }
    });

    return results;
  }, [allSuppliers, users, lightClients, searchTerm, connectedPartnerUserIds, currentUser.id, currentUser.role]);

  const typedInputTrimmed = searchTerm.trim();
  const isInputEmail = typedInputTrimmed.includes('@') && typedInputTrimmed.includes('.');
  const isInputPhone = /^[+0-9\s-]{6,}$/.test(typedInputTrimmed);
  const isDirectSearchMode = (isInputEmail || isInputPhone || typedInputTrimmed.length >= 3) && filteredSuppliers.length === 0;

  const handleCreateOrSelectDirectSupplier = () => {
    if (!typedInputTrimmed) return;

    const termNum = cleanPhone(typedInputTrimmed);

    // Search by email or phone in registered users
    const existingUser = users.find(u => 
      (u.email && u.email.toLowerCase() === typedInputTrimmed.toLowerCase()) ||
      (u.phone && (
        u.phone.toLowerCase().replace(/\s+/g, '') === typedInputTrimmed.toLowerCase().replace(/\s+/g, '') ||
        (termNum.length >= 6 && cleanPhone(u.phone).includes(termNum))
      ))
    );

    if (existingUser) {
      if (isForbiddenSupplier(existingUser.role)) {
        alert("Action impossible : Les grossistes et demi-grossistes ne peuvent pas s'approvisionner auprès des détaillants.");
        return;
      }
      onSelectSupplier(existingUser.id);
      setSearchTerm("");
      return;
    }

    // Search by email or phone in light clients
    const existingClient = lightClients.find(lc => 
      lc.ownerId === currentUser.id && (
        (lc.email && lc.email.toLowerCase() === typedInputTrimmed.toLowerCase()) ||
        (lc.phone && (
          lc.phone.toLowerCase().replace(/\s+/g, '') === typedInputTrimmed.toLowerCase().replace(/\s+/g, '') ||
          (termNum.length >= 6 && cleanPhone(lc.phone).includes(termNum))
        ))
      )
    );

    if (existingClient) {
      const linkedUser = existingClient.linkedUserId ? users.find(u => u.id === existingClient.linkedUserId) : null;
      if (isForbiddenSupplier(existingClient.role || linkedUser?.role, linkedUser?.role)) {
        alert("Action impossible : Les grossistes et demi-grossistes ne peuvent pas s'approvisionner auprès des détaillants.");
        return;
      }
      onSelectSupplier(existingClient.linkedUserId || existingClient.id);
      setSearchTerm("");
      return;
    }

    // Create a new supplier in address book
    const defaultSupplierRole = (targetRoles && targetRoles[0]) || UserRole.WHOLESALER;
    const newClientId = `lc-supplier-${Date.now()}`;
    const newClient: LightClient = {
      id: newClientId,
      ownerId: currentUser.id,
      name: isInputEmail ? typedInputTrimmed.split('@')[0] : `Fournisseur (${typedInputTrimmed})`,
      companyName: `Fournisseur ${typedInputTrimmed}`,
      email: isInputEmail ? typedInputTrimmed : undefined,
      phone: isInputPhone ? typedInputTrimmed : (typedInputTrimmed.replace(/[^0-9]/g, '') || "00000000"),
      role: defaultSupplierRole,
      notes: "Ajouté via réapprovisionnement direct",
      createdAt: new Date().toISOString()
    };

    const updatedClients = [...lightClients, newClient];
    db.saveLightClients(updatedClients);

    if (onCreateLightClient) {
      onCreateLightClient(typedInputTrimmed, "Fournisseur réapprovisionnement direct", defaultSupplierRole, true);
    }

    onSelectSupplier(newClient.id);
    setSearchTerm("");
  };

  const selectedSupplierObj = useMemo(() => {
    const found = allSuppliers.find(s => s.id === selectedSupplierId);
    if (found) return found;

    const lc = lightClients.find(l => l.id === selectedSupplierId || l.linkedUserId === selectedSupplierId);
    if (lc) {
      return {
        id: lc.linkedUserId || lc.id,
        name: lc.name,
        companyName: lc.companyName,
        phone: lc.phone,
        email: lc.email,
        role: "Carnet d'adresses",
        region: "Local",
        country: "",
        isAddressBook: true,
        isConnected: false,
        isUser: !!lc.linkedUserId,
        realUserId: lc.linkedUserId
      };
    }

    const u = users.find(usr => usr.id === selectedSupplierId);
    if (u) {
      return {
        id: u.id,
        name: u.name,
        companyName: u.companyName,
        phone: u.phone,
        email: u.email,
        role: u.role,
        region: u.region,
        country: u.country,
        isAddressBook: false,
        isConnected: connectedPartnerUserIds.has(u.id),
        isUser: true,
        realUserId: u.id
      };
    }

    if (selectedSupplierId) {
      return {
        id: selectedSupplierId,
        name: `Fournisseur (${selectedSupplierId})`,
        companyName: "Contact Direct",
        phone: "",
        email: "",
        role: "Contact Direct",
        region: "Local",
        isAddressBook: true,
        isConnected: false,
        isUser: false
      };
    }

    return null;
  }, [allSuppliers, lightClients, users, selectedSupplierId, connectedPartnerUserIds]);

  return (
    <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
            <Landmark className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {title}
          </h4>
          <p className="text-[11px] text-zinc-500 mt-0.5">{description}</p>
        </div>

        {/* Dropdown selector */}
        <select
          value={selectedSupplierId}
          onChange={(e) => onSelectSupplier(e.target.value)}
          className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs bg-white dark:bg-zinc-850 font-semibold text-zinc-900 dark:text-zinc-100 min-w-[220px]"
        >
          <option value="">-- Choisir un fournisseur --</option>
          {addressBookSuppliers.length > 0 && (
            <optgroup label="📍 Carnet d'adresses & Partenaires">
              {addressBookSuppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.companyName ? `(${s.companyName})` : ''} - {s.phone || s.email || s.region}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="🌐 Tous les Fournisseurs du réseau">
            {allSuppliers.map(s => (
              <option key={s.id} value={s.id}>
                [{s.role}] {s.name} {s.companyName ? `(${s.companyName})` : ''} - {s.region || 'National'}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Address Book Quick Selection Chips */}
      {addressBookSuppliers.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
            Sélection rapide (Carnet d'adresses & Partenaires) :
          </label>
          <div className="flex flex-wrap gap-2">
            {addressBookSuppliers.map(s => {
              const isSelected = selectedSupplierId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectSupplier(s.id)}
                  className={`px-3 py-1.5 rounded-xl border text-xs transition-all flex items-center gap-2 ${
                    isSelected
                      ? "bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs"
                      : "bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-emerald-500"
                  }`}
                >
                  <span className="font-semibold">{s.name || s.companyName}</span>
                  {s.phone && <span className="text-[10px] opacity-80">📞 {s.phone}</span>}
                  {s.isAddressBook && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isSelected ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300"}`}>
                      Carnet
                    </span>
                  )}
                  {s.isConnected && !s.isAddressBook && (
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isSelected ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"}`}>
                      Partenaire
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Direct Typing Input (Phone or Email) */}
      <div className="space-y-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-zinc-400" />
          Rechercher ou Tapez le Numéro de Téléphone / Email du Fournisseur :
        </label>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tapez un numéro de téléphone (ex: 70001122), un email ou un nom..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {typedInputTrimmed && (
            <button
              type="button"
              onClick={handleCreateOrSelectDirectSupplier}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Sélectionner / Utiliser {isInputPhone ? "ce numéro" : isInputEmail ? "cet email" : "cette saisie"}
            </button>
          )}
        </div>

        {/* Live Filter Results */}
        {searchTerm.trim() && filteredSuppliers.length > 0 && (
          <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 max-h-48 overflow-y-auto space-y-1 shadow-md">
            <p className="text-[10px] font-bold text-zinc-400 uppercase px-2 py-0.5">Fournisseurs correspondants ({filteredSuppliers.length}) :</p>
            {filteredSuppliers.map(s => (
              <div
                key={s.id}
                onClick={() => {
                  onSelectSupplier(s.id);
                  setSearchTerm("");
                }}
                className={`p-2 rounded-lg cursor-pointer flex items-center justify-between text-xs transition-colors ${
                  selectedSupplierId === s.id
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-700/50 text-zinc-800 dark:text-zinc-200"
                }`}
              >
                <div>
                  <span className="font-semibold">{s.name} {s.companyName ? `(${s.companyName})` : ''}</span>
                  <div className="text-[10px] text-zinc-500 flex gap-2 mt-0.5">
                    {s.phone && <span>📞 {s.phone}</span>}
                    {s.email && <span>✉️ {s.email}</span>}
                    {s.region && <span>📍 {s.region}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {s.isAddressBook && <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded text-[9px] font-bold">Carnet</span>}
                  {s.isConnected && <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded text-[9px] font-bold">Connecté</span>}
                  <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold">Choisir →</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Direct Input Warning when no existing supplier matches */}
        {isDirectSearchMode && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                Aucun fournisseur trouvé avec "{typedInputTrimmed}" dans votre carnet d'adresses.
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                Vous pouvez directement vous approvisionner auprès de ce contact ({isInputPhone ? "Téléphone" : isInputEmail ? "Email" : "Nouveau"}).
              </p>
            </div>
            <button
              type="button"
              onClick={handleCreateOrSelectDirectSupplier}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all whitespace-nowrap"
            >
              Créer & Sélectionner
            </button>
          </div>
        )}
      </div>

      {/* Currently Selected Supplier Card */}
      {selectedSupplierObj && (
        <div className="p-3 bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Fournisseur Sélectionné : <span className="text-emerald-600 dark:text-emerald-400">{selectedSupplierObj.name} {selectedSupplierObj.companyName ? `(${selectedSupplierObj.companyName})` : ''}</span>
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex flex-wrap gap-2">
                {selectedSupplierObj.phone && <span>📞 {selectedSupplierObj.phone}</span>}
                {selectedSupplierObj.email && <span>✉️ {selectedSupplierObj.email}</span>}
                {selectedSupplierObj.region && <span>📍 {selectedSupplierObj.region}</span>}
                {selectedSupplierObj.isAddressBook && <span className="font-bold text-indigo-600 dark:text-indigo-400">[Carnet d'adresses]</span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSelectSupplier("")}
            className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline self-end sm:self-auto"
          >
            Changer
          </button>
        </div>
      )}
    </div>
  );
};

// ----------------------------------------------------------------------
// Expiration Alerts Banner Component (Visual alerts for 15-day expiry)
// ----------------------------------------------------------------------
interface ExpirationAlertsBannerProps {
  alerts: Array<{
    id: string;
    productName: string;
    expirationDate: string;
    daysRemaining: number;
    isExpired: boolean;
    message: string;
  }>;
}

export const ExpirationAlertsBanner: React.FC<ExpirationAlertsBannerProps> = ({ alerts }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [showModal, setShowModal] = useState(false);

  if (!alerts || alerts.length === 0 || !isOpen) return null;

  const expiredCount = alerts.filter(a => a.isExpired).length;
  const expiringSoonCount = alerts.filter(a => !a.isExpired).length;

  return (
    <>
      <div className="p-3 bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3 shadow-xs animate-fade-in my-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-2 bg-amber-500 text-white rounded-xl font-bold shrink-0">
            ⚠️
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200 truncate">
              {expiredCount > 0 ? `${expiredCount} produit(s) périmé(s) !` : ''} {expiringSoonCount > 0 ? `${expiringSoonCount} produit(s) expirent dans moins de 15 jours.` : ''}
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 truncate">
              Contrôlez vos stocks pour anticiper les péremptions et planifier les promotions ou déstockages.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
          >
            Voir détails ({alerts.length})
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 text-amber-700 dark:text-amber-400 hover:text-amber-900 text-xs font-bold"
            title="Masquer l'alerte"
          >
            ✕
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Alerte Péremption : Produits à surveiller (&le; 15 jours)
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    a.isExpired
                      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200'
                      : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
                  }`}
                >
                  <div>
                    <p className="font-bold">{a.productName}</p>
                    <p className="text-[10px] opacity-80 mt-0.5">
                      Date d'expiration : <span className="font-mono">{a.expirationDate}</span>
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                    a.isExpired ? 'bg-rose-600 text-white' : 'bg-amber-600 text-white'
                  }`}>
                    {a.isExpired ? 'PÉRIMÉ' : `${a.daysRemaining} j. restants`}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-zinc-800 text-white text-xs font-bold rounded-xl hover:bg-zinc-700 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ----------------------------------------------------------------------
// Recharts 30-Day Sales & Stock Trends Component
// ----------------------------------------------------------------------
interface ThirtyDaySalesAndStockChartProps {
  orders: Order[];
  inventory: InventoryItem[];
  products: Product[];
  stockMovements?: StockMovement[];
  currentUserId: string;
}

export const ThirtyDaySalesAndStockChart: React.FC<ThirtyDaySalesAndStockChartProps> = ({
  orders = [],
  inventory = [],
  products = [],
  stockMovements = [],
  currentUserId
}) => {
  const [activeTab, setActiveTab] = useState<'sales' | 'stock' | 'combined'>('sales');

  const chartData = useMemo(() => {
    // Orders where user is supplier/receiver or buyer/sender
    const mySales = orders.filter(o => o.receiverId === currentUserId || o.senderId === currentUserId);
    const myStockItems = inventory.filter(i => i.ownerId === currentUserId);
    const currentStockTotal = myStockItems.reduce((sum, item) => sum + (item.stock || 0), 0);
    const avgThreshold = myStockItems.length > 0
      ? Math.round(myStockItems.reduce((sum, i) => sum + (i.threshold || 5), 0) / myStockItems.length)
      : 10;

    const dataPoints = [];
    const now = new Date();

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const label = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;

      // Orders on this specific date
      const dayOrders = mySales.filter(o => o.createdAt && o.createdAt.startsWith(dateStr));
      const ventes = dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const volume = dayOrders.length;

      // Stock movements for this date
      const dayMovements = stockMovements.filter(m => m.ownerId === currentUserId && m.timestamp && m.timestamp.startsWith(dateStr));
      const entrees = dayMovements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.quantity, 0);
      const sorties = dayMovements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + m.quantity, 0);

      // Real stock level based on inventory
      const stockEstime = Math.max(0, currentStockTotal);

      dataPoints.push({
        date: dateStr,
        label,
        ventes,
        volume,
        entrees,
        sorties,
        stockEstime,
        seuilAlerte: avgThreshold * myStockItems.length,
      });
    }

    return dataPoints;
  }, [orders, inventory, stockMovements, currentUserId]);

  const totalVentes30j = useMemo(() => chartData.reduce((sum, d) => sum + d.ventes, 0), [chartData]);
  const totalVolume30j = useMemo(() => chartData.reduce((sum, d) => sum + d.volume, 0), [chartData]);
  const avgDailyVentes = Math.round(totalVentes30j / 30);
  const currentStockLevel = useMemo(() => {
    const items = inventory.filter(i => i.ownerId === currentUserId);
    return items.reduce((sum, i) => sum + (i.stock || 0), 0);
  }, [inventory, currentUserId]);

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4 my-4">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
              Historique 30 Jours : Ventes Quotidiennes & Tendances de Stock
            </h3>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Visualisation Recharts de l'évolution des ventes et du stock du {chartData[0]?.label} au {chartData[chartData.length - 1]?.label}.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
              activeTab === 'sales'
                ? 'bg-white dark:bg-zinc-700 text-emerald-600 dark:text-emerald-300 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            📊 Ventes Quotidiennes
          </button>
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
              activeTab === 'stock'
                ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-300 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            📈 Tendances Stock
          </button>
          <button
            onClick={() => setActiveTab('combined')}
            className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
              activeTab === 'combined'
                ? 'bg-white dark:bg-zinc-700 text-purple-600 dark:text-purple-300 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            🔀 Vue Combinée
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 border-y border-zinc-100 dark:border-zinc-800">
        <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl">
          <p className="text-[10px] font-bold text-zinc-400 uppercase">Chiffre d'Affaires (30j)</p>
          <p className="text-sm font-bold text-emerald-600 font-mono mt-0.5">{formatCFA(totalVentes30j)}</p>
        </div>
        <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl">
          <p className="text-[10px] font-bold text-zinc-400 uppercase">Ventes Mouvement / Jour</p>
          <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 font-mono mt-0.5">{formatCFA(avgDailyVentes)}</p>
        </div>
        <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl">
          <p className="text-[10px] font-bold text-zinc-400 uppercase">Commandes 30j</p>
          <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">{totalVolume30j} commande{totalVolume30j > 1 ? 's' : ''}</p>
        </div>
        <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl">
          <p className="text-[10px] font-bold text-zinc-400 uppercase">Stock Actuel</p>
          <p className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5">{currentStockLevel} unités</p>
        </div>
      </div>

      {/* Recharts Graphical Rendering */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {activeTab === 'sales' ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient30" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(120, 120, 120, 0.1)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#888888', fontSize: 9 }} interval={2} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#888888', fontSize: 9 }} tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-zinc-900 text-white p-3 rounded-xl text-xs border border-zinc-800 shadow-xl">
                        <p className="font-bold text-[11px] text-zinc-400 mb-1">Date: {data.date}</p>
                        <p className="text-emerald-400 font-bold">Ventes: {formatCFA(data.ventes)}</p>
                        <p className="text-zinc-300 text-[10px]">Commandes: {data.volume}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area type="monotone" dataKey="ventes" name="Ventes (FCFA)" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#salesGradient30)" />
            </AreaChart>
          ) : activeTab === 'stock' ? (
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(120, 120, 120, 0.1)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#888888', fontSize: 9 }} interval={2} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#888888', fontSize: 9 }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-zinc-900 text-white p-3 rounded-xl text-xs border border-zinc-800 shadow-xl">
                        <p className="font-bold text-[11px] text-zinc-400 mb-1">Date: {data.date}</p>
                        <p className="text-blue-400 font-bold">Stock Estimmé: {data.stockEstime} unités</p>
                        <p className="text-emerald-400 text-[10px]">Entrées: +{data.entrees}</p>
                        <p className="text-rose-400 text-[10px]">Sorties: -{data.sorties}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line type="monotone" dataKey="stockEstime" name="Stock Estimmé" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="seuilAlerte" name="Seuil Critique" stroke="#f59e0b" strokeDasharray="4 4" dot={false} />
            </LineChart>
          ) : (
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(120, 120, 120, 0.1)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#888888', fontSize: 9 }} interval={2} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fill: '#888888', fontSize: 9 }} tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fill: '#888888', fontSize: 9 }} />
              <Tooltip />
              <Bar yAxisId="left" dataKey="ventes" name="Ventes (FCFA)" fill="#10b981" radius={[4, 4, 0, 0]} opacity={0.7} />
              <Line yAxisId="right" type="monotone" dataKey="stockEstime" name="Stock" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// Claims & Returns Summary Widget for Seller Dashboards
// ----------------------------------------------------------------------
interface ClaimsSummaryWidgetProps {
  orders: Order[];
  users: UserProfile[];
  currentUser: UserProfile;
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, driverId?: string, claimMessage?: string, claimStatus?: "NONE" | "OPEN" | "RESOLVED") => void;
}

export const ClaimsSummaryWidget: React.FC<ClaimsSummaryWidgetProps> = ({
  orders = [],
  users = [],
  currentUser,
  onUpdateOrderStatus
}) => {
  const myClaims = useMemo(() => {
    return orders.filter(o => {
      const isMyOrder = currentUser.role === UserRole.ADMIN || o.receiverId === currentUser.id || o.senderId === currentUser.id;
      const hasClaim = !!o.claimMessage || (o.claimStatus && o.claimStatus !== "NONE");
      return isMyOrder && hasClaim;
    });
  }, [orders, currentUser]);

  const openCount = myClaims.filter(c => c.claimStatus === "OPEN" || !c.claimStatus || c.claimStatus === "NONE").length;
  const resolvedCount = myClaims.filter(c => c.claimStatus === "RESOLVED").length;

  if (myClaims.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs my-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-zinc-900 dark:text-white">Réclamations & Retours Client</h4>
            <p className="text-[11px] text-zinc-500">Aucune réclamation en cours. Tout est en ordre !</p>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full">
          0 En attente
        </span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs my-4 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              Suivi des Réclamations & Retours Client
              <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded-full">
                {openCount} ouverte{openCount > 1 ? 's' : ''}
              </span>
            </h3>
            <p className="text-[11px] text-zinc-500">
              Gérez l'état de résolution des réclamations récentes émises sur vos commandes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded-lg">
            Ouvertes: {openCount}
          </span>
          <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-lg">
            Résolues: {resolvedCount}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1">
        {myClaims.slice(0, 6).map(order => {
          const senderObj = users.find(u => u.id === order.senderId);
          const isResolved = order.claimStatus === "RESOLVED";

          return (
            <div key={order.id} className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-750 flex flex-col justify-between gap-2">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-xs font-bold text-zinc-900 dark:text-white">Commande #{order.id}</span>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Client : <span className="font-bold text-zinc-700 dark:text-zinc-300">{senderObj?.companyName || senderObj?.name || "Client"}</span>
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isResolved ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}>
                  {isResolved ? '✓ Résolu' : '⚠ Ouvert'}
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
                <p className="text-xs text-zinc-700 dark:text-zinc-300 italic">"{order.claimMessage || "Réclamation sans message détaillé."}"</p>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-[10px] text-zinc-400">Total : {formatCFA(order.totalAmount)}</span>
                <button
                  onClick={() => {
                    const newStatus = isResolved ? "OPEN" : "RESOLVED";
                    onUpdateOrderStatus(order.id, order.status, order.driverId, order.claimMessage, newStatus);
                  }}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                    isResolved 
                      ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300' 
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isResolved ? 'Marquer comme Ouvert' : 'Marquer comme Résolu ✓'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// Stock Evolution Bar Chart Widget (7-Day Trend & Replenishment Need)
// ----------------------------------------------------------------------
interface StockEvolutionBarChartProps {
  inventory: InventoryItem[];
  products: Product[];
  currentUserId: string;
}

export const StockEvolutionBarChart: React.FC<StockEvolutionBarChartProps> = ({
  inventory,
  products,
  currentUserId
}) => {
  const userInventory = inventory.filter(i => i.ownerId === currentUserId);
  
  const chartData = useMemo(() => {
    return userInventory.slice(0, 7).map(item => {
      const prod = products.find(p => p.id === item.productId);
      const name = prod ? (prod.name.length > 15 ? prod.name.substring(0, 15) + '...' : prod.name) : 'Produit';
      const stock = item.stock;
      return {
        name,
        J_6: stock,
        J_4: stock,
        Aujourd_hui: stock
      };
    });
  }, [userInventory, products]);

  if (userInventory.length === 0) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs my-4 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> Évolution du Stock (7 derniers jours)
          </h3>
          <p className="text-xs text-zinc-500">Analyse et anticipation des besoins de réapprovisionnement.</p>
        </div>
        <span className="text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 font-semibold px-3 py-1 rounded-full">
          Temps Réel
        </span>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsBarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
            <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
            <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
            />
            <Bar dataKey="J_6" fill="#a1a1aa" radius={[4, 4, 0, 0]} name="J-6" />
            <Bar dataKey="Aujourd_hui" fill="#10b981" radius={[4, 4, 0, 0]} name="Aujourd'hui" />
          </RechartsBarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export function handleExportInventoryCSV(inventory: InventoryItem[], products: Product[], currentUserId: string) {
  const userInventory = inventory.filter(i => i.ownerId === currentUserId);
  if (userInventory.length === 0) {
    alert("Aucun stock à exporter.");
    return;
  }

  const headers = ["ID Produit", "Nom du Produit", "Catégorie", "Stock Actuel", "Seuil d'alerte", "Prix Unitaire (CFA)"];
  const rows = userInventory.map(item => {
    const prod = products.find(p => p.id === item.productId);
    return [
      item.productId,
      `"${prod?.name || 'Produit'}"`,
      `"${prod?.category || 'Général'}"`,
      item.stock,
      item.threshold || 5,
      prod?.prixGros || prod?.prixDetail || 1000
    ];
  });

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `inventaire_wakatmarket_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}





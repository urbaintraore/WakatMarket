import React, { useState, useEffect } from "react";
import { Bell, Check, Users, CheckCircle2, XCircle, Info, Smartphone, FileText, AlertTriangle } from "lucide-react";
import { connectionService } from "../services/connectionService";
import { PartnerNotificationItem } from "../types";
import { db } from "../data";

interface NotificationBellProps {
  currentUserId: string;
  onSelectRelation?: (relationId: string) => void;
  onSelectNotification?: (notification: PartnerNotificationItem) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ 
  currentUserId, 
  onSelectRelation,
  onSelectNotification
}) => {
  const [notifications, setNotifications] = useState<PartnerNotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<Record<string, "accepted" | "rejected">>({});
  const [relationStatuses, setRelationStatuses] = useState<Record<string, "en_attente" | "active" | "refusee" | "inconnu">>({});
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    if (!currentUserId) return;

    // Direct real-time onSnapshot subscription with strict lifecycle cleanup (unsubscribe)
    const unsubscribe = connectionService.subscribeToUserNotifications(currentUserId, (notifs) => {
      setNotifications(notifs);
    });

    const handleCustomUpdate = () => {
      setRefreshTrigger(prev => prev + 1);
    };
    window.addEventListener("wakat_notifications_updated", handleCustomUpdate);
    window.addEventListener("wakat_connections_updated", handleCustomUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener("wakat_notifications_updated", handleCustomUpdate);
      window.removeEventListener("wakat_connections_updated", handleCustomUpdate);
    };
  }, [currentUserId]);

  useEffect(() => {
    if (notifications.length === 0) return;

    let isMounted = true;

    const fetchStatuses = async () => {
      const statusesToFetch = notifications.filter(n => {
        const isPartnerReq = 
          n.type === "demande_connexion" || 
          n.type === "CONNECTION_REQUEST" || 
          n.type === "demande_partenariat" || 
          n.type === "connexion_acceptee" ||
          n.type === "connexion_refusee" ||
          (n.title && n.title.toLowerCase().includes("partenariat")) || 
          (n.contenu && n.contenu.toLowerCase().includes("partenariat"));
        return isPartnerReq;
      });

      if (statusesToFetch.length === 0) return;

      const newStatuses: Record<string, "en_attente" | "active" | "refusee" | "inconnu"> = {};

      for (const n of statusesToFetch) {
        const relId = n.relationId || n.relatedId || (n as any).metadata?.related_id || (n as any).metadata?.relation_id || (n as any).metadata?.relationId;
        const senderId = n.senderId || (n as any).expediteurId || (n as any).metadata?.sender_id;
        
        try {
          const status = await connectionService.getRelationStatusFromSupabase(relId, currentUserId, senderId);
          newStatuses[n.id] = status;
        } catch (err) {
          console.error(`Error fetching status for notification ${n.id}:`, err);
          newStatuses[n.id] = "inconnu";
        }
      }

      if (isMounted) {
        setRelationStatuses(prev => ({ ...prev, ...newStatuses }));
      }
    };

    fetchStatuses();

    return () => {
      isMounted = false;
    };
  }, [notifications, currentUserId, refreshTrigger]);

  const unreadCount = notifications.filter((n) => !n.lu).length;

  const handleMarkAsRead = async (notif: PartnerNotificationItem) => {
    try {
      await connectionService.markNotificationAsRead(currentUserId, notif.id);
      if (notif.relationId && onSelectRelation) {
        onSelectRelation(notif.relationId);
        setIsOpen(false);
      } else if (onSelectNotification) {
        onSelectNotification(notif);
        setIsOpen(false);
      }
    } catch (e) {
      console.error("Error marking notification read:", e);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "preuve_paiement_a_valider":
        return <Smartphone className="w-5 h-5 text-amber-600 flex-shrink-0" />;
      case "paiement_valide":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />;
      case "paiement_rejete":
        return <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />;
      case "connexion_acceptee":
        return <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />;
      case "connexion_refusee":
        return <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />;
      case "demande_connexion":
      default:
        return <Users className="w-5 h-5 text-amber-600 flex-shrink-0" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500"
        title="Notifications de partenariat"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-red-600 text-white font-bold text-xs rounded-full min-w-[20px] text-center shadow-sm animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Popover */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                <h3 className="font-semibold text-slate-800 text-sm">Notifications Partenaires</h3>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
              </span>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">
                  <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p>Aucune notification pour le moment.</p>
                </div>
              ) : (
                notifications.map((n, idx) => {
                  const isPartnerReq = 
                    n.type === "demande_connexion" || 
                    n.type === "CONNECTION_REQUEST" || 
                    n.type === "demande_partenariat" || 
                    n.type === "connexion_acceptee" ||
                    n.type === "connexion_refusee" ||
                    (n.title && n.title.toLowerCase().includes("partenariat")) || 
                    (n.contenu && n.contenu.toLowerCase().includes("partenariat"));

                  const status = relationStatuses[n.id];

                  return (
                    <div
                      key={`${n.id}_${idx}`}
                      onClick={() => handleMarkAsRead(n)}
                      className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 hover:bg-slate-50 ${
                        !n.lu ? "bg-amber-50/40" : ""
                      }`}
                    >
                      {getNotifIcon(n.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs ${!n.lu ? "font-semibold text-slate-900" : "text-slate-700"} flex-1`}>
                            {n.contenu}
                          </p>
                          {isPartnerReq && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider h-fit flex-shrink-0 whitespace-nowrap border ${
                              status === "active" 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800" 
                                : status === "refusee"
                                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-800"
                                : status === "en_attente"
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800"
                                : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-950/20 dark:text-slate-400 dark:border-slate-800"
                            }`}>
                              {status === "active" ? "Accepté" : status === "refusee" ? "Refusé" : status === "en_attente" ? "En attente" : "..."}
                            </span>
                          )}
                        </div>

                        {/* Accept/Refuse Actions inside the Notification dropdown */}
                        {(() => {
                          if (!isPartnerReq || n.type === "connexion_acceptee") return null;

                          const relId = n.relationId || n.relatedId || (n as any).metadata?.related_id || (n as any).metadata?.relation_id || (n as any).metadata?.relationId;
                          const senderId = n.senderId || (n as any).expediteurId || (n as any).metadata?.sender_id;
                          
                          const allConns = db.getConnections();
                          const matchingConn = relId 
                            ? allConns.find(c => c.id === relId)
                            : (senderId ? allConns.find(c => (c.senderId === senderId && c.receiverId === currentUserId) || (c.senderId === currentUserId && c.receiverId === senderId)) : null);

                          const currentStatus = relationStatuses[n.id] || matchingConn?.status;

                          const isAlreadyActive = currentStatus === "active" || (matchingConn && (matchingConn.status === "active" || (matchingConn as any).statut === "ACTIF")) || actionFeedback[n.id] === "accepted";
                          if (isAlreadyActive) {
                            return (
                              <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Partenariat actif & confirmé</span>
                              </div>
                            );
                          }

                          const isAlreadyRejected = currentStatus === "refusee" || currentStatus === "refusée" || (matchingConn && (matchingConn.status === "refusée" || (matchingConn as any).statut === "BLOCKED")) || actionFeedback[n.id] === "rejected";
                          if (isAlreadyRejected) {
                            return (
                              <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Demande de partenariat refusée</span>
                              </div>
                            );
                          }

                          // Strict check: Only show action buttons to the receiver of the connection request.
                          // The sender of the connection request must not see the accept/reject buttons.
                          const isReceiver = senderId ? (senderId !== currentUserId) : (matchingConn ? matchingConn.receiverId === currentUserId : true);

                          if (!isReceiver) {
                            return (
                              <div className="mt-2 text-[10px] font-medium text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                                Demande de partenariat en attente de validation
                              </div>
                            );
                          }

                          const targetRelationId = relId || matchingConn?.id;
                          const isLoading = actionLoadingId === n.id;

                          return (
                            <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setActionLoadingId(n.id);
                                  try {
                                    if (targetRelationId) {
                                      await connectionService.acceptConnection(targetRelationId, currentUserId);
                                    } else if (matchingConn) {
                                      await connectionService.respondToConnectionRequest(matchingConn, "active");
                                    }
                                    await connectionService.markNotificationAsRead(currentUserId, n.id);
                                    setActionFeedback(prev => ({ ...prev, [n.id]: "accepted" }));
                                    setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, lu: true, read: true } : item));
                                  } catch (err) {
                                    console.error("Error accepting from notification:", err);
                                  } finally {
                                    setActionLoadingId(null);
                                  }
                                }}
                                className="flex-1 py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer active:scale-95"
                              >
                                <Check className="w-3.5 h-3.5" /> {isLoading ? "Validation..." : "Accepter le partenariat"}
                              </button>
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setActionLoadingId(n.id);
                                  try {
                                    if (targetRelationId) {
                                      await connectionService.rejectConnection(targetRelationId, currentUserId);
                                    } else if (matchingConn) {
                                      await connectionService.respondToConnectionRequest(matchingConn, "refusée");
                                    }
                                    await connectionService.markNotificationAsRead(currentUserId, n.id);
                                    setActionFeedback(prev => ({ ...prev, [n.id]: "rejected" }));
                                    setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, lu: true, read: true } : item));
                                  } catch (err) {
                                    console.error("Error rejecting from notification:", err);
                                  } finally {
                                    setActionLoadingId(null);
                                  }
                                }}
                                className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 rounded-lg text-[10px] font-bold transition flex items-center justify-center border border-slate-200 cursor-pointer active:scale-95"
                              >
                                Refuser
                              </button>
                            </div>
                          );
                        })()}

                        <p className="text-[10px] text-slate-400 mt-1">
                          {n.dateCreation
                            ? typeof n.dateCreation === "string"
                              ? new Date(n.dateCreation).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
                              : new Date(n.dateCreation.seconds * 1000).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
                            : "À l'instant"}
                        </p>
                      </div>
                      {!n.lu && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" title="Non lu" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

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

  useEffect(() => {
    if (!currentUserId) return;

    // Direct real-time onSnapshot subscription with strict lifecycle cleanup (unsubscribe)
    const unsubscribe = connectionService.subscribeToUserNotifications(currentUserId, (notifs) => {
      setNotifications(notifs);
    });

    const handleCustomUpdate = () => {
      // Re-trigger if custom event fired
    };
    window.addEventListener("wakat_notifications_updated", handleCustomUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener("wakat_notifications_updated", handleCustomUpdate);
    };
  }, [currentUserId]);

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
                notifications.map((n, idx) => (
                  <div
                    key={`${n.id}_${idx}`}
                    onClick={() => handleMarkAsRead(n)}
                    className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 hover:bg-slate-50 ${
                      !n.lu ? "bg-amber-50/40" : ""
                    }`}
                  >
                    {getNotifIcon(n.type)}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${!n.lu ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                        {n.contenu}
                      </p>

                      {/* Accept/Refuse Actions inside the Notification dropdown */}
                      {n.type === "demande_connexion" && (n.relationId || n.relatedId) && (() => {
                        const relId = n.relationId || n.relatedId;
                        const relatedConn = db.getConnections().find(c => c.id === relId);
                        const isPending = !relatedConn || relatedConn.status === "en_attente" || (relatedConn as any).statut === "en_attente" || (relatedConn as any).statut === "PENDING";
                        if (!isPending) return null;
                        
                        return (
                          <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  if (relId) await connectionService.acceptConnection(relId, currentUserId);
                                  await connectionService.markNotificationAsRead(currentUserId, n.id);
                                } catch (err) {
                                  console.error("Error accepting from notification:", err);
                                }
                              }}
                              className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                            >
                              <Check className="w-3 h-3" /> Accepter
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  if (relId) await connectionService.rejectConnection(relId, currentUserId);
                                  await connectionService.markNotificationAsRead(currentUserId, n.id);
                                } catch (err) {
                                  console.error("Error rejecting from notification:", err);
                                }
                              }}
                              className="py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition flex items-center justify-center border border-slate-200 cursor-pointer"
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
                ))
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

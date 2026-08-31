import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../data';
import { Connection, isConnectionActive } from '../types';
import { CheckCircle2, Clock, XCircle, Link as LinkIcon, ShieldCheck, UserCheck } from 'lucide-react';

interface PartnerConnectionBadgeProps {
  partnerId: string;
  currentUserId?: string;
  className?: string;
  showDetails?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * PartnerConnectionBadge
 * Queries db.getConnections() directly to bypass asynchronous React state lag
 * and ensure immediate visual reflection of partnership status.
 */
export const PartnerConnectionBadge: React.FC<PartnerConnectionBadgeProps> = ({
  partnerId,
  currentUserId,
  className = "",
  showDetails = false,
  size = 'md'
}) => {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setVersion(v => v + 1);
    };
    window.addEventListener("wakat_connections_updated", handleUpdate);
    window.addEventListener("wakat_partnership_established", handleUpdate);
    return () => {
      window.removeEventListener("wakat_connections_updated", handleUpdate);
      window.removeEventListener("wakat_partnership_established", handleUpdate);
    };
  }, []);

  // Directly query db.getConnections() to avoid stale state
  const connState = useMemo(() => {
    if (!partnerId) return null;
    const allConns = db.getConnections();

    // Find connection matching partnerId (and currentUserId if available)
    const conn = allConns.find(c => {
      if (currentUserId) {
        const isPair = (c.senderId === partnerId && c.receiverId === currentUserId) ||
                       (c.senderId === currentUserId && c.receiverId === partnerId) ||
                       ((c as any).grossiste_id === partnerId && (c as any).client_id === currentUserId) ||
                       ((c as any).grossiste_id === currentUserId && (c as any).client_id === partnerId);
        return isPair;
      }
      return c.senderId === partnerId || c.receiverId === partnerId ||
             (c as any).grossiste_id === partnerId || (c as any).client_id === partnerId;
    });

    if (!conn) return null;

    const isActive = isConnectionActive(conn) || conn.status === "active" || (conn as any).statut === "ACTIF";
    const isRejected = conn.status === "refusée" || conn.status === "refusee" || (conn as any).statut === "BLOCKED";
    const isSender = currentUserId ? conn.senderId === currentUserId : false;

    return {
      conn,
      isActive,
      isRejected,
      isPending: !isActive && !isRejected,
      isSender,
      id: conn.id
    };
  }, [partnerId, currentUserId, version]);

  const sizeClasses = size === 'sm' 
    ? 'text-[8.5px] px-1.5 py-0.5 gap-1' 
    : size === 'lg' 
    ? 'text-xs px-3 py-1 gap-1.5' 
    : 'text-[9.5px] px-2.5 py-0.5 gap-1.5';

  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : size === 'lg' ? 'w-3.5 h-3.5' : 'w-3 h-3';

  if (!connState) {
    return (
      <span 
        title="Aucune relation de partenariat enregistrée"
        className={`inline-flex items-center rounded-full font-bold bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 select-none ${sizeClasses} ${className}`}
      >
        <LinkIcon className={`${iconSize} opacity-50`} />
        <span>Non connecté</span>
      </span>
    );
  }

  if (connState.isActive) {
    return (
      <span 
        title={`Partenariat B2B actif et confirmé (Connexion #${connState.id})`}
        className={`inline-flex items-center rounded-full font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/70 shadow-xs select-none ${sizeClasses} ${className}`}
      >
        <CheckCircle2 className={`${iconSize} text-emerald-600 dark:text-emerald-400 shrink-0`} />
        <span>Partenaire Actif</span>
        {showDetails && <span className="text-[8px] opacity-80 font-semibold lowercase tracking-normal">(validé)</span>}
      </span>
    );
  }

  if (connState.isRejected) {
    return (
      <span 
        title={`Demande de partenariat refusée (Connexion #${connState.id})`}
        className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 select-none ${sizeClasses} ${className}`}
      >
        <XCircle className={`${iconSize} text-rose-600 dark:text-rose-400 shrink-0`} />
        <span>Refusé</span>
      </span>
    );
  }

  // Pending status
  return (
    <span 
      title={connState.isSender ? "Demande de partenariat envoyée, en attente de réponse" : "Demande de partenariat reçue, en attente de votre validation"}
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700/60 select-none ${sizeClasses} ${className}`}
    >
      <Clock className={`${iconSize} text-amber-600 dark:text-amber-400 animate-pulse shrink-0`} />
      <span>{connState.isSender ? "Demande envoyée" : "En attente"}</span>
    </span>
  );
};

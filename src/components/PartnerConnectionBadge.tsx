import React, { useMemo, useState, useEffect } from 'react';
import { db } from '../data';
import { Connection, isConnectionActive } from '../types';
import { ShieldCheck, ShieldAlert, Shield, Lock, Unlock, Clock, XCircle, CheckCircle2 } from 'lucide-react';

export interface PartnerConnectionBadgeProps {
  partnerId: string;
  currentUserId?: string;
  className?: string;
  showDetails?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'icon' | 'inline';
}

/**
 * PartnerConnectionBadge
 * Visual partnership indicator (Shield / Lock icons) displaying active or pending
 * partnership status directly beside vendor names across catalogs and order forms.
 * Queries db.getConnections() directly for instant responsiveness.
 */
export const PartnerConnectionBadge: React.FC<PartnerConnectionBadgeProps> = ({
  partnerId,
  currentUserId,
  className = "",
  showDetails = false,
  size = 'md',
  variant = 'badge'
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
    const isRejected = conn.status === "refusée" || (conn.status as string) === "refusee" || (conn as any).statut === "BLOCKED";
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

  const sizeClasses = size === 'xs'
    ? 'text-[8px] px-1.5 py-0.5 gap-1'
    : size === 'sm'
    ? 'text-[8.5px] px-2 py-0.5 gap-1'
    : size === 'lg'
    ? 'text-xs px-3 py-1 gap-1.5'
    : 'text-[9.5px] px-2.5 py-0.5 gap-1.5';

  const iconSize = size === 'xs' ? 'w-2.5 h-2.5' : size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  // If icon-only variant requested
  if (variant === 'icon') {
    if (!connState) {
      return (
        <span
          title="Partenariat non établi (Cadenas verrouillé)"
          className={`inline-flex items-center justify-center text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 transition-colors ${className}`}
        >
          <Lock className={iconSize} />
        </span>
      );
    }

    if (connState.isActive) {
      return (
        <span
          title={`Partenaire commercial vérifié et actif 🛡️ (Connexion #${connState.id})`}
          className={`inline-flex items-center justify-center text-emerald-600 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-950/60 p-1 rounded-md shadow-xs ${className}`}
        >
          <ShieldCheck className={iconSize} />
        </span>
      );
    }

    if (connState.isRejected) {
      return (
        <span
          title="Demande de partenariat refusée"
          className={`inline-flex items-center justify-center text-rose-500 bg-rose-100/60 dark:bg-rose-950/60 p-1 rounded-md ${className}`}
        >
          <XCircle className={iconSize} />
        </span>
      );
    }

    return (
      <span
        title={connState.isSender ? "Demande de partenariat envoyée (En attente)" : "Demande de partenariat reçue (En attente)"}
        className={`inline-flex items-center justify-center text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/60 p-1 rounded-md animate-pulse ${className}`}
      >
        <ShieldAlert className={iconSize} />
      </span>
    );
  }

  // Not connected
  if (!connState) {
    return (
      <span
        title="Aucune relation de partenariat active (Cadenas)"
        className={`inline-flex items-center rounded-full font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 select-none ${sizeClasses} ${className}`}
      >
        <Lock className={`${iconSize} opacity-70`} />
        <span>Non partenaire</span>
      </span>
    );
  }

  // Active partnership
  if (connState.isActive) {
    return (
      <span
        title={`Partenaire commercial vérifié et actif (Bouclier de confiance, Réf: ${connState.id})`}
        className={`inline-flex items-center rounded-full font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/80 shadow-xs select-none ${sizeClasses} ${className}`}
      >
        <ShieldCheck className={`${iconSize} text-emerald-600 dark:text-emerald-400 shrink-0`} />
        <span>Partenaire Actif</span>
        {showDetails && <span className="text-[8px] opacity-80 font-semibold lowercase tracking-normal">(validé)</span>}
      </span>
    );
  }

  // Rejected
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
      title={connState.isSender ? "Demande de partenariat envoyée, en attente de confirmation" : "Demande de partenariat reçue, en attente de votre validation"}
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/70 select-none ${sizeClasses} ${className}`}
    >
      <ShieldAlert className={`${iconSize} text-amber-600 dark:text-amber-400 animate-pulse shrink-0`} />
      <span>{connState.isSender ? "Demande envoyée" : "En attente"}</span>
    </span>
  );
};

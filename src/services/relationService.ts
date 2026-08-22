import { Relation, PartnerNotificationItem, UserProfile, UserRole } from "../types";
import { supabase } from "../supabase";

export const relationService = {
  /**
   * 1. Envoyer ou créer une relation de partenariat d'affaires B2B dans PostgreSQL (table relations)
   */
  async envoyerDemandeConnexion(
    demandeur: UserProfile, 
    destinataireIdentifiant: string, 
    notes: string = ""
  ): Promise<{ success: boolean; relationId: string; destinataireNom: string; message: string }> {
    if (!supabase) {
      throw new Error("Supabase n'est pas configuré.");
    }

    const cleanIdentifiant = destinataireIdentifiant.trim().toLowerCase();

    // 1. Chercher le destinataire dans la table 'profiles'
    const { data: users, error: searchError } = await supabase
      .from("profiles")
      .select("*")
      .or(`email.ilike.${cleanIdentifiant},telephone.ilike.${cleanIdentifiant},id.eq.${cleanIdentifiant}`);

    if (searchError || !users || users.length === 0) {
      throw new Error(`Aucun utilisateur trouvé avec l'identifiant "${destinataireIdentifiant}".`);
    }

    const destinataireRow = users[0];
    if (destinataireRow.id === demandeur.id) {
      throw new Error("Vous ne pouvez pas vous enregistrer vous-même comme partenaire d'affaires.");
    }

    const relationId = [demandeur.id, destinataireRow.id].sort().join("_");
    const demandeurNom = demandeur.companyName || demandeur.name;
    const destinataireNom = [destinataireRow.nom, destinataireRow.prenom].filter(Boolean).join(" ").trim() || "Partenaire";

    // 2. Insérer ou mettre à jour la relation dans 'relations' (grossiste_id, client_id, statut)
    const payloadSent = {
      id: relationId,
      grossiste_id: demandeur.id,
      client_id: destinataireRow.id,
      statut: "ACTIF"
    };

    const { error: relError } = await supabase
      .from("relations")
      .upsert(payloadSent);

    if (relError) {
      console.error("[Relations Supabase Error]", {
        operation: "envoyerDemandeConnexion",
        userId: demandeur.id,
        payloadSent,
        code: relError.code,
        message: relError.message,
        details: relError.details,
        hint: relError.hint
      });
      throw relError;
    }

    // 3. Envoyer une notification au destinataire
    try {
      await supabase.from("notifications").insert({
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        user_id: destinataireRow.id,
        title: "Nouveau partenaire d'affaires",
        message: `${demandeurNom} (${demandeur.role}) vous a ajouté comme partenaire commercial.`,
        read: false
      });
    } catch (notifErr) {
      console.warn("Notice insertion notification:", notifErr);
    }

    return {
      success: true,
      relationId,
      destinataireNom,
      message: `Partenariat établi avec succès avec ${destinataireNom}.`
    };
  },

  /**
   * 2. Accepter une demande de connexion
   */
  async accepterDemandeConnexion(relationId: string, _destinataireId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from("relations")
      .update({ statut: "ACTIF" })
      .eq("id", relationId);

    if (error) {
      console.error("[Relations Supabase Error]", {
        operation: "accepterDemandeConnexion",
        relationId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
  },

  /**
   * 3. Refuser une demande de connexion
   */
  async refuserDemandeConnexion(relationId: string, _destinataireId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from("relations")
      .update({ statut: "BLOCKED" })
      .eq("id", relationId);

    if (error) {
      console.error("[Relations Supabase Error]", {
        operation: "refuserDemandeConnexion",
        relationId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
  },

  /**
   * 4. Bloquer un partenaire
   */
  async bloquerPartenaire(relationId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from("relations")
      .update({ statut: "BLOCKED" })
      .eq("id", relationId);

    if (error) {
      console.error("[Relations Supabase Error]", {
        operation: "bloquerPartenaire",
        relationId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
  },

  /**
   * 5. Supprimer une relation
   */
  async supprimerRelation(relationId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from("relations")
      .delete()
      .eq("id", relationId);

    if (error) {
      console.error("[Relations Supabase Error]", {
        operation: "supprimerRelation",
        relationId,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
  },

  /**
   * 6. Écouter les relations d'un utilisateur en temps réel depuis PostgreSQL
   */
  ecouterRelations(userId: string, callback: (relations: Relation[]) => void): () => void {
    if (!supabase || !userId) return () => {};

    const fetchRelations = async () => {
      const { data, error } = await supabase
        .from("relations")
        .select("*")
        .or(`grossiste_id.eq.${userId},client_id.eq.${userId}`);

      if (error) {
        console.error("[Relations Supabase Error]", {
          operation: "ecouterRelations (fetch)",
          userId,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        return;
      }

      const mapped: Relation[] = (data || []).map((row: any) => ({
        id: row.id,
        demandeurId: row.grossiste_id,
        destinataireId: row.client_id,
        statut: (row.statut === "ACTIF" || row.statut === "actif" ? "actif" : row.statut === "BLOCKED" || row.statut === "refuse" ? "refuse" : "en_attente") as any,
        dateCreation: row.created_at || new Date().toISOString(),
        dateReponse: row.created_at || new Date().toISOString(),
        participants: [row.grossiste_id, row.client_id].filter(Boolean),
        notes: "",
        demandeurNom: row.grossiste_id === userId ? "Moi" : "Partenaire",
        demandeurRole: UserRole.WHOLESALER,
        destinataireNom: row.client_id === userId ? "Moi" : "Partenaire",
        destinataireRole: UserRole.RETAILER
      }));
      callback(mapped);
    };

    fetchRelations();

    const uniqueId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`public:relations:${userId}:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "relations" },
        () => {
          fetchRelations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * 7. Écouter les notifications de partenariat en temps réel
   */
  ecouterNotifications(userId: string, callback: (notifs: PartnerNotificationItem[]) => void): () => void {
    if (!supabase || !userId) return () => {};

    const fetchNotifs = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erreur fetch notifications Supabase:", error);
        return;
      }

      const mapped: PartnerNotificationItem[] = (data || []).map((n: any) => ({
        id: n.id,
        type: "connexion_acceptee",
        lu: n.read || false,
        dateCreation: n.created_at || new Date().toISOString(),
        contenu: n.message || n.title
      }));
      callback(mapped);
    };

    fetchNotifs();

    const uniqueId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`public:notifications:${userId}:${uniqueId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => {
          fetchNotifs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  /**
   * Marquer une notification comme lue
   */
  async marquerNotificationLue(userId: string, notifId: string): Promise<void> {
    if (!supabase) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notifId)
      .eq("user_id", userId);
  },

  /**
   * Alias pour marquerNotificationLue
   */
  async marquerNotificationCommeLue(userId: string, notifId: string): Promise<void> {
    return this.marquerNotificationLue(userId, notifId);
  },

  /**
   * Alias pour ecouterNotifications
   */
  subscribeToUserNotifications(userId: string, callback: (notifs: PartnerNotificationItem[]) => void): () => void {
    return this.ecouterNotifications(userId, callback);
  }
};


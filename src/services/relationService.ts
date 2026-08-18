import { Relation, PartnerNotificationItem, UserProfile, UserRole } from "../types";
import { supabase } from "../supabase";

export const relationService = {
  /**
   * 1. Envoyer ou créer une relation de partenariat d'affaires B2B dans PostgreSQL
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
      .or(`email.ilike.${cleanIdentifiant},phone.ilike.${cleanIdentifiant},id.eq.${cleanIdentifiant}`);

    if (searchError || !users || users.length === 0) {
      throw new Error(`Aucun utilisateur trouvé avec l'identifiant "${destinataireIdentifiant}".`);
    }

    const destinataireRow = users[0];
    if (destinataireRow.id === demandeur.id) {
      throw new Error("Vous ne pouvez pas vous enregistrer vous-même comme partenaire d'affaires.");
    }

    const relationId = [demandeur.id, destinataireRow.id].sort().join("_");
    const demandeurNom = demandeur.companyName || demandeur.name;
    const destinataireNom = destinataireRow.company_name || destinataireRow.name;

    // 2. Insérer ou mettre à jour la relation dans 'business_relationships'
    const { error: relError } = await supabase
      .from("business_relationships")
      .upsert({
        id: relationId,
        supplier_id: demandeur.id,
        buyer_id: destinataireRow.id,
        status: "ACTIVE",
        payment_terms: notes || null,
        updated_at: new Date().toISOString()
      });

    if (relError) {
      console.error("Erreur upsert business_relationships:", relError);
      throw relError;
    }

    // 3. Envoyer une notification au destinataire
    await supabase.from("notifications").insert({
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      user_id: destinataireRow.id,
      title: "Nouveau partenaire d'affaires",
      message: `${demandeurNom} (${demandeur.role}) vous a ajouté comme partenaire commercial.`,
      type: "connexion_acceptee",
      read: false,
      metadata: { relationId, senderId: demandeur.id }
    });

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
      .from("business_relationships")
      .update({ status: "ACTIVE", updated_at: new Date().toISOString() })
      .eq("id", relationId);

    if (error) {
      console.error("Erreur accepter relation:", error);
      throw error;
    }
  },

  /**
   * 3. Refuser une demande de connexion
   */
  async refuserDemandeConnexion(relationId: string, _destinataireId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from("business_relationships")
      .update({ status: "BLOCKED", updated_at: new Date().toISOString() })
      .eq("id", relationId);

    if (error) {
      console.error("Erreur refuser relation:", error);
      throw error;
    }
  },

  /**
   * 4. Bloquer un partenaire
   */
  async bloquerPartenaire(relationId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from("business_relationships")
      .update({ status: "BLOCKED", updated_at: new Date().toISOString() })
      .eq("id", relationId);

    if (error) {
      console.error("Erreur bloquer relation:", error);
      throw error;
    }
  },

  /**
   * 5. Supprimer une relation
   */
  async supprimerRelation(relationId: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from("business_relationships")
      .delete()
      .eq("id", relationId);

    if (error) {
      console.error("Erreur suppression relation:", error);
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
        .from("business_relationships")
        .select("*, supplier:profiles!business_relationships_supplier_id_fkey(name, role, company_name), buyer:profiles!business_relationships_buyer_id_fkey(name, role, company_name)")
        .or(`supplier_id.eq.${userId},buyer_id.eq.${userId}`);

      if (error) {
        // Simple fallback without join if foreign keys have different naming
        const { data: simpleData } = await supabase
          .from("business_relationships")
          .select("*")
          .or(`supplier_id.eq.${userId},buyer_id.eq.${userId}`);

        const mapped = (simpleData || []).map((row: any) => ({
          id: row.id,
          demandeurId: row.supplier_id,
          destinataireId: row.buyer_id,
          statut: (row.status === "ACTIVE" ? "actif" : row.status === "BLOCKED" ? "refuse" : "en_attente") as any,
          dateCreation: row.created_at,
          dateReponse: row.updated_at,
          participants: [row.supplier_id, row.buyer_id],
          notes: row.payment_terms || "",
          demandeurNom: row.supplier_id === userId ? "Moi" : "Partenaire",
          demandeurRole: UserRole.WHOLESALER,
          destinataireNom: row.buyer_id === userId ? "Moi" : "Partenaire",
          destinataireRole: UserRole.RETAILER
        }));
        callback(mapped);
        return;
      }

      const mapped: Relation[] = (data || []).map((row: any) => ({
        id: row.id,
        demandeurId: row.supplier_id,
        destinataireId: row.buyer_id,
        statut: (row.status === "ACTIVE" ? "actif" : row.status === "BLOCKED" ? "refuse" : "en_attente") as any,
        dateCreation: row.created_at,
        dateReponse: row.updated_at,
        participants: [row.supplier_id, row.buyer_id],
        notes: row.payment_terms || "",
        demandeurNom: row.supplier?.company_name || row.supplier?.name || "Fournisseur",
        demandeurRole: (row.supplier?.role || UserRole.WHOLESALER) as any,
        destinataireNom: row.buyer?.company_name || row.buyer?.name || "Client",
        destinataireRole: (row.buyer?.role || UserRole.RETAILER) as any
      }));
      callback(mapped);
    };

    fetchRelations();

    const channel = supabase
      .channel(`public:business_relationships:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_relationships" },
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
        type: n.type || "connexion_acceptee",
        relationId: n.metadata?.relationId,
        venteId: n.metadata?.venteId,
        orderId: n.metadata?.orderId,
        expediteurId: n.metadata?.senderId,
        lu: n.read || false,
        dateCreation: n.created_at,
        contenu: n.message || n.title
      }));
      callback(mapped);
    };

    fetchNotifs();

    const channel = supabase
      .channel(`public:notifications:${userId}`)
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

import { 
  collection, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  getDocs, 
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase/firebase";
import { Relation, PartnerNotificationItem, UserProfile, Connection } from "../types";
import { db as localDb } from "../data";

export const relationService = {
  /**
   * 1. Envoyer une demande de connexion (Transaction atomique)
   * Crée /relations/{relationId} + notification dans /notifications/{destinataireId}/items/{notifId}
   */
  async envoyerDemandeConnexion(
    demandeur: UserProfile, 
    destinataireIdentifiant: string, 
    notes: string = ""
  ): Promise<{ success: boolean; relationId: string; destinataireNom: string; message: string }> {
    const cleanIdentifiant = destinataireIdentifiant.trim().toLowerCase();

    // 1. Chercher le destinataire dans Firestore /users ou dans localDb
    let destinataire: UserProfile | null = null;

    try {
      // Recherche Firestore par phone ou email
      const usersRef = collection(db, "users");
      const qPhone = query(usersRef, where("phone", "==", destinataireIdentifiant.trim()));
      const snapPhone = await getDocs(qPhone);

      if (!snapPhone.empty) {
        destinataire = { id: snapPhone.docs[0].id, ...snapPhone.docs[0].data() } as UserProfile;
      } else {
        const qEmail = query(usersRef, where("email", "==", cleanIdentifiant));
        const snapEmail = await getDocs(qEmail);
        if (!snapEmail.empty) {
          destinataire = { id: snapEmail.docs[0].id, ...snapEmail.docs[0].data() } as UserProfile;
        }
      }
    } catch (err) {
      console.warn("[relationService] Erreur recherche Firestore, tentative locale:", err);
    }

    // Fallback recherche dans localDb
    if (!destinataire) {
      const allUsers = localDb.getUsers();
      destinataire = allUsers.find(u => 
        u.id === destinataireIdentifiant.trim() ||
        u.phone === destinataireIdentifiant.trim() || 
        u.email.toLowerCase() === cleanIdentifiant
      ) || null;
    }

    if (!destinataire) {
      throw new Error(`Aucun utilisateur trouvé avec l'identifiant "${destinataireIdentifiant}".`);
    }

    if (destinataire.id === demandeur.id) {
      throw new Error("Vous ne pouvez pas vous envoyer une demande de connexion à vous-même.");
    }

    const relationId = [demandeur.id, destinataire.id].sort().join('_');
    const relationRef = doc(db, "relations", relationId);
    const legacyConnRef = doc(db, "connections", relationId);
    
    // Référence de sous-collection /notifications/{destinataireId}/items/{notifId}
    const notifItemRef = doc(collection(db, "notifications", destinataire.id, "items"));

    const demandeurNom = demandeur.companyName || demandeur.name;
    const destinataireNom = destinataire.companyName || destinataire.name;

    // Transaction atomique Firestore
    try {
      await runTransaction(db, async (transaction) => {
        const relDoc = await transaction.get(relationRef);
        if (relDoc.exists()) {
          const data = relDoc.data() as Relation;
          if (data.statut === "actif") {
            throw new Error("Vous êtes déjà en relation active avec ce partenaire.");
          }
          if (data.statut === "en_attente") {
            throw new Error("Une demande de connexion est déjà en attente pour ce partenaire.");
          }
        }

        const now = serverTimestamp();

        // 1. Écriture /relations/{relationId}
        const newRelation: Omit<Relation, "id"> = {
          demandeurId: demandeur.id,
          destinataireId: destinataire!.id,
          statut: "en_attente",
          dateCreation: now,
          dateReponse: null,
          participants: [demandeur.id, destinataire!.id],
          notes,
          demandeurNom,
          demandeurRole: demandeur.role,
          destinataireNom,
          destinataireRole: destinataire!.role
        };
        transaction.set(relationRef, newRelation, { merge: true });

        // Rétrocompatibilité /connections
        transaction.set(legacyConnRef, {
          id: relationId,
          senderId: demandeur.id,
          receiverId: destinataire!.id,
          status: "en_attente",
          senderName: demandeurNom,
          senderRole: demandeur.role,
          receiverName: destinataireNom,
          receiverRole: destinataire!.role,
          notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // 2. Écriture sous-collection /notifications/{destinataireId}/items/{notifId}
        transaction.set(notifItemRef, {
          type: "demande_connexion",
          relationId,
          expediteurId: demandeur.id,
          lu: false,
          dateCreation: now,
          contenu: `${demandeurNom} (${demandeur.role}) vous a transmis une demande de connexion B2B.`
        });
      });
    } catch (e) {
      console.warn("[relationService] Transaction Firestore échouée ou hors-ligne, enregistrement local de secours:", e);
    }

    // Sauvegarde locale systématique (Mode Hors-Ligne)
    const localRel: Relation = {
      id: relationId,
      demandeurId: demandeur.id,
      destinataireId: destinataire.id,
      statut: "en_attente",
      dateCreation: new Date().toISOString(),
      dateReponse: null,
      participants: [demandeur.id, destinataire.id],
      notes,
      demandeurNom,
      demandeurRole: demandeur.role,
      destinataireNom,
      destinataireRole: destinataire.role
    };

    const localNotif: PartnerNotificationItem = {
      id: notifItemRef.id,
      type: "demande_connexion",
      relationId,
      expediteurId: demandeur.id,
      lu: false,
      dateCreation: new Date().toISOString(),
      contenu: `${demandeurNom} (${demandeur.role}) vous a transmis une demande de connexion B2B.`
    };

    // Mettre à jour localDb
    const currentConns = localDb.getConnections().filter(c => c.id !== relationId);
    const legacyConn: Connection = {
      id: relationId,
      senderId: demandeur.id,
      receiverId: destinataire.id,
      status: "en_attente",
      senderName: demandeurNom,
      senderRole: demandeur.role,
      receiverName: destinataireNom,
      receiverRole: destinataire.role,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    localDb.saveConnections([legacyConn, ...currentConns]);

    const currentNotifs = localDb.getNotifications().filter(n => n.id !== localNotif.id);
    localDb.saveNotifications([{
      id: localNotif.id,
      userId: destinataire.id,
      senderId: demandeur.id,
      title: "Demande de connexion",
      message: localNotif.contenu,
      type: "demande_connexion",
      read: false,
      createdAt: new Date().toISOString(),
      relatedId: relationId
    }, ...currentNotifs]);

    return {
      success: true,
      relationId,
      destinataireNom,
      message: `Demande de connexion transmise à ${destinataireNom}.`
    };
  },

  /**
   * 2. Répondre à une demande de connexion (Transaction atomique)
   * Met à jour statut à "actif" ou "refuse" + crée notification de retour dans /notifications/{demandeurId}/items/
   */
  async repondreDemandeConnexion(
    currentUserId: string, 
    relationId: string, 
    reponse: "accepter" | "refuser"
  ): Promise<void> {
    const relationRef = doc(db, "relations", relationId);
    const legacyConnRef = doc(db, "connections", relationId);

    let demandeurId = "";
    let destinataireNom = "";

    try {
      await runTransaction(db, async (transaction) => {
        const relDoc = await transaction.get(relationRef);
        if (!relDoc.exists()) {
          throw new Error("La relation spécifiée n'existe pas.");
        }

        const relationData = relDoc.data() as Relation;

        if (relationData.destinataireId !== currentUserId) {
          throw new Error("Seul le destinataire est autorisé à valider cette demande.");
        }

        demandeurId = relationData.demandeurId;
        destinataireNom = relationData.destinataireNom || "Un partenaire";

        const nouveauStatut = reponse === "accepter" ? "actif" : "refuse";
        const legacyStatus = reponse === "accepter" ? "active" : "refusée";
        const now = serverTimestamp();

        // 1. Mise à jour de la relation
        transaction.update(relationRef, {
          statut: nouveauStatut,
          dateReponse: now
        });

        transaction.update(legacyConnRef, {
          status: legacyStatus,
          updatedAt: new Date().toISOString()
        });

        // 2. Création notification dans /notifications/{demandeurId}/items/{notifId}
        const notifDemandeurRef = doc(collection(db, "notifications", demandeurId, "items"));
        const typeNotif = reponse === "accepter" ? "connexion_acceptee" : "connexion_refusee";
        const contenuNotif = reponse === "accepter"
          ? `${destinataireNom} a accepté votre demande de connexion B2B.`
          : `${destinataireNom} a décliné votre demande de connexion.`;

        transaction.set(notifDemandeurRef, {
          type: typeNotif,
          relationId,
          expediteurId: currentUserId,
          lu: false,
          dateCreation: now,
          contenu: contenuNotif
        });
      });
    } catch (e) {
      console.warn("[relationService] Transaction de réponse Firestore échouée ou hors-ligne, mise à jour locale:", e);
    }

    // Traitement local systématique
    const nouveauStatutLocal = reponse === "accepter" ? "active" : "refusée";
    const localConns = localDb.getConnections().map(c => {
      if (c.id === relationId) {
        return { ...c, status: nouveauStatutLocal as Connection["status"], updatedAt: new Date().toISOString() };
      }
      return c;
    });
    localDb.saveConnections(localConns);

    if (demandeurId) {
      const currentNotifs = localDb.getNotifications();
      localDb.saveNotifications([{
        id: `notif-${Date.now()}`,
        userId: demandeurId,
        senderId: currentUserId,
        title: reponse === "accepter" ? "Connexion acceptée" : "Connexion refusée",
        message: reponse === "accepter" ? `${destinataireNom} a accepté votre demande.` : `${destinataireNom} a refusé votre demande.`,
        type: reponse === "accepter" ? "connexion_acceptee" : "connexion_refusee",
        read: false,
        createdAt: new Date().toISOString(),
        relatedId: relationId
      }, ...currentNotifs]);
    }
  },

  /**
   * 3. Listener temps réel pour les demandes EN ATTENTE reçues par l'utilisateur
   * écoute /relations où destinataireId == userId AND statut == 'en_attente'
   */
  subscribeToIncomingRequests(userId: string, callback: (relations: Relation[]) => void) {
    const emitLocal = () => {
      const localConns = localDb.getConnections()
        .filter(c => c.receiverId === userId && c.status === "en_attente")
        .map(c => ({
          id: c.id,
          demandeurId: c.senderId,
          destinataireId: c.receiverId,
          statut: "en_attente" as const,
          dateCreation: c.createdAt,
          dateReponse: null,
          participants: [c.senderId, c.receiverId],
          notes: c.notes,
          demandeurNom: c.senderName,
          demandeurRole: c.senderRole,
          destinataireNom: c.receiverName,
          destinataireRole: c.receiverRole
        }));
      callback(localConns);
    };

    // Émettre les données locales immédiatement
    emitLocal();

    const handleLocalUpdate = () => emitLocal();
    if (typeof window !== "undefined") {
      window.addEventListener("wakat_connections_updated", handleLocalUpdate);
      window.addEventListener("storage", handleLocalUpdate);
    }

    const q = query(
      collection(db, "relations"),
      where("destinataireId", "==", userId),
      where("statut", "==", "en_attente")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items: Relation[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Relation));
      callback(items);
    }, (err) => {
      console.warn("[relationService] Listener incoming relations error, using fallback:", err);
    });

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_connections_updated", handleLocalUpdate);
        window.removeEventListener("storage", handleLocalUpdate);
      }
      unsub();
    };
  },

  /**
   * 4. Listener temps réel pour les NOTIFICATIONS de l'utilisateur
   * écoute la sous-collection /notifications/{userId}/items
   */
  subscribeToUserNotifications(userId: string, callback: (notifications: PartnerNotificationItem[]) => void) {
    const emitLocal = () => {
      const localNotifs = localDb.getNotifications()
        .filter(n => n.userId === userId)
        .map(n => ({
          id: n.id,
          type: (n.type.toLowerCase().includes("accepte") ? "connexion_acceptee" : (n.type.toLowerCase().includes("refus") ? "connexion_refusee" : "demande_connexion")) as PartnerNotificationItem["type"],
          relationId: n.relatedId || "",
          expediteurId: n.senderId || "",
          lu: n.read,
          dateCreation: n.createdAt,
          contenu: n.message || n.title
        }));
      callback(localNotifs);
    };

    emitLocal();

    const handleLocalUpdate = () => emitLocal();
    if (typeof window !== "undefined") {
      window.addEventListener("wakat_notifications_updated", handleLocalUpdate);
      window.addEventListener("storage", handleLocalUpdate);
    }

    const q = query(
      collection(db, "notifications", userId, "items"),
      orderBy("dateCreation", "desc")
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const items: PartnerNotificationItem[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PartnerNotificationItem));
      callback(items);
    }, (err) => {
      console.warn("[relationService] Listener notifications error, using fallback:", err);
    });

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("wakat_notifications_updated", handleLocalUpdate);
        window.removeEventListener("storage", handleLocalUpdate);
      }
      unsub();
    };
  },

  /**
   * 5. Marquer une notification comme lue dans /notifications/{userId}/items/{notifId}
   */
  async marquerNotificationCommeLue(userId: string, notifId: string): Promise<void> {
    try {
      const notifRef = doc(db, "notifications", userId, "items", notifId);
      await updateDoc(notifRef, { lu: true });
    } catch (e) {
      console.warn("[relationService] Error marking notification as read:", e);
    }

    const localNotifs = localDb.getNotifications().map(n => {
      if (n.id === notifId) return { ...n, read: true };
      return n;
    });
    localDb.saveNotifications(localNotifs);
  }
};

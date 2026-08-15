const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Calcule la vitesse de vente journalière moyenne sur 14 jours glissants
 * et vérifie les alertes de réapprovisionnement pour tous les stocks actifs.
 */
async function executerCalculVitesseEtAlertes() {
  const now = new Date();
  const quatorzeJoursAvant = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const nowTimestamp = admin.firestore.FieldValue.serverTimestamp();

  console.log(`[Reapprovisionnement] Démarrage du calcul sur la fenêtre : ${quatorzeJoursAvant.toISOString()} à ${now.toISOString()}`);

  // 1. Récupérer les utilisateurs ayant du stock
  const usersSnap = await db.collection('users').get();
  let totalStocksTraites = 0;
  let totalAlertesCrees = 0;

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;

    // Récupérer les items de stock dans /stocks/{uid}/items
    const stockItemsSnap = await db.collection('stocks').doc(uid).collection('items').get();
    if (stockItemsSnap.empty) continue;

    // Récupérer les ventes des 14 derniers jours pour ce vendeur
    // On prend les ventes validées ou créées
    const ventesSnap = await db.collection('ventes')
      .where('vendeurId', '==', uid)
      .get();

    // Filtrer les ventes des 14 derniers jours en mémoire
    const ventes14Jours = ventesSnap.docs
      .map(d => d.data())
      .filter(v => {
        const statut = v.statut || '';
        if (statut === 'rejetee' || statut === 'annulee' || statut === 'CANCELLED') return false;
        
        let dateVente = null;
        if (v.dateVente && typeof v.dateVente.toDate === 'function') {
          dateVente = v.dateVente.toDate();
        } else if (v.dateCreation && typeof v.dateCreation.toDate === 'function') {
          dateVente = v.dateCreation.toDate();
        } else if (v.createdAt) {
          dateVente = new Date(v.createdAt);
        } else if (v.date) {
          dateVente = new Date(v.date);
        }

        return dateVente && dateVente >= quatorzeJoursAvant;
      });

    // Calculer les quantités vendues par produit sur 14 jours
    const quantitesVenduesParProduit = {};
    for (const v of ventes14Jours) {
      const lignes = v.lignes || v.items || [];
      for (const ligne of lignes) {
        const pId = ligne.produitId || ligne.productId;
        const qte = Number(ligne.quantite || ligne.quantity || 0);
        if (pId && qte > 0) {
          quantitesVenduesParProduit[pId] = (quantitesVenduesParProduit[pId] || 0) + qte;
        }
      }
    }

    // Traiter chaque item de stock
    for (const itemDoc of stockItemsSnap.docs) {
      const itemData = itemDoc.data();
      const produitId = itemDoc.id;
      const quantiteActuelle = Number(itemData.quantite !== undefined ? itemData.quantite : (itemData.stock || 0));
      const nomProduit = itemData.nom || itemData.name || produitId;

      const totalVendu14J = quantitesVenduesParProduit[produitId] || 0;
      const vitesseVenteJournaliere = Math.round((totalVendu14J / 14) * 100) / 100; // arrondi 2 décimales

      // Calcul des jours restants avant rupture
      let joursRestants = null;
      if (vitesseVenteJournaliere > 0) {
        joursRestants = Math.floor(quantiteActuelle / vitesseVenteJournaliere);
      }

      // Seuil d'alerte configuré sur le produit (exprimé en jours, défaut 5 jours)
      const seuilAlerteJours = Number(itemData.seuilAlerte || itemData.seuilAlerteJours || 5);
      const estSousSeuil = joursRestants !== null && joursRestants <= seuilAlerteJours;

      const majStock = {
        vitesseVenteJournaliere,
        joursRestants,
        derniereMajVitesse: nowTimestamp
      };

      // Gestion anti-spam de la notification
      if (estSousSeuil) {
        // Alerte nécessaire : vérifier si déjà envoyée tant qu'on est sous le seuil
        if (!itemData.derniereAlerteEnvoyee) {
          // Créer la notification dans /notifications/{uid}/items
          const notifRef = db.collection('notifications').doc(uid).collection('items').doc();
          await notifRef.set({
            type: 'alerte_reapprovisionnement',
            produitId,
            nomProduit,
            quantiteActuelle,
            vitesseVenteJournaliere,
            joursRestants,
            seuilAlerteJours,
            lu: false,
            dateCreation: nowTimestamp,
            titre: `Alerte Réapprovisionnement : ${nomProduit}`,
            contenu: `Alerte stock : Il ne reste qu'environ ${joursRestants} jour(s) de stock pour "${nomProduit}" (Stock: ${quantiteActuelle} u, Vitesse: ${vitesseVenteJournaliere} u/j, Seuil: ${seuilAlerteJours} j). Pensez à passer commande.`
          });

          majStock.derniereAlerteEnvoyee = nowTimestamp;
          totalAlertesCrees++;
        }
      } else {
        // Si le stock est repassé au-dessus du seuil, réinitialiser derniereAlerteEnvoyee
        if (itemData.derniereAlerteEnvoyee) {
          majStock.derniereAlerteEnvoyee = null;
        }
      }

      // Mettre à jour le document de stock
      await itemDoc.ref.update(majStock);
      totalStocksTraites++;
    }
  }

  console.log(`[Reapprovisionnement] Terminé. ${totalStocksTraites} stocks analysés, ${totalAlertesCrees} nouvelles alertes créées.`);
  return { success: true, totalStocksTraites, totalAlertesCrees };
}

/**
 * Cloud Function planifiée (exécutée chaque jour à 04h00 UTC)
 */
exports.verifierAlertesReapprovisionnementPlanifie = functions.pubsub
  .schedule('0 4 * * *')
  .timeZone('Africa/Ouagadougou')
  .onRun(async (context) => {
    return await executerCalculVitesseEtAlertes();
  });

/**
 * Endpoint Callable pour forcer le recalcul manuel (déclenchement depuis l'interface ou les tests)
 */
exports.recalculerAlertesReapprovisionnement = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentification requise.');
  }
  return await executerCalculVitesseEtAlertes();
});

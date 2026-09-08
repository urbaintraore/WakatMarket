/**
 * Alertes de réapprovisionnement — Cloud Functions (SDK v2).
 *
 * Calcule la vitesse de vente journalière glissante (14 jours) à partir des
 * commandes livrées (collection 'orders', items sérialisés en JSON — les
 * 'ventes' ne portent pas de lignes dans le modèle actuel) et génère des
 * alertes de réapprovisionnement par article d'inventaire (collection
 * 'inventory').
 *
 * Champs d'inventaire conservés (camelCase, lus par CommonDashboardParts) :
 *   vitesseVenteJournaliere, joursRestants, seuilAlerte,
 *   derniereMajVitesse, derniereAlerteEnvoyee
 */
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const { db, admin, serverTimestamp } = require('./common');

function parseOrderItems(rawItems) {
  if (Array.isArray(rawItems)) return rawItems;
  if (typeof rawItems === 'string') {
    try {
      return JSON.parse(rawItems);
    } catch (e) {
      return [];
    }
  }
  return [];
}

async function executerCalculVitesseEtAlertes() {
  const now = new Date();
  const fenetre = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const nowTimestamp = serverTimestamp();

  console.log(`[Reapprovisionnement] Démarrage (fenêtre : ${fenetre.toISOString()} → ${now.toISOString()})`);

  const inventorySnap = await db.collection('inventory').get();
  const parProprietaire = new Map();

  for (const doc of inventorySnap.docs) {
    const data = doc.data();
    const ownerId = data.owner_id || data.ownerId;
    if (!ownerId) continue;
    if (!parProprietaire.has(ownerId)) parProprietaire.set(ownerId, []);
    parProprietaire.get(ownerId).push({ ref: doc.ref, data, itemId: doc.id });
  }

  let totalStocksTraites = 0;
  let totalAlertesCrees = 0;

  for (const [ownerId, items] of parProprietaire.entries()) {
    // Quantités vendues par produit (commandes livrées des 14 derniers jours).
    const quantitesParProduit = {};

    let ordersSnap;
    try {
      ordersSnap = await db.collection('orders').where('receiver_id', '==', ownerId).get();
    } catch (e) {
      console.warn(`[Reapprovisionnement] Erreur lecture orders pour ${ownerId}:`, e.message);
      continue;
    }

    for (const o of ordersSnap.docs) {
      const order = o.data();
      const statut = String(order.status || order.statut || '').toUpperCase();
      if (statut !== 'DELIVERED' && statut !== 'LIVRE' && statut !== 'LIVREE' && statut !== 'CONFIRMED') continue;

      const dateStr = order.updated_at || order.created_at || order.createdAt;
      const dateOrder = dateStr ? new Date(dateStr) : null;
      if (!dateOrder || isNaN(dateOrder.getTime()) || dateOrder < fenetre) continue;

      for (const ligne of parseOrderItems(order.items)) {
        const pId = ligne.productId || ligne.product_id || ligne.produitId;
        const qte = Number(ligne.quantity || ligne.quantite || 0);
        if (pId && qte > 0) {
          quantitesParProduit[pId] = (quantitesParProduit[pId] || 0) + qte;
        }
      }
    }

    for (const { ref, data, itemId } of items) {
      const productId = data.product_id || data.productId || itemId;
      const quantiteActuelle = Number(data.stock !== undefined ? data.stock : (data.quantite || 0)) || 0;
      const nomProduit = data.name || data.product_name || productId;

      const totalVendu = quantitesParProduit[productId] || 0;
      const vitesseVenteJournaliere = Math.round((totalVendu / 14) * 100) / 100;

      let joursRestants = null;
      if (vitesseVenteJournaliere > 0) {
        joursRestants = Math.floor(quantiteActuelle / vitesseVenteJournaliere);
      }

      const seuilAlerteJours = Number(data.seuilAlerte || data.seuil_alerte || 5);
      const estSousSeuil = joursRestants !== null && joursRestants <= seuilAlerteJours;

      const majStock = {
        vitesseVenteJournaliere,
        joursRestants,
        derniereMajVitesse: nowTimestamp
      };

      if (estSousSeuil) {
        if (!data.derniereAlerteEnvoyee) {
          const notifRef = db.collection('notifications').doc();
          await notifRef.set({
            id: notifRef.id,
            user_id: ownerId,
            type: 'alerte_reapprovisionnement',
            related_id: itemId,
            title: `Alerte Réapprovisionnement : ${nomProduit}`,
            message: `Il ne reste qu'environ ${joursRestants} jour(s) de stock pour "${nomProduit}" (Stock: ${quantiteActuelle} u, Vitesse: ${vitesseVenteJournaliere} u/j, Seuil: ${seuilAlerteJours} j). Pensez à passer commande.`,
            product_id: productId,
            quantite_actuelle: quantiteActuelle,
            vitesse_vente_journaliere: vitesseVenteJournaliere,
            jours_restants: joursRestants,
            read: false,
            lu: false,
            created_at: new Date().toISOString()
          });

          majStock.derniereAlerteEnvoyee = nowTimestamp;
          totalAlertesCrees++;
        }
      } else if (data.derniereAlerteEnvoyee) {
        majStock.derniereAlerteEnvoyee = null;
      }

      await ref.update(majStock).catch((e) => console.warn(`[Reapprovisionnement] MàJ stock ${itemId} échouée:`, e.message));
      totalStocksTraites++;
    }
  }

  console.log(`[Reapprovisionnement] Terminé. ${totalStocksTraites} stocks analysés, ${totalAlertesCrees} nouvelles alertes.`);
  return { success: true, totalStocksTraites, totalAlertesCrees };
}

/** Planifié chaque jour à 04h00 UTC (Africa/Ouagadougou). */
exports.verifierAlertesReapprovisionnementPlanifie = onSchedule(
  { schedule: '0 4 * * *', timeZone: 'Africa/Ouagadougou' },
  async () => {
    return await executerCalculVitesseEtAlertes();
  }
);

/** Callable : recalcul manuel (interface d'administration / tests). */
exports.recalculerAlertesReapprovisionnement = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }
  return await executerCalculVitesseEtAlertes();
});
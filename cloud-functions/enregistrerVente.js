/**
 * Enregistrement de ventes / confirmation de commandes hors-ligne — Cloud Functions (SDK v2).
 *
 * Adaptées au modèle actuel :
 *   - Le client est la source de vérité (offline-first) : il écrit la commande
 *     (collection 'orders', items sérialisés en JSON) puis l'état du stock
 *     (collection 'inventory').
 *   - Ces fonctions jouent le rôle de VÉRIFICATION serveur : détection de conflits
 *     de stock et alerte, sans muter ni le statut ni l'inventaire (l'écriture
 *     reste côté client pour éviter les doubles-décrémentations).
 */
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const { db, admin, serverTimestamp, createNotification } = require('./common');

/** Décode le champ `items` des commandes (string JSON ou tableau). */
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

/** Retrouve la ligne d'inventaire d'un propriétaire pour un produit. */
async function findInventory(ownerId, productId) {
  const snap = await db.collection('inventory')
    .where('owner_id', '==', ownerId)
    .where('product_id', '==', productId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { ref: snap.docs[0].ref, data: snap.docs[0].data() };
}

/** Quantité en stock (champs stock ou quantite selon l'écriture). */
function stockQuantity(invData) {
  const q = Number(invData.stock !== undefined ? invData.stock : (invData.quantite || 0));
  return isNaN(q) ? 0 : q;
}

/**
 * Trigger orders/{orderId} : détection de conflits de stock.
 * Pour une commande PENDING avec items, vérifie le stock du receveur
 * (receiver_id) et, en cas d'insuffisance, crée une alerte (notification
 * type conflit_stock_commande) ; sinon pose un flag serveur additif.
 */
exports.onOrderCreated = onDocumentCreated('orders/{orderId}', async (event) => {
  const orderId = event.params.orderId;
  const data = event.data.data();
  if (!data) return null;

  const status = String(data.status || data.statut || '');
  if (status !== 'PENDING' && status !== 'en_attente') return null;

  const receiverId = data.receiver_id || data.receiverId || data.acheteur_id || data.acheteurId;
  const senderId = data.sender_id || data.senderId || data.vendeur_id || data.vendeurId;
  const items = parseOrderItems(data.items);

  if (!receiverId || items.length === 0) return null;

  const conflits = [];
  for (const item of items) {
    const productId = item.productId || item.produitId || item.product_id || '';
    const quantity = Number(item.quantity || item.quantite || 0);
    if (!productId || quantity <= 0) continue;

    const inv = await findInventory(receiverId, productId).catch(() => null);
    const disponible = inv ? stockQuantity(inv.data) : 0;
    if (disponible < quantity) {
      conflits.push({
        product_id: productId,
        quantite_demandee: quantity,
        quantite_disponible: disponible,
        motif: inv ? 'Stock insuffisant' : 'Produit absent du stock receveur'
      });
    }
  }

  if (conflits.length === 0) {
    // Flag serveur purement informatif (le client garde le contrôle du statut).
    await event.data.ref.update({ server_confirmed: true });
    return null;
  }

  const total = Number(data.total || data.totalAmount || 0);
  const details = conflits.map((c) => `- ${c.product_id} : demandé ${c.quantite_demandee}, dispo ${c.quantite_disponible}`).join('\n');

  await createNotification({
    userId: receiverId,
    type: 'conflit_stock_commande',
    relatedId: orderId,
    senderId: senderId,
    title: `Conflit de stock : Commande #${orderId.substring(0, 8)}`,
    message: `La commande #${orderId.substring(0, 8)} (${total.toLocaleString('fr-FR')} FCFA) n'a pas pu être confirmée par le serveur : stock insuffisant.\n${details}`
  });

  await event.data.ref.set({ server_confirmed: false }, { merge: true });
  return null;
});

/**
 * Callable — enregistrerVente
 * Enregistre une vente côté serveur. Si des lignes sont fournies, la
 * transaction vérifie le stock du vendeur (inventory) et le décrémente
 * de manière atomique (conflit => exception).
 */
exports.enregistrerVente = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Vous devez être connecté pour effectuer une vente.');
  }
  const vendeurId = request.auth.uid;
  const { acheteurId, acheteurNom, typeVente, lignes, total, modePaiement, id } = request.data || {};

  const venteRef = id ? db.collection('ventes').doc(id) : db.collection('ventes').doc();

  const safeLignes = Array.isArray(lignes) ? lignes : null;

  try {
    await db.runTransaction(async (transaction) => {
      const toModify = [];

      if (safeLignes && safeLignes.length > 0) {
        for (const ligne of safeLignes) {
          const productId = ligne.produitId || ligne.productId || ligne.product_id;
          const quantity = Number(ligne.quantite || ligne.quantity || 0);
          if (!productId || quantity <= 0) {
            throw new Error('Ligne de vente invalide (produit ou quantité manquante).');
          }

          const inv = await findInventory(vendeurId, productId);
          if (!inv) {
            throw new Error(`Produit introuvable dans le stock vendeur (ID: ${productId}).`);
          }
          const dispo = stockQuantity(inv.data);
          if (dispo < quantity) {
            throw new Error(`Stock insuffisant pour le produit (ID: ${productId}). Disponible: ${dispo}, demandé: ${quantity}.`);
          }
          toModify.push({ ref: inv.ref, nouvelleQuantite: dispo - quantity });
        }
      }

      for (const item of toModify) {
        transaction.update(item.ref, { stock: item.nouvelleQuantite, quantite: item.nouvelleQuantite, updated_at: serverTimestamp() });
      }

      transaction.set(venteRef, {
        id: venteRef.id,
        vendeur_id: vendeurId,
        vendeur_nom: (request.data && request.data.vendeurNom) || '',
        acheteur_id: acheteurId || 'CLIENT_ANONYME',
        acheteur_nom: acheteurNom || 'Client',
        total: Number(total || 0),
        mode_paiement: modePaiement || 'CASH',
        statut: 'VALIDEE',
        created_at: new Date().toISOString(),
        server_created: true
      });
    });

    return {
      success: true,
      venteId: venteRef.id,
      message: 'Vente enregistrée avec succès.'
    };
  } catch (error) {
    console.error('Erreur lors de la transaction de vente:', error);
    throw new HttpsError('failed-precondition', error.message);
  }
});
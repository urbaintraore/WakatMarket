/**
 * Commandes — POST /api/orders/:orderId/process.
 * Port du trigger onOrderCreated : détection de conflits de stock côté serveur.
 * Le client reste source de vérité (statut + inventaire) ; le serveur pose un
 * flag additif (server_confirmed) et crée une alerte en cas d'insuffisance.
 *
 * Idempotent : si server_confirmed est déjà true, on ne re-vérifie pas.
 */
import { Router } from 'express';
import { db, serverTimestamp, createNotification } from '../common.js';

const router = Router();

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

router.post('/:orderId/process', async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const ref = db.collection('orders').doc(orderId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: 'Commande introuvable.' });
    }

    const data = snap.data();
    if (data.server_confirmed === true) {
      return res.json({ success: true, skipped: true, message: 'Commande déjà vérifiée par le serveur.' });
    }

    const status = String(data.status || data.statut || '');
    if (status !== 'PENDING' && status !== 'en_attente') {
      return res.json({ success: true, skipped: true, message: 'Commande non en attente, vérification ignorée.' });
    }

    const receiverId = data.receiver_id || data.receiverId || data.acheteur_id || data.acheteurId;
    const senderId = data.sender_id || data.senderId || data.vendeur_id || data.vendeurId;
    const items = parseOrderItems(data.items);

    if (!receiverId || items.length === 0) {
      return res.json({ success: true, skipped: true, message: 'Commande sans destinataire ou sans articles.' });
    }

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
      await ref.update({ server_confirmed: true, server_checked_at: serverTimestamp() });
      return res.json({ success: true, message: 'Commande confirmée par le serveur (stock OK).', conflits: 0 });
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

    await ref.set({ server_confirmed: false, server_checked_at: serverTimestamp() }, { merge: true });

    res.json({ success: true, message: 'Alerte de conflit de stock créée (server_confirmed: false).', conflits: conflits.length });
  } catch (error) {
    console.error('[orders] Erreur traitement commande:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
/**
 * Ventes — POST /api/ventes.
 * Port du callable enregistrerVente : transaction Firestore qui vérifie le
 * stock du vendeur (inventory) et le décrémente atomiquement, puis crée la
 * ligne de vente (collection 'ventes', champ server_created: true).
 */
import { Router } from 'express';
import { db, serverTimestamp } from '../common.js';

const router = Router();

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

router.post('/', async (req, res, next) => {
  try {
    const vendeurId = req.uid;
    const { acheteurId, acheteurNom, typeVente, lignes, total, modePaiement, id } = req.body || {};

    const venteRef = id ? db.collection('ventes').doc(id) : db.collection('ventes').doc();
    const safeLignes = Array.isArray(lignes) ? lignes : null;

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
        transaction.update(item.ref, {
          stock: item.nouvelleQuantite,
          quantite: item.nouvelleQuantite,
          updated_at: serverTimestamp()
        });
      }

      transaction.set(venteRef, {
        id: venteRef.id,
        vendeur_id: vendeurId,
        vendeur_nom: (req.body && req.body.vendeurNom) || '',
        acheteur_id: acheteurId || 'CLIENT_ANONYME',
        acheteur_nom: acheteurNom || 'Client',
        total: Number(total || 0),
        mode_paiement: modePaiement || 'CASH',
        statut: 'VALIDEE',
        created_at: new Date().toISOString(),
        server_created: true
      });
    });

    res.json({ success: true, venteId: venteRef.id, message: 'Vente enregistrée avec succès.' });
  } catch (error) {
    res.status(409).json({ error: error.message });
  }
});

export default router;
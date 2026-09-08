/**
 * Paiements — POST /api/paiements/:id/valider|rejeter|preuve.
 * Port des callables validerPaiementVente / rejeterPaiementVente et du
 * trigger onPreuvePaiementSoumise (notification vendeur à la soumission).
 */
import { Router } from 'express';
import { db, serverTimestamp, createNotification, isAdminUid } from '../common.js';

const router = Router();

/** Identifiants d'acteurs d'une commande/vente (tous schémas). */
function acteurs(doc) {
  return {
    vendeurId: doc.receiver_id || doc.receiverId || doc.vendeur_id || doc.vendeurId || '',
    acheteurId: doc.sender_id || doc.senderId || doc.acheteur_id || doc.acheteurId || '',
    total: Number(doc.total || doc.totalAmount || 0)
  };
}

/** Récupère une vente OU une commande par id, avec détection de la collection. */
async function findVenteOuCommande(venteId) {
  const venteRef = db.collection('ventes').doc(venteId);
  const orderRef = db.collection('orders').doc(venteId);

  let ref = null;
  let collectionName = null;

  const venteSnap = await venteRef.get();
  if (venteSnap.exists) {
    ref = venteRef;
    collectionName = 'ventes';
  } else {
    const orderSnap = await orderRef.get();
    if (orderSnap.exists) {
      ref = orderRef;
      collectionName = 'orders';
    }
  }

  if (!ref) return null;
  return { ref, collectionName, data: (await ref.get()).data() };
}

/** Patch statutPaiement commun (orders + ventes). */
function paiementPatch(statutPaiement, extra) {
  const base = { statutPaiement, updated_at: new Date().toISOString() };
  return { ...base, ...extra };
}

router.post('/:venteId/valider', async (req, res) => {
  try {
    const venteId = req.params.venteId;
    const userId = req.uid;

    const found = await findVenteOuCommande(venteId);
    if (!found) return res.status(404).json({ error: 'Vente ou commande introuvable.' });

    const { vendeurId, acheteurId, total } = acteurs(found.data);
    if (vendeurId !== userId && !(await isAdminUid(userId))) {
      return res.status(403).json({ error: 'Seul le vendeur de cette transaction est autorisé à valider le paiement.' });
    }

    const numeroFacture = `FACT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = serverTimestamp();

    const batch = db.batch();
    const patch = paiementPatch('valide', {
      dateValidationPaiement: now,
      statut: 'VALIDE',
      paymentStatus: 'PAID',
      amountPaid: total
    });
    batch.update(found.ref, patch);

    const mirrorName = found.collectionName === 'ventes' ? 'orders' : 'ventes';
    const mirrorSnap = await db.collection(mirrorName).doc(venteId).get();
    if (mirrorSnap.exists) {
      batch.update(mirrorSnap.ref, patch);
    }

    batch.set(db.collection('factures').doc(), {
      venteId,
      numeroFacture,
      vendeurId,
      acheteurId: acheteurId || null,
      total,
      statutPaiement: 'valide',
      dateEmission: now
    });

    await batch.commit();

    if (acheteurId && acheteurId !== 'CLIENT_ANONYME') {
      await createNotification({
        userId: acheteurId,
        type: 'paiement_valide',
        relatedId: venteId,
        senderId: vendeurId,
        title: 'Paiement validé',
        message: `Votre paiement de ${total.toLocaleString('fr-FR')} FCFA pour la commande a été validé avec succès. Votre facture officielle (${numeroFacture}) est disponible.`
      });
    }

    res.json({ success: true, message: 'Paiement validé avec succès.', numeroFacture });
  } catch (error) {
    console.error('[paiements] Erreur validation:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:venteId/rejeter', async (req, res) => {
  try {
    const venteId = req.params.venteId;
    const userId = req.uid;
    const commentaire = (req.body && req.body.commentaire) || '';
    const cleanComment = (commentaire || 'Preuve de paiement non conforme ou montant incorrect.').trim();

    const found = await findVenteOuCommande(venteId);
    if (!found) return res.status(404).json({ error: 'Vente introuvable.' });

    const { vendeurId, acheteurId } = acteurs(found.data);
    if (vendeurId !== userId && !(await isAdminUid(userId))) {
      return res.status(403).json({ error: 'Seul le vendeur de cette transaction peut rejeter la preuve.' });
    }

    const now = serverTimestamp();

    const batch = db.batch();
    const patch = paiementPatch('rejete', {
      commentaireRejet: cleanComment,
      dateRejetPaiement: now,
      statut: 'CANCELLED'
    });
    batch.update(found.ref, patch);

    const mirrorName = found.collectionName === 'ventes' ? 'orders' : 'ventes';
    const mirrorSnap = await db.collection(mirrorName).doc(venteId).get();
    if (mirrorSnap.exists) {
      batch.update(mirrorSnap.ref, paiementPatch('rejete', { commentaireRejet: cleanComment, dateRejetPaiement: now }));
    }

    await batch.commit();

    if (acheteurId && acheteurId !== 'CLIENT_ANONYME') {
      await createNotification({
        userId: acheteurId,
        type: 'paiement_rejete',
        relatedId: venteId,
        senderId: vendeurId,
        title: 'Preuve de paiement rejetée',
        message: `Le vendeur a rejeté la preuve de paiement pour la commande. Motif : "${cleanComment}". Veuillez soumettre une nouvelle capture d'écran conforme.`
      });
    }

    res.json({ success: true, message: 'Paiement rejeté et acheteur notifié.' });
  } catch (error) {
    console.error('[paiements] Erreur rejet:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/paiements/:orderId/preuve
 * Port du trigger onPreuvePaiementSoumise : notifie le vendeur quand une
 * preuve de paiement est soumise. Idempotent via le flag server_preuve_notifie.
 */
router.post('/:orderId/preuve', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const ref = db.collection('orders').doc(orderId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Commande introuvable.' });

    const after = snap.data();
    if (after.statutPaiement !== 'preuve_soumise' || !after.preuvePaiementUrl) {
      return res.json({ success: true, skipped: true, message: 'Aucune preuve à notifier (statut ou URL manquant).' });
    }
    if (after.server_preuve_notifie === true) {
      return res.json({ success: true, skipped: true, message: 'Vendeur déjà notifié pour cette preuve.' });
    }

    const vendeurId = after.receiver_id || after.receiverId || after.vendeur_id || after.vendeurId;
    const total = Number(after.total || after.totalAmount || 0);

    if (!vendeurId) {
      return res.json({ success: true, skipped: true, message: 'Aucun vendeur identifié.' });
    }

    await createNotification({
      userId: vendeurId,
      type: 'preuve_paiement_a_valider',
      relatedId: orderId,
      senderId: after.sender_id || after.acheteur_id || 'CLIENT',
      title: 'Preuve de paiement soumise',
      message: `Une nouvelle preuve de paiement de ${total.toLocaleString('fr-FR')} FCFA a été soumise pour la commande. Veuillez la vérifier.`
    });

    await ref.update({ server_preuve_notifie: true, preuve_notifie_at: serverTimestamp() });

    res.json({ success: true, message: 'Vendeur notifié de la preuve de paiement.' });
  } catch (error) {
    console.error('[paiements] Erreur notification preuve:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
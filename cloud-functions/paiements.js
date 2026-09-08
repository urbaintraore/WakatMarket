/**
 * Paiements — Cloud Functions (SDK v2).
 *
 * Validation / rejet de preuves de paiement et notification automatique.
 * Le flux actuel écrit sur la collection 'orders' (statutPaiement :
 * en_attente_preuve | preuve_soumise | valide | rejete). La vente miroir
 * (collection 'ventes') est mise à jour lorsqu'elle existe.
 */
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const { db, admin, serverTimestamp, createNotification, isAdminUid } = require('./common');

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
  return {
    ref,
    collectionName,
    data: (await ref.get()).data()
  };
}

/** Patch statutPaiement commun (orders + ventes). */
function paiementPatch(statutPaiement, extra) {
  const base = { statutPaiement, updated_at: new Date().toISOString() };
  return { ...base, ...extra };
}

/**
 * Callable — validerPaiementVente
 * Valide une preuve de paiement (vendeur/acheteur autorisé, ou admin),
 * confirme la commande, crée la facture et notifie l'acheteur.
 */
exports.validerPaiementVente = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Vous devez être authentifié pour valider un paiement.');
  }
  const { venteId } = request.data || {};
  if (!venteId) {
    throw new HttpsError('invalid-argument', 'Identifiant de vente (venteId) requis.');
  }
  const userId = request.auth.uid;

  const found = await findVenteOuCommande(venteId);
  if (!found) {
    throw new HttpsError('not-found', 'Vente ou commande introuvable.');
  }

  const { vendeurId, acheteurId, total } = acteurs(found.data);

  if (vendeurId !== userId && !(await isAdminUid(userId))) {
    throw new HttpsError('permission-denied', 'Seul le vendeur de cette transaction est autorisé à valider le paiement.');
  }

  const numeroFacture = `FACT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = serverTimestamp();

  try {
    const batch = db.batch();

    const patch = paiementPatch('valide', {
      dateValidationPaiement: now,
      statut: 'VALIDE',
      paymentStatus: 'PAID',
      amountPaid: total
    });
    batch.update(found.ref, patch);

    // Miroir dans l'autre collection si le document y existe.
    const mirrorName = found.collectionName === 'ventes' ? 'orders' : 'ventes';
    const mirrorSnap = await db.collection(mirrorName).doc(venteId).get();
    if (mirrorSnap.exists) {
      batch.update(mirrorSnap.ref, patch);
    }

    // Facture officielle.
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

    return { success: true, message: 'Paiement validé avec succès.', numeroFacture };
  } catch (error) {
    console.error('Erreur lors de la validation du paiement:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Callable — rejeterPaiementVente
 * Rejette une preuve non conforme avec un motif explicatif + notification acheteur.
 */
exports.rejeterPaiementVente = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Vous devez être connecté pour rejeter un paiement.');
  }
  const { venteId, commentaire } = request.data || {};
  if (!venteId) {
    throw new HttpsError('invalid-argument', 'Identifiant de vente requis.');
  }
  const userId = request.auth.uid;

  const found = await findVenteOuCommande(venteId);
  if (!found) {
    throw new HttpsError('not-found', 'Vente introuvable.');
  }

  const { vendeurId, acheteurId } = acteurs(found.data);
  if (vendeurId !== userId && !(await isAdminUid(userId))) {
    throw new HttpsError('permission-denied', 'Seul le vendeur de cette transaction peut rejeter la preuve.');
  }

  const cleanComment = (commentaire || 'Preuve de paiement non conforme ou montant incorrect.').trim();
  const now = serverTimestamp();

  try {
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

    return { success: true, message: 'Paiement rejeté et acheteur notifié.' };
  } catch (error) {
    console.error('Erreur rejet paiement:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Trigger orders/{orderId} : détection de soumission d'une preuve de paiement.
 * Notifie le vendeur (receiver_id) quand statutPaiement passe à 'preuve_soumise'
 * avec une URL de preuve.
 */
exports.onPreuvePaiementSoumise = onDocumentUpdated('orders/{orderId}', async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};

  if (before.statutPaiement === 'preuve_soumise') return null;
  if (after.statutPaiement !== 'preuve_soumise') return null;
  if (!after.preuvePaiementUrl) return null;

  const vendeurId = after.receiver_id || after.receiverId || after.vendeur_id || after.vendeurId;
  const acheteurNom = after.sender_name || after.acheteur_nom || 'Un acheteur';
  const total = Number(after.total || after.totalAmount || 0);

  if (!vendeurId) return null;

  await createNotification({
    userId: vendeurId,
    type: 'preuve_paiement_a_valider',
    relatedId: event.params.orderId,
    senderId: after.sender_id || after.acheteur_id || 'CLIENT',
    title: 'Preuve de paiement soumise',
    message: `Une nouvelle preuve de paiement de ${total.toLocaleString('fr-FR')} FCFA a été soumise pour la commande. Veuillez la vérifier.`
  });
  return null;
});
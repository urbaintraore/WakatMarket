const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cloud Function : validerPaiementVente
 * Permet au vendeur de valider la preuve de paiement manuelle d'une vente.
 * Met à jour le statut, enregistre la facture et notifie l'acheteur.
 */
exports.validerPaiementVente = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Vous devez être authentifié pour valider un paiement.'
    );
  }

  const { venteId } = data;
  if (!venteId) {
    throw new functions.https.HttpsError('invalid-argument', 'Identifiant de vente (venteId) requis.');
  }

  const userId = context.auth.uid;
  let venteRef = db.collection('ventes').doc(venteId);
  let orderRef = db.collection('orders').doc(venteId);

  let venteDoc = await venteRef.get();
  let isOrderCollection = false;

  if (!venteDoc.exists) {
    venteDoc = await orderRef.get();
    if (venteDoc.exists) {
      isOrderCollection = true;
      venteRef = orderRef;
    } else {
      throw new functions.https.HttpsError('not-found', 'Vente ou commande introuvable.');
    }
  }

  const vente = venteDoc.data();
  const vendeurId = vente.vendeurId || vente.senderId;
  const acheteurId = vente.acheteurId || vente.receiverId || vente.clientId;
  const total = Number(vente.total || vente.totalAmount || 0);

  // Vérification de l'autorisation : seul le vendeur ou un administrateur peut valider
  if (vendeurId !== userId) {
    const userSnap = await db.collection('users').doc(userId).get();
    const isAdmin = userSnap.exists && userSnap.data().rôle === 'ADMIN';
    if (!isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Seul le vendeur de cette transaction est autorisé à valider le paiement.'
      );
    }
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const numeroFacture = `FACT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    const batch = db.batch();

    // 1. Mise à jour du document de vente
    batch.update(venteRef, {
      statutPaiement: 'valide',
      dateValidationPaiement: now,
      statut: 'VALIDE',
      paymentStatus: 'PAID',
      amountPaid: total,
      updatedAt: new Date().toISOString()
    });

    // 2. Synchronisation si collections miroirs (ventes / orders)
    if (!isOrderCollection) {
      const mirrorOrderDoc = await orderRef.get();
      if (mirrorOrderDoc.exists) {
        batch.update(orderRef, {
          statutPaiement: 'valide',
          dateValidationPaiement: now,
          statut: 'VALIDE',
          paymentStatus: 'PAID',
          amountPaid: total,
          updatedAt: new Date().toISOString()
        });
      }
    }

    // 3. Création de l'entrée Facture
    const factureRef = db.collection('factures').doc();
    batch.set(factureRef, {
      venteId,
      numeroFacture,
      vendeurId,
      acheteurId: acheteurId || null,
      total,
      statutPaiement: 'valide',
      dateEmission: now
    });

    // 4. Notification pour l'acheteur
    if (acheteurId && acheteurId !== 'CLIENT_ANONYME') {
      const notifRef = db.collection('notifications').doc(acheteurId).collection('items').doc();
      batch.set(notifRef, {
        type: 'paiement_valide',
        venteId,
        orderId: venteId,
        expediteurId: userId,
        lu: false,
        dateCreation: now,
        contenu: `Votre paiement de ${total.toLocaleString('fr-FR')} FCFA pour la commande a été validé avec succès par le vendeur. Votre facture officielle (${numeroFacture}) est disponible.`
      });
    }

    await batch.commit();

    return {
      success: true,
      message: 'Paiement validé avec succès.',
      numeroFacture
    };
  } catch (error) {
    console.error('Erreur lors de la validation du paiement:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Cloud Function : rejeterPaiementVente
 * Permet au vendeur de rejeter une preuve non conforme avec un motif explicatif.
 */
exports.rejeterPaiementVente = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Vous devez être connecté pour rejeter un paiement.'
    );
  }

  const { venteId, commentaire } = data;
  if (!venteId) {
    throw new functions.https.HttpsError('invalid-argument', 'Identifiant de vente requis.');
  }

  const userId = context.auth.uid;
  let venteRef = db.collection('ventes').doc(venteId);
  let orderRef = db.collection('orders').doc(venteId);

  let venteDoc = await venteRef.get();
  let isOrderCollection = false;

  if (!venteDoc.exists) {
    venteDoc = await orderRef.get();
    if (venteDoc.exists) {
      isOrderCollection = true;
      venteRef = orderRef;
    } else {
      throw new functions.https.HttpsError('not-found', 'Vente introuvable.');
    }
  }

  const vente = venteDoc.data();
  const vendeurId = vente.vendeurId || vente.senderId;
  const acheteurId = vente.acheteurId || vente.receiverId || vente.clientId;

  if (vendeurId !== userId) {
    const userSnap = await db.collection('users').doc(userId).get();
    const isAdmin = userSnap.exists && userSnap.data().rôle === 'ADMIN';
    if (!isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Seul le vendeur de cette transaction peut rejeter la preuve.'
      );
    }
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const cleanComment = (commentaire || 'Preuve de paiement non conforme ou montant incorrect.').trim();

  try {
    const batch = db.batch();

    batch.update(venteRef, {
      statutPaiement: 'rejete',
      commentaireRejet: cleanComment,
      dateRejetPaiement: now,
      updatedAt: new Date().toISOString()
    });

    if (!isOrderCollection) {
      const mirrorOrderDoc = await orderRef.get();
      if (mirrorOrderDoc.exists) {
        batch.update(orderRef, {
          statutPaiement: 'rejete',
          commentaireRejet: cleanComment,
          dateRejetPaiement: now,
          updatedAt: new Date().toISOString()
        });
      }
    }

    if (acheteurId && acheteurId !== 'CLIENT_ANONYME') {
      const notifRef = db.collection('notifications').doc(acheteurId).collection('items').doc();
      batch.set(notifRef, {
        type: 'paiement_rejete',
        venteId,
        orderId: venteId,
        expediteurId: userId,
        lu: false,
        dateCreation: now,
        contenu: `Le vendeur a rejeté la preuve de paiement pour la commande. Motif : "${cleanComment}". Veuillez soumettre une nouvelle capture d'écran conforme.`
      });
    }

    await batch.commit();

    return {
      success: true,
      message: 'Paiement rejeté et acheteur notifié.'
    };
  } catch (error) {
    console.error('Erreur rejet paiement:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

/**
 * Trigger Firestore : onPreuvePaiementSoumise
 * Déclenchée quand un acheteur soumet une capture d'écran (statutPaiement -> preuve_soumise)
 */
exports.onPreuvePaiementSoumise = functions.firestore
  .document('ventes/{venteId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Détection du passage à 'preuve_soumise'
    if (beforeData.statutPaiement !== 'preuve_soumise' && afterData.statutPaiement === 'preuve_soumise' && afterData.preuvePaiementUrl) {
      const vendeurId = afterData.vendeurId || afterData.senderId;
      const venteId = context.params.venteId;
      const total = Number(afterData.total || afterData.totalAmount || 0);

      if (vendeurId) {
        const notifRef = db.collection('notifications').doc(vendeurId).collection('items').doc();
        await notifRef.set({
          type: 'preuve_paiement_a_valider',
          venteId,
          orderId: venteId,
          expediteurId: afterData.acheteurId || afterData.receiverId || 'CLIENT',
          lu: false,
          dateCreation: admin.firestore.FieldValue.serverTimestamp(),
          contenu: `Une nouvelle preuve de paiement de ${total.toLocaleString('fr-FR')} FCFA a été soumise pour la vente ${venteId}. Veuillez la vérifier.`
        });
      }
    }
    return null;
  });

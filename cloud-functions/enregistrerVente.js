const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialiser l'application admin (doit être fait une seule fois dans l'index.js principal)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cloud Function : enregistrerVente
 * Enregistre une vente atomiquement en décrémentant les stocks.
 * Déclenche ensuite (ou peut déclencher) la génération de facture.
 */
exports.enregistrerVente = functions.https.onCall(async (data, context) => {
  // 1. Vérification de l'authentification
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Vous devez être connecté pour effectuer une vente.'
    );
  }

  const vendeurId = context.auth.uid;
  const { acheteurId, typeVente, lignes, total } = data;

  // Validation basique des données
  if (!lignes || !Array.isArray(lignes) || lignes.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'La vente doit contenir au moins une ligne.');
  }

  const venteRef = db.collection('ventes').doc();
  const dateVente = admin.firestore.FieldValue.serverTimestamp();

  try {
    // 2. Transaction Firestore pour garantir l'atomicité
    await db.runTransaction(async (transaction) => {
      const stockRefs = [];
      const currentStocks = [];

      // a. Lecture des stocks pour chaque produit (doit être fait avant toute écriture dans une transaction)
      for (const ligne of lignes) {
        const stockRef = db.collection('stocks').doc(vendeurId).collection('items').doc(ligne.produitId);
        const stockDoc = await transaction.get(stockRef);

        if (!stockDoc.exists) {
          throw new Error(`Produit introuvable dans le stock (ID: ${ligne.produitId})`);
        }

        const stockData = stockDoc.data();
        if (stockData.quantite < ligne.quantite) {
          throw new Error(`Stock insuffisant pour le produit (ID: ${ligne.produitId}). Disponible: ${stockData.quantite}, Demandé: ${ligne.quantite}`);
        }

        stockRefs.push(stockRef);
        currentStocks.push(stockData.quantite);
      }

      // b. Application des modifications de stock (Écritures)
      for (let i = 0; i < lignes.length; i++) {
        const nouvelleQuantite = currentStocks[i] - lignes[i].quantite;
        transaction.update(stockRefs[i], {
          quantite: nouvelleQuantite
        });
      }

      // c. Création du document de vente
      const nouvelleVente = {
        vendeurId,
        acheteurId: acheteurId || 'CLIENT_ANONYME',
        typeVente, // 'GROS' ou 'DETAIL'
        lignes, // { produitId, nom, quantite, prixUnitaire, sousTotal }
        total,
        statut: 'VALIDE',
        dateVente
      };

      transaction.set(venteRef, nouvelleVente);
    });

    // 3. Retour du succès
    return {
      success: true,
      venteId: venteRef.id,
      message: 'Vente enregistrée avec succès.'
    };

  } catch (error) {
    console.error('Erreur lors de la transaction de vente:', error);
    // On renvoie une erreur explicite au client
    throw new functions.https.HttpsError('failed-precondition', error.message);
  }
});

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialiser l'application admin (doit être fait une seule fois dans l'index.js principal)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cloud Function Déclenchée : onVenteCreated (Offline-first confirmation & conflict resolver)
 * Déclenchée dès qu'un document /ventes/{venteId} arrive sur le serveur (via synchronisation Firestore).
 * Si la vente est 'en_attente_synchronisation', exécute la transaction serveur :
 * 1. Vérification du stock réel
 * 2. Si OK : décrémente le stock serveur et passe le statut à 'validee'
 * 3. Si Conflit (stock insuffisant) : refuse la vente (statut 'rejetee') et notifie le commerçant avec le détail.
 */
exports.onVenteCreated = functions.firestore
  .document('ventes/{venteId}')
  .onCreate(async (snap, context) => {
    const venteId = context.params.venteId;
    const venteData = snap.data();

    // Ignorer si la vente n'est pas en attente de synchronisation
    const statutInitial = venteData.statut || '';
    if (statutInitial !== 'en_attente_synchronisation' && statutInitial !== 'PENDING_SYNC') {
      return null;
    }

    const vendeurId = venteData.vendeurId;
    const lignes = venteData.lignes || venteData.items || [];
    const total = Number(venteData.total || venteData.totalAmount || 0);
    const acheteurNom = venteData.acheteurNom || venteData.clientNom || 'Client';

    if (!vendeurId || !Array.isArray(lignes) || lignes.length === 0) {
      console.warn(`[onVenteCreated] Vente ${venteId} invalide : aucun vendeur ou lignes.`);
      await snap.ref.update({
        statut: 'rejetee',
        motifRejet: 'Structure de vente invalide (lignes de commande manquantes).',
        dateTraitement: admin.firestore.FieldValue.serverTimestamp()
      });
      return null;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    try {
      // Transaction Firestore sur le serveur pour garantir l'atomicité et l'ordre chronologique
      await db.runTransaction(async (transaction) => {
        const stockRefs = [];
        const stockDocs = [];
        const conflits = [];

        // 1. Lire tous les stocks concernés
        for (const ligne of lignes) {
          const produitId = ligne.produitId || ligne.productId;
          const quantiteDemandee = Number(ligne.quantite || ligne.quantity || 0);

          const stockRef = db.collection('stocks').doc(vendeurId).collection('items').doc(produitId);
          const stockDoc = await transaction.get(stockRef);

          if (!stockDoc.exists) {
            conflits.push({
              produitId,
              nom: ligne.nom || 'Produit inconnu',
              quantiteDemandee,
              quantiteDisponible: 0,
              motif: 'Produit inexistant dans le stock vendeur'
            });
          } else {
            const stockData = stockDoc.data();
            const quantiteDisponible = Number(stockData.quantite !== undefined ? stockData.quantite : (stockData.stock || 0));

            if (quantiteDisponible < quantiteDemandee) {
              conflits.push({
                produitId,
                nom: ligne.nom || stockData.nom || stockData.name || 'Produit',
                quantiteDemandee,
                quantiteDisponible,
                motif: `Stock insuffisant (disponible: ${quantiteDisponible}, demandé: ${quantiteDemandee})`
              });
            } else {
              stockRefs.push({ ref: stockRef, currentQty: quantiteDisponible, debitQty: quantiteDemandee });
              stockDocs.push(stockDoc);
            }
          }
        }

        // 2. Gestion de conflit si stock insuffisant
        if (conflits.length > 0) {
          console.warn(`[onVenteCreated] Conflit de stock pour la vente ${venteId} (vendeur ${vendeurId}) :`, conflits);
          
          // Refuser la vente dans Firestore
          transaction.update(snap.ref, {
            statut: 'rejetee',
            dateRejet: now,
            motifRejet: 'Stock insuffisant lors de la synchronisation (conflit de stock hors-ligne).',
            detailsConflit: conflits
          });

          // Créer une notification explicite pour le commerçant
          const notifRef = db.collection('notifications').doc(vendeurId).collection('items').doc();
          const detailsTexte = conflits.map(c => `- ${c.nom} : demandé ${c.quantiteDemandee}, dispo ${c.quantiteDisponible}`).join('\n');
          
          transaction.set(notifRef, {
            type: 'conflit_stock_vente_hors_ligne',
            venteId,
            total,
            acheteurNom,
            conflits,
            lu: false,
            dateCreation: now,
            titre: `❌ Conflit de stock : Vente #${venteId.substring(0, 8)} refusée`,
            contenu: `Une vente de ${total.toLocaleString('fr-FR')} FCFA enregistrée hors-ligne n'a pas pu être confirmée par le serveur car le stock était épuisé entre-temps :\n${detailsTexte}`
          });

          return;
        }

        // 3. Validation : Décrémenter les stocks serveur de manière définitive
        for (const item of stockRefs) {
          const nouvelleQuantite = Math.max(0, item.currentQty - item.debitQty);
          transaction.update(item.ref, {
            quantite: nouvelleQuantite,
            stock: nouvelleQuantite,
            derniereMiseAJour: now
          });
        }

        // 4. Passer le statut de la vente à 'validee'
        transaction.update(snap.ref, {
          statut: 'validee',
          dateValidation: now,
          statutPaiement: venteData.statutPaiement || (venteData.amountPaid >= total ? 'valide' : 'attente')
        });
      });

      console.log(`[onVenteCreated] Traitement terminé pour la vente ${venteId}.`);
      return null;
    } catch (error) {
      console.error(`[onVenteCreated] Erreur transactionnelle sur la vente ${venteId}:`, error);
      await snap.ref.update({
        statut: 'erreur_traitement',
        erreurMessage: error.message,
        dateErreur: now
      });
      return null;
    }
  });

/**
 * Cloud Function : enregistrerVente (Callable Legacy pour compatibilité directe en ligne)
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
        const quantiteDispo = Number(stockData.quantite !== undefined ? stockData.quantite : (stockData.stock || 0));
        if (quantiteDispo < ligne.quantite) {
          throw new Error(`Stock insuffisant pour le produit (ID: ${ligne.produitId}). Disponible: ${quantiteDispo}, Demandé: ${ligne.quantite}`);
        }

        stockRefs.push(stockRef);
        currentStocks.push(quantiteDispo);
      }

      // b. Application des modifications de stock (Écritures)
      for (let i = 0; i < lignes.length; i++) {
        const nouvelleQuantite = currentStocks[i] - lignes[i].quantite;
        transaction.update(stockRefs[i], {
          quantite: nouvelleQuantite,
          stock: nouvelleQuantite
        });
      }

      // c. Création du document de vente
      const nouvelleVente = {
        vendeurId,
        acheteurId: acheteurId || 'CLIENT_ANONYME',
        typeVente: typeVente || 'DETAIL',
        lignes,
        total: Number(total || 0),
        statut: 'validee',
        dateVente
      };

      transaction.set(venteRef, nouvelleVente);
    });

    return {
      success: true,
      venteId: venteRef.id,
      message: 'Vente enregistrée avec succès.'
    };

  } catch (error) {
    console.error('Erreur lors de la transaction de vente:', error);
    throw new functions.https.HttpsError('failed-precondition', error.message);
  }
});

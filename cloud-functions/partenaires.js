const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cloud Function : envoyerDemandeConnexion
 * Recherche l'utilisateur par téléphone ou email et crée de façon atomique (transaction) :
 * 1. Le document /relations/{relationId}
 * 2. La notification dans /notifications/{destinataireId}/items/{notifId}
 */
exports.envoyerDemandeConnexion = functions.https.onCall(async (data, context) => {
  // 1. Authentification obligatoire
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Vous devez être connecté pour envoyer une demande de partenariat.'
    );
  }

  const demandeurId = context.auth.uid;
  const { destinataireIdentifiant, notes } = data;

  if (!destinataireIdentifiant || typeof destinataireIdentifiant !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Veuillez fournir un numéro de téléphone ou un e-mail valide.'
    );
  }

  const cleanIdentifiant = destinataireIdentifiant.trim();

  // 2. Recherche du destinataire par email ou téléphone
  let destinataireDoc = null;
  
  // Recherche par email
  if (cleanIdentifiant.includes('@')) {
    const emailSnap = await db.collection('users')
      .where('email', '==', cleanIdentifiant.toLowerCase())
      .limit(1)
      .get();
    if (!emailSnap.empty) {
      destinataireDoc = emailSnap.docs[0];
    }
  }

  // Recherche par téléphone
  if (!destinataireDoc) {
    const phoneSnap = await db.collection('users')
      .where('phone', '==', cleanIdentifiant)
      .limit(1)
      .get();
    if (!phoneSnap.empty) {
      destinataireDoc = phoneSnap.docs[0];
    }
  }

  // Si pas trouvé par numéro brut, essayer avec nettoyage de format (+226...)
  if (!destinataireDoc) {
    const altPhoneSnap = await db.collection('users')
      .where('phone', '==', cleanIdentifiant.replace(/\s+/g, ''))
      .limit(1)
      .get();
    if (!altPhoneSnap.empty) {
      destinataireDoc = altPhoneSnap.docs[0];
    }
  }

  if (!destinataireDoc) {
    throw new functions.https.HttpsError(
      'not-found',
      `Aucun utilisateur trouvé avec l'identifiant "${cleanIdentifiant}".`
    );
  }

  const destinataireId = destinataireDoc.id;
  const destinataireData = destinataireDoc.data();

  if (destinataireId === demandeurId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Vous ne pouvez pas vous envoyer une demande de connexion à vous-même.'
    );
  }

  // Obtenir le profil du demandeur
  const demandeurDoc = await db.collection('users').doc(demandeurId).get();
  const demandeurData = demandeurDoc.exists ? demandeurDoc.data() : { name: 'Utilisateur', role: 'PARTENAIRE' };
  const demandeurNom = demandeurData.companyName || demandeurData.name || 'Un partenaire';

  // ID déterministe pour la relation
  const relationId = [demandeurId, destinataireId].sort().join('_');
  const relationRef = db.collection('relations').doc(relationId);
  const notifRef = db.collection('notifications').doc(destinataireId).collection('items').doc();

  // 3. Transaction Firestore atomique
  try {
    await db.runTransaction(async (transaction) => {
      const relSnap = await transaction.get(relationRef);
      
      if (relSnap.exists) {
        const existingData = relSnap.data();
        if (existingData.statut === 'actif') {
          throw new Error('Vous êtes déjà connecté avec ce partenaire.');
        }
        if (existingData.statut === 'en_attente') {
          throw new Error('Une demande de connexion est déjà en attente entre vous.');
        }
      }

      const now = admin.firestore.FieldValue.serverTimestamp();

      // Écriture relation
      transaction.set(relationRef, {
        demandeurId,
        destinataireId,
        statut: 'en_attente',
        dateCreation: now,
        dateReponse: null,
        participants: [demandeurId, destinataireId],
        notes: notes || '',
        demandeurNom,
        demandeurRole: demandeurData.role || '',
        destinataireNom: destinataireData.companyName || destinataireData.name || 'Partenaire',
        destinataireRole: destinataireData.role || ''
      }, { merge: true });

      // Écriture notification pour le destinataire
      transaction.set(notifRef, {
        type: 'demande_connexion',
        relationId,
        expediteurId: demandeurId,
        lu: false,
        dateCreation: now,
        contenu: `${demandeurNom} (${demandeurData.role || 'Partenaire'}) vous a envoyé une demande de connexion B2B.`
      });
    });

    return {
      success: true,
      relationId,
      destinataireId,
      destinataireNom: destinataireData.companyName || destinataireData.name,
      message: `Demande de connexion transmise avec succès à ${destinataireData.companyName || destinataireData.name}.`
    };

  } catch (error) {
    console.error('Erreur transaction envoyerDemandeConnexion:', error);
    throw new functions.https.HttpsError('failed-precondition', error.message);
  }
});

/**
 * Cloud Function : repondreDemandeConnexion
 * Permet au destinataire d'accepter ou de refuser une demande.
 * Transaction atomique : mise à jour statut + notification de retour au demandeur.
 */
exports.repondreDemandeConnexion = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Vous devez être connecté pour répondre à cette demande.'
    );
  }

  const userId = context.auth.uid;
  const { relationId, reponse } = data; // reponse: 'accepter' | 'refuser'

  if (!relationId || !['accepter', 'refuser'].includes(reponse)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Paramètres invalides. Fournir relationId et reponse ("accepter" ou "refuser").'
    );
  }

  const relationRef = db.collection('relations').doc(relationId);

  try {
    let responseMessage = '';

    await db.runTransaction(async (transaction) => {
      const relSnap = await transaction.get(relationRef);

      if (!relSnap.exists) {
        throw new Error('La demande de connexion est introuvable.');
      }

      const relation = relSnap.data();

      // Sécurité : Vérifier que c'est bien le destinataire qui répond
      if (relation.destinataireId !== userId) {
        throw new Error('Vous n’êtes pas autorisé à répondre à cette demande de connexion.');
      }

      if (relation.statut !== 'en_attente') {
        throw new Error(`Cette demande a déjà été traitée (statut actuel : ${relation.statut}).`);
      }

      const nouveauStatut = reponse === 'accepter' ? 'actif' : 'refuse';
      const now = admin.firestore.FieldValue.serverTimestamp();

      // 1. Mise à jour de la relation
      transaction.update(relationRef, {
        statut: nouveauStatut,
        dateReponse: now
      });

      // Obtenir le nom du destinataire (celui qui répond)
      const respondentDoc = await transaction.get(db.collection('users').doc(userId));
      const respondentData = respondentDoc.exists ? respondentDoc.data() : {};
      const respondentNom = respondentData.companyName || respondentData.name || 'Un partenaire';

      // 2. Création de la notification de retour pour le demandeur
      const notifDemandeurRef = db.collection('notifications')
        .doc(relation.demandeurId)
        .collection('items')
        .doc();

      const typeNotif = reponse === 'accepter' ? 'connexion_acceptee' : 'connexion_refusee';
      const texteNotif = reponse === 'accepter'
        ? `${respondentNom} a accepté votre demande de connexion. Vous pouvez désormais échanger et consulter vos catalogues.`
        : `${respondentNom} a décliné votre demande de connexion.`;

      transaction.set(notifDemandeurRef, {
        type: typeNotif,
        relationId,
        expediteurId: userId,
        lu: false,
        dateCreation: now,
        contenu: texteNotif
      });

      responseMessage = reponse === 'accepter' 
        ? `Partenariat avec ${relation.demandeurNom || 'le demandeur'} activé avec succès.` 
        : `Demande de partenariat refusée.`;
    });

    return {
      success: true,
      relationId,
      statut: reponse === 'accepter' ? 'actif' : 'refuse',
      message: responseMessage
    };

  } catch (error) {
    console.error('Erreur transaction repondreDemandeConnexion:', error);
    throw new functions.https.HttpsError('failed-precondition', error.message);
  }
});

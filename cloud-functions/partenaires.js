/**
 * Partenariats B2B — Cloud Functions (SDK v2).
 *
 * Exposent des callables pour demander/activer un partenariat de façon
 * atomique (transaction Firestore) :
 *   - recherche du partenaire par e-mail ou téléphone (collection 'profiles'),
 *   - écriture de la relation (collection 'relations', id = uid1_uid2 triés,
 *     champs grossiste_id / client_id, statut en_attente | actif | refuse),
 *   - notification correspondante (collection plate 'notifications').
 *
 * Le client (connectionService / NotificationBell) lit ces documents et les
 * normalise via relationFromDb / mappers, donc les statuts en français sont
 * volontairement conservés (cohérents avec l'ancien schéma).
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const { db, admin, serverTimestamp, createNotification, displayName, getRelation, normalizeRelation } = require('./common');

/** Recherche un profil (collection 'profiles') par e-mail ou téléphone. */
async function findProfileByIdentifiant(identifiant) {
  const clean = identifiant.trim();

  const snapshots = [];

  if (clean.includes('@')) {
    snapshots.push(
      await db.collection('profiles').where('email', '==', clean.toLowerCase()).limit(1).get()
    );
  }

  // Téléphone brut puis sans espaces.
  snapshots.push(
    await db.collection('profiles').where('telephone', '==', clean).limit(1).get()
  );
  const sansEspaces = clean.replace(/\s+/g, '');
  if (sansEspaces !== clean) {
    snapshots.push(
      await db.collection('profiles').where('telephone', '==', sansEspaces).limit(1).get()
    );
  }

  for (const snap of snapshots) {
    if (!snap.empty) return snap.docs[0];
  }
  return null;
}

/**
 * Callable — envoyerDemandeConnexion
 * Crée atomiquement la relation + la notification pour le destinataire.
 */
exports.envoyerDemandeConnexion = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Vous devez être connecté pour envoyer une demande de partenariat.');
  }
  const demandeurId = request.auth.uid;
  const { destinataireIdentifiant, notes } = request.data || {};

  if (!destinataireIdentifiant || typeof destinataireIdentifiant !== 'string') {
    throw new HttpsError('invalid-argument', 'Veuillez fournir un numéro de téléphone ou un e-mail valide.');
  }
  const cleanIdentifiant = destinataireIdentifiant.trim();
  if (!cleanIdentifiant) {
    throw new HttpsError('invalid-argument', 'Veuillez fournir un numéro de téléphone ou un e-mail valide.');
  }

  const destDoc = await findProfileByIdentifiant(cleanIdentifiant);
  if (!destDoc) {
    throw new HttpsError('not-found', `Aucun utilisateur trouvé avec l'identifiant "${cleanIdentifiant}".`);
  }
  const destinataireId = destDoc.id;
  const destinataireData = destDoc.data();

  if (destinataireId === demandeurId) {
    throw new HttpsError('invalid-argument', 'Vous ne pouvez pas vous envoyer une demande de connexion à vous-même.');
  }

  const demandeurDoc = await db.collection('profiles').doc(demandeurId).get();
  const demandeurData = demandeurDoc.exists ? demandeurDoc.data() : {};
  const demandeurNom = displayName(demandeurData);
  const demandeurRole = demandeurData.role || '';

  const relationId = [demandeurId, destinataireId].sort().join('_');
  const relationRef = db.collection('relations').doc(relationId);

  try {
    await db.runTransaction(async (transaction) => {
      const relSnap = await transaction.get(relationRef);
      if (relSnap.exists) {
        const existing = normalizeRelation(relSnap.data());
        if (existing && existing.statut === 'actif') {
          throw new Error('Vous êtes déjà connecté avec ce partenaire.');
        }
        if (existing && existing.statut === 'en_attente') {
          throw new Error('Une demande de connexion est déjà en attente entre vous.');
        }
      }

      const now = serverTimestamp();
      transaction.set(relationRef, {
        id: relationId,
        grossiste_id: demandeurId,
        client_id: destinataireId,
        statut: 'en_attente',
        created_at: new Date().toISOString(),
        dateReponse: null,
        participants: [demandeurId, destinataireId],
        notes: notes || '',
        demandeurNom,
        demandeurRole,
        destinataireNom: displayName(destinataireData),
        destinataireRole: destinataireData.role || ''
      }, { merge: true });

      // Notification pour le destinataire (écrite en transaction pour l'atomicité).
      const notifRef = db.collection('notifications').doc();
      transaction.set(notifRef, {
        id: notifRef.id,
        user_id: destinataireId,
        type: 'demande_connexion',
        related_id: relationId,
        relation_id: relationId,
        sender_id: demandeurId,
        title: 'Nouvelle demande de partenariat',
        message: `${demandeurNom} (${demandeurRole || 'Un partenaire'}) vous a envoyé une demande de connexion B2B.`,
        read: false,
        lu: false,
        created_at: new Date().toISOString()
      });
    });

    return {
      success: true,
      relationId,
      destinataireId,
      destinataireNom: displayName(destinataireData),
      message: `Demande de connexion transmise avec succès à ${displayName(destinataireData)}.`
    };
  } catch (error) {
    console.error('Erreur transaction envoyerDemandeConnexion:', error);
    throw new HttpsError('failed-precondition', error.message);
  }
});

/**
 * Callable — repondreDemandeConnexion
 * Accepte ('accepter') ou refuse ('refuser') une demande.
 * Seul le destinataire (client_id) peut répondre.
 */
exports.repondreDemandeConnexion = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Vous devez être connecté pour répondre à cette demande.');
  }
  const userId = request.auth.uid;
  const { relationId, reponse } = request.data || {};

  if (!relationId || !['accepter', 'refuser'].includes(reponse)) {
    throw new HttpsError('invalid-argument', 'Paramètres invalides. Fournir relationId et reponse ("accepter" ou "refuser").');
  }

  const relationRef = db.collection('relations').doc(relationId);

  try {
    let responseMessage = '';

    await db.runTransaction(async (transaction) => {
      const relSnap = await transaction.get(relationRef);
      if (!relSnap.exists) {
        throw new Error('La demande de connexion est introuvable.');
      }

      const raw = relSnap.data();
      const relation = normalizeRelation(raw);
      const destinataireId = relation.client_id || raw.destinataireId;

      if (destinataireId !== userId) {
        throw new Error('Vous n’êtes pas autorisé à répondre à cette demande de connexion.');
      }
      if (relation.statut !== 'en_attente') {
        throw new Error(`Cette demande a déjà été traitée (statut actuel : ${relation.statut}).`);
      }

      const nouveauStatut = reponse === 'accepter' ? 'actif' : 'refuse';
      const now = serverTimestamp();

      transaction.update(relationRef, {
        statut: nouveauStatut,
        dateReponse: now,
        reponse_nom: nouveauStatut === 'actif' ? 'acceptee' : 'refusee'
      });

      const demandeurId = relation.grossiste_id || raw.demandeurId;

      const respondentDoc = await transaction.get(db.collection('profiles').doc(userId));
      const respondentData = respondentDoc.exists ? respondentDoc.data() : {};
      const respondentNom = displayName(respondentData);

      const typeNotif = reponse === 'accepter' ? 'connexion_acceptee' : 'connexion_refusee';
      const texteNotif = reponse === 'accepter'
        ? `${respondentNom} a accepté votre demande de connexion. Vous pouvez désormais échanger et consulter vos catalogues.`
        : `${respondentNom} a décliné votre demande de connexion.`;

      const notifRef = db.collection('notifications').doc();
      transaction.set(notifRef, {
        id: notifRef.id,
        user_id: demandeurId,
        type: typeNotif,
        related_id: relationId,
        relation_id: relationId,
        sender_id: userId,
        title: reponse === 'accepter' ? 'Demande acceptée' : 'Demande refusée',
        message: texteNotif,
        read: false,
        lu: false,
        created_at: new Date().toISOString()
      });

      responseMessage = reponse === 'accepter'
        ? `Partenariat avec ${relation.demandeurNom || 'le demandeur'} activé avec succès.`
        : 'Demande de partenariat refusée.';
    });

    return {
      success: true,
      relationId,
      statut: reponse === 'accepter' ? 'actif' : 'refuse',
      message: responseMessage
    };
  } catch (error) {
    console.error('Erreur transaction repondreDemandeConnexion:', error);
    throw new HttpsError('failed-precondition', error.message);
  }
});
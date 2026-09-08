/**
 * Partenariats B2B — POST /api/relations.
 * Port des callables envoyerDemandeConnexion / repondreDemandeConnexion et d'un
 * endpoint /process qui émet les notifications manquantes pour les relations
 * écrites directement par le client (offline-first) — garde connexion_notifs.
 */
import { Router } from 'express';
import { db, serverTimestamp, createNotification, displayName, getRelation, normalizeRelation } from '../common.js';

const router = Router();

/** Recherche un profil (collection 'profiles') par e-mail ou téléphone. */
async function findProfileByIdentifiant(identifiant) {
  const clean = identifiant.trim();
  const snapshots = [];

  if (clean.includes('@')) {
    snapshots.push(await db.collection('profiles').where('email', '==', clean.toLowerCase()).limit(1).get());
  }

  snapshots.push(await db.collection('profiles').where('telephone', '==', clean).limit(1).get());
  const sansEspaces = clean.replace(/\s+/g, '');
  if (sansEspaces !== clean) {
    snapshots.push(await db.collection('profiles').where('telephone', '==', sansEspaces).limit(1).get());
  }

  for (const snap of snapshots) {
    if (!snap.empty) return snap.docs[0];
  }
  return null;
}

/**
 * POST /api/relations  — envoyer une demande de connexion (transaction atomique
 * relation + notification destinataire).
 */
router.post('/', async (req, res) => {
  try {
    const demandeurId = req.uid;
    const { destinataireIdentifiant, notes } = req.body || {};

    if (!destinataireIdentifiant || typeof destinataireIdentifiant !== 'string') {
      return res.status(400).json({ error: 'Veuillez fournir un numéro de téléphone ou un e-mail valide.' });
    }
    const cleanIdentifiant = destinataireIdentifiant.trim();
    if (!cleanIdentifiant) {
      return res.status(400).json({ error: 'Veuillez fournir un numéro de téléphone ou un e-mail valide.' });
    }

    const destDoc = await findProfileByIdentifiant(cleanIdentifiant);
    if (!destDoc) {
      return res.status(404).json({ error: `Aucun utilisateur trouvé avec l'identifiant "${cleanIdentifiant}".` });
    }
    const destinataireId = destDoc.id;
    const destinataireData = destDoc.data();

    if (destinataireId === demandeurId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous envoyer une demande de connexion à vous-même.' });
    }

    const demandeurDoc = await db.collection('profiles').doc(demandeurId).get();
    const demandeurData = demandeurDoc.exists ? demandeurDoc.data() : {};
    const demandeurNom = displayName(demandeurData);
    const demandeurRole = demandeurData.role || '';

    const relationId = [demandeurId, destinataireId].sort().join('_');
    const relationRef = db.collection('relations').doc(relationId);

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
        destinataireRole: destinataireData.role || '',
        connexion_notifs: true
      }, { merge: true });

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

    return res.json({
      success: true,
      relationId,
      destinataireId,
      destinataireNom: displayName(destinataireData),
      message: `Demande de connexion transmise avec succès à ${displayName(destinataireData)}.`
    });
  } catch (error) {
    console.error('[relations] Erreur transaction envoyerDemande:', error);
    return res.status(409).json({ error: error.message });
  }
});

/**
 * POST /api/relations/:relationId/repondre  — accepter ou refuser (destinataire).
 */
router.post('/:relationId/repondre', async (req, res) => {
  try {
    const userId = req.uid;
    const relationId = req.params.relationId;
    const { reponse } = req.body || {};

    if (!relationId || !['accepter', 'refuser'].includes(reponse)) {
      return res.status(400).json({ error: 'Paramètres invalides. Fournir relationId et reponse ("accepter" ou "refuser").' });
    }

    const relationRef = db.collection('relations').doc(relationId);
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
        reponse_nom: nouveauStatut === 'actif' ? 'acceptee' : 'refusee',
        connexion_notifs: true
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

    res.json({ success: true, relationId, statut: reponse === 'accepter' ? 'actif' : 'refuse', message: responseMessage });
  } catch (error) {
    console.error('[relations] Erreur transaction repondre:', error);
    res.status(409).json({ error: error.message });
  }
});

/**
 * POST /api/relations/:relationId/process
 * Émet les notifications de partenariat manquantes pour une relation écrite
 * directement côté client (hors callable). Grosse garde connexion_notifs :
 * si la relation a été créée/répondue par l'API, on ne notifie pas 2 fois.
 */
router.post('/:relationId/process', async (req, res) => {
  try {
    const relationId = req.params.relationId;
    const raw = await getRelation(relationId);
    if (!raw) return res.status(404).json({ error: 'Relation introuvable.' });

    if (raw.connexion_notifs === true) {
      return res.json({ success: true, skipped: true, message: 'Notifications déjà émises pour cette relation.' });
    }

    const relation = normalizeRelation(raw);
    const { statut } = relation;
    const grossisteId = relation.grossiste_id;
    const clientId = relation.client_id;

    if (statut === 'en_attente') {
      if (!clientId || !grossisteId) return res.json({ success: true, skipped: true, message: 'Acteurs incomplets.' });
      await createNotification({
        userId: clientId,
        type: 'demande_connexion',
        relatedId: relationId,
        senderId: grossisteId,
        title: 'Nouvelle demande de partenariat',
        message: `${relation.demandeurNom || displayName(raw) || 'Un partenaire'} (${relation.demandeurRole || 'Un partenaire'}) vous a envoyé une demande de connexion B2B.`
      });
    } else if (statut === 'actif' || statut === 'refuse') {
      if (!grossisteId || !clientId) return res.json({ success: true, skipped: true, message: 'Acteurs incomplets.' });
      const accepter = statut === 'actif';
      await createNotification({
        userId: grossisteId,
        type: accepter ? 'connexion_acceptee' : 'connexion_refusee',
        relatedId: relationId,
        senderId: clientId,
        title: accepter ? 'Demande acceptée' : 'Demande refusée',
        message: accepter
          ? `${relation.destinataireNom || 'Le partenaire'} a accepté votre demande de connexion. Vous pouvez désormais échanger et consulter vos catalogues.`
          : `${relation.destinataireNom || 'Le partenaire'} a décliné votre demande de connexion.`
      });
    }

    await db.collection('relations').doc(relationId).update({ connexion_notifs: true });

    res.json({ success: true, message: 'Notifications de partenariat émises.' });
  } catch (error) {
    console.error('[relations] Erreur process:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
/**
 * Administration & rôles — POST/PATCH/DELETE /api/admin/...
 * Port des callables supprimerCompteAdmin / modifierRoleUtilisateur et du
 * trigger onProfileWritten (synchronisation sécurisée des claims).
 */
import { Router } from 'express';
import { db, admin, normalizeRole, computeRole, isAdminUid, getProfile, ADMIN_EMAILS } from '../common.js';

const router = Router();

/**
 * POST /api/admin/users/:uid/claims
 * Port du trigger onProfileWritten : synchronise les claims personnalisées
 * avec le rôle du profil, avec anti-escalade (ADMIN non privilégié ⇒ CLIENT).
 * Le marqueur _roleAssignedByAdmin pose un court-circuit (attribution admin).
 */
router.post('/users/:uid/claims', async (req, res) => {
  try {
    const uid = req.params.uid;
    const ref = db.collection('profiles').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Profil introuvable.' });

    const data = snap.data();
    if (!data) return res.json({ success: true, skipped: true, message: 'Profil vide.' });

    if (data._roleAssignedByAdmin === true) {
      await ref.update({ _roleAssignedByAdmin: admin.firestore.FieldValue.delete() });
      return res.json({ success: true, skipped: true, message: 'Attribution admin déjà appliquée (marqueur retiré).' });
    }

    const email = (data.email || '').toLowerCase().trim();
    const isPrivilegedEmail = ADMIN_EMAILS.includes(email);

    const assignedRole = computeRole(
      data.email,
      data.companyName,
      `${data.prenom || ''} ${data.nom || ''}`.trim(),
      data.role || 'CLIENT'
    );

    const safeRole = (assignedRole === 'ADMIN' && !isPrivilegedEmail) ? 'CLIENT' : assignedRole;

    await admin.auth().setCustomUserClaims(uid, {
      role: safeRole,
      rôle: safeRole,
      admin: safeRole === 'ADMIN'
    });

    if (safeRole !== assignedRole) {
      await ref.update({ role: safeRole });
    }

    res.json({ success: true, role: safeRole, message: `Claims synchronisées pour ${uid} : ${safeRole}` });
  } catch (error) {
    console.error('[admin] Erreur sync claims:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/users/:uid/role  — modifier un rôle (admin requis).
 */
router.patch('/users/:uid/role', async (req, res) => {
  try {
    const callerUid = req.uid;
    const targetUid = req.params.uid;
    const rawRole = (req.body && (req.body.rôle || req.body.role || req.body.newRole)) || '';

    if (!targetUid) return res.status(400).json({ error: 'Veuillez fournir un identifiant utilisateur (uid) valide.' });
    if (!rawRole || typeof rawRole !== 'string') return res.status(400).json({ error: 'Veuillez fournir un rôle valide.' });

    const newRole = normalizeRole(rawRole);

    const profileSnap = await db.collection('profiles').doc(targetUid).get();
    if (!profileSnap.exists) {
      return res.status(404).json({ error: "L'utilisateur cible n'existe pas dans Firestore (profiles)." });
    }

    const profile = profileSnap.data();
    const finalRole = computeRole(profile.email, profile.companyName, `${profile.prenom || ''} ${profile.nom || ''}`.trim(), newRole);

    await admin.auth().setCustomUserClaims(targetUid, {
      role: finalRole,
      rôle: finalRole,
      admin: finalRole === 'ADMIN'
    });

    await db.collection('profiles').doc(targetUid).update({ role: finalRole, _roleAssignedByAdmin: true });

    const legacyRef = db.collection('utilisateurs').doc(targetUid);
    const legacySnap = await legacyRef.get();
    if (legacySnap.exists) {
      await legacyRef.update({ role: finalRole, rôle: finalRole });
    }

    res.json({ success: true, message: `Le rôle de l'utilisateur ${targetUid} a été modifié en ${finalRole} avec succès.` });
  } catch (error) {
    console.error('[admin] Erreur modification rôle:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/users/:uid  — supprimer un compte (admin requis).
 */
router.delete('/users/:uid', async (req, res) => {
  try {
    const callerUid = req.uid;
    const targetUid = req.params.uid;

    if (!targetUid || typeof targetUid !== 'string') {
      return res.status(400).json({ error: 'Veuillez fournir un identifiant utilisateur (uid) valide.' });
    }
    if (targetUid === callerUid) {
      return res.status(400).json({ error: 'Un administrateur ne peut pas supprimer son propre compte.' });
    }

    try {
      await admin.auth().deleteUser(targetUid);
    } catch (authError) {
      console.warn(`L'utilisateur ${targetUid} n'a pas été supprimé d'Auth (peut-être déjà inexistant) :`, authError.message);
    }

    await db.collection('profiles').doc(targetUid).delete();

    res.json({
      success: true,
      message: `L'utilisateur ${targetUid} a été supprimé de Firebase Authentication et de Firestore.`
    });
  } catch (error) {
    console.error("[admin] Erreur lors de la suppression du compte par l'administrateur:", error);
    res.status(500).json({ error: `Échec de la suppression du compte : ${error.message}` });
  }
});

export default router;
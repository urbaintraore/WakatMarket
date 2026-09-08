/**
 * Administration & rôles — Cloud Functions (SDK v2).
 *
 * Adaptées au modèle actuel : la collection des utilisateurs est 'profiles'
 * (doc id = uid Firebase). Les rôles sont normalisés côté serveur via
 * common.normalizeRole et les claims personnalisées sont synchronisées.
 */
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { beforeUserCreated } = require('firebase-functions/v2/identity');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

const { db, admin, normalizeRole, computeRole, isAdminUid, getProfile } = require('./common');

/**
 * Trigger profiles/{uid} (création / mise à jour / suppression).
 * Synchronise les claims personnalisées Firebase Auth avec le rôle défini
 * dans le profil Firestore.
 *
 * Sécuritisation anti-escalade : le rôle ADMIN ne peut être propagé qu'à
 * partir d'un e-mail privilégié (admin racine). Une auto-sélection "Admin"
 * depuis le formulaire d'inscription est donc rabaissée (et le profil corrigé).
 * Les attributions ADMIN légitimes passent par modifierRoleUtilisateur
 * (contrôle d'accès admin), qui pose un marqueur pour que ce trigger ne
 * réécrase pas les claims posées par le callable.
 */
exports.onProfileWritten = onDocumentWritten('profiles/{uid}', async (event) => {
  const uid = event.params.uid;
  const data = event.data.after ? event.data.after.data() : null;
  if (!data) return null;

  // Attribution posée par modifierRoleUtilisateur (admin requis) :
  // les claims sont déjà appliquées par le callable → on retire juste le marqueur.
  if (data._roleAssignedByAdmin === true) {
    await event.data.after.ref.update({
      _roleAssignedByAdmin: admin.firestore.FieldValue.delete()
    });
    return null;
  }

  const email = (data.email || '').toLowerCase().trim();
  const isPrivilegedEmail = ADMIN_EMAILS.includes(email);

  const assignedRole = computeRole(
    data.email,
    data.companyName,
    `${data.prenom || ''} ${data.nom || ''}`.trim(),
    data.role || 'CLIENT'
  );

  // Anti-escalade : un profil auto-écrit en ADMIN (e-mail non privilégié)
  // est immédiatement ramené à CLIENT.
  const safeRole = (assignedRole === 'ADMIN' && !isPrivilegedEmail)
    ? 'CLIENT'
    : assignedRole;

  try {
    await admin.auth().setCustomUserClaims(uid, {
      role: safeRole,
      rôle: safeRole,
      admin: safeRole === 'ADMIN'
    });

    if (safeRole !== assignedRole) {
      await event.data.after.ref.update({ role: safeRole });
    }

    console.log(`[onProfileWritten] Claims synchronisées pour ${uid} : ${safeRole}`);
  } catch (e) {
    console.warn(`[onProfileWritten] Impossible de définir les claims pour ${uid}:`, e.message);
  }
  return null;
});

/**
 * Trigger création de compte Firebase Auth : affecte un rôle initial
 * basé sur l'e-mail (admins / Bonkoungou), avant que le compte n'existe.
 */
exports.onUserCreated = beforeUserCreated(async (user) => {
  const email = (user.email || '').toLowerCase().trim();
  const role = computeRole(email, null, null, 'CLIENT');

  // Un profil Firestore pré-créé doit rester prioritaire (rare mais possible
  // via exports : un admin peut pré-enregistrer un profil avant la connexion).
  let existingRole = role;
  try {
    const profile = await getProfile(user.uid);
    if (profile && profile.role) {
      existingRole = computeRole(email, profile.companyName, `${profile.prenom || ''} ${profile.nom || ''}`.trim(), profile.role);
    }
  } catch (e) {
    console.warn('[onUserCreated] Profil pré-existant illisible :', e.message);
  }

  return {
    customClaims: {
      role: existingRole,
      rôle: existingRole,
      admin: existingRole === 'ADMIN'
    }
  };
});

/**
 * Callable — supprimerCompteAdmin
 * Supprime définitivement un utilisateur (Auth + profile Firestore).
 * Réservé aux administrateurs.
 */
exports.supprimerCompteAdmin = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Vous devez être connecté pour effectuer cette action.');
  }
  const callerUid = request.auth.uid;
  if (!(await isAdminUid(callerUid))) {
    throw new HttpsError('permission-denied', 'Accès refusé. Vous devez être administrateur pour effectuer cette opération.');
  }

  const targetUid = request.data.uid || request.data.userId;
  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'Veuillez fournir un identifiant utilisateur (uid) valide.');
  }
  if (targetUid === callerUid) {
    throw new HttpsError('invalid-argument', 'Un administrateur ne peut pas supprimer son propre compte.');
  }

  try {
    try {
      await admin.auth().deleteUser(targetUid);
    } catch (authError) {
      console.warn(`L'utilisateur ${targetUid} n'a pas été supprimé d'Auth (peut-être déjà inexistant) :`, authError.message);
    }

    await db.collection('profiles').doc(targetUid).delete();

    return {
      success: true,
      message: `L'utilisateur ${targetUid} a été supprimé de Firebase Authentication et de Firestore.`
    };
  } catch (error) {
    console.error("Erreur lors de la suppression du compte par l'administrateur:", error);
    throw new HttpsError('internal', `Échec de la suppression du compte : ${error.message}`);
  }
});

/**
 * Callable — modifierRoleUtilisateur
 * Modifie le rôle d'un utilisateur dans 'profiles' et synchronise les claims.
 * Réservé aux administrateurs.
 */
exports.modifierRoleUtilisateur = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Vous devez être connecté pour modifier un rôle.');
  }
  const callerUid = request.auth.uid;
  if (!(await isAdminUid(callerUid))) {
    throw new HttpsError('permission-denied', 'Accès refusé. Vous devez être administrateur pour cette opération.');
  }

  const targetUid = request.data.uid || request.data.userId;
  const rawRole = request.data.rôle || request.data.role || request.data.newRole;

  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'Veuillez fournir un identifiant utilisateur (uid) valide.');
  }
  if (!rawRole || typeof rawRole !== 'string') {
    throw new HttpsError('invalid-argument', 'Veuillez fournir un rôle valide.');
  }

  const newRole = normalizeRole(rawRole);

  const profileSnap = await db.collection('profiles').doc(targetUid).get();
  if (!profileSnap.exists) {
    throw new HttpsError('not-found', "L'utilisateur cible n'existe pas dans Firestore (profiles).");
  }

  try {
    const profile = profileSnap.data();
    const finalRole = computeRole(profile.email, profile.companyName, `${profile.prenom || ''} ${profile.nom || ''}`.trim(), newRole);

    await admin.auth().setCustomUserClaims(targetUid, {
      role: finalRole,
      rôle: finalRole,
      admin: finalRole === 'ADMIN'
    });

    // Marqueur pour que onProfileWritten (déclenché par cette écriture) ne
    // réécrase pas les claims posées ci-dessus (contrôle admin déjà appliqué).
    await db.collection('profiles').doc(targetUid).update({ role: finalRole, _roleAssignedByAdmin: true });

    // Mise à jour locale éventuelle (ancienne collection 'utilisateurs' conservée en lecture).
    const legacyRef = db.collection('utilisateurs').doc(targetUid);
    const legacySnap = await legacyRef.get();
    if (legacySnap.exists) {
      await legacyRef.update({ role: finalRole, rôle: finalRole });
    }

    return {
      success: true,
      message: `Le rôle de l'utilisateur ${targetUid} a été modifié en ${finalRole} avec succès.`
    };
  } catch (error) {
    console.error("Erreur lors de la modification du rôle de l'utilisateur:", error);
    throw new HttpsError('internal', `Échec de la modification du rôle : ${error.message}`);
  }
});
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Helper function to verify that the caller is an authenticated admin.
 * Uses Firebase Admin SDK to check both Firestore role and Custom Claims.
 */
async function checkAdminAuth(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Vous devez être connecté pour effectuer cette action.'
    );
  }

  const callerUid = context.auth.uid;

  // 1. Check Custom Claims first for fast validation
  if (context.auth.token && context.auth.token.admin === true) {
    return callerUid;
  }

  // 2. Fallback: Query the users collection in Firestore
  try {
    const userDoc = await db.collection('users').doc(callerUid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Accès refusé. Compte utilisateur introuvable.'
      );
    }

    const userData = userDoc.data();
    const isCallerAdmin = userData && (userData.rôle === 'ADMIN' || userData.role === 'ADMIN');

    if (!isCallerAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Accès refusé. Vous devez être administrateur pour effectuer cette opération.'
      );
    }

    // Set Custom Claims dynamically if they weren't set yet, for subsequent requests
    await admin.auth().setCustomUserClaims(callerUid, { admin: true });

    return callerUid;
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error('Erreur lors de la vérification des droits admin:', error);
    throw new functions.https.HttpsError(
      'permission-denied',
      'Accès refusé. Échec de la vérification des privilèges administrateur.'
    );
  }
}

/**
 * Cloud Function : supprimerCompteAdmin
 * Supprime un utilisateur définitivement de Firebase Authentication et de Firestore.
 */
exports.supprimerCompteAdmin = functions.https.onCall(async (data, context) => {
  const callerUid = await checkAdminAuth(context);

  const targetUid = data.uid || data.userId;

  if (!targetUid || typeof targetUid !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Veuillez fournir un identifiant utilisateur (uid) valide.'
    );
  }

  if (targetUid === callerUid) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Un administrateur ne peut pas supprimer son propre compte.'
    );
  }

  try {
    // 1. Supprimer l'utilisateur de Firebase Authentication
    try {
      await admin.auth().deleteUser(targetUid);
    } catch (authError) {
      console.warn(`L'utilisateur ${targetUid} n'a pas pu être supprimé de Firebase Auth (peut-être déjà inexistant) :`, authError.message);
    }

    // 2. Supprimer l'utilisateur de Firestore (ou marquer comme supprimé)
    await db.collection('users').doc(targetUid).delete();

    return {
      success: true,
      message: `L'utilisateur ${targetUid} a été supprimé avec succès de Firebase Authentication et de la base de données Firestore.`
    };
  } catch (error) {
    console.error('Erreur lors de la suppression du compte par l\'administrateur:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Échec de la suppression du compte : ${error.message}`
    );
  }
});

/**
 * Cloud Function : modifierRoleUtilisateur
 * Modifie le rôle d'un utilisateur dans Firestore et met à jour ses Custom Claims correspondants.
 */
exports.modifierRoleUtilisateur = functions.https.onCall(async (data, context) => {
  const callerUid = await checkAdminAuth(context);

  const targetUid = data.uid || data.userId;
  const newRole = data.rôle || data.role || data.newRole;

  if (!targetUid || typeof targetUid !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Veuillez fournir un identifiant utilisateur (uid) valide.'
    );
  }

  if (!newRole || typeof newRole !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Veuillez fournir un rôle valide.'
    );
  }

  const userRef = db.collection('users').doc(targetUid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new functions.https.HttpsError(
      'not-found',
      'L\'utilisateur cible n\'existe pas dans Firestore.'
    );
  }

  try {
    // 1. Mettre à jour les Custom Claims dans Firebase Auth
    const isNewRoleAdmin = newRole.toUpperCase() === 'ADMIN';
    await admin.auth().setCustomUserClaims(targetUid, {
      role: newRole.toUpperCase(),
      rôle: newRole.toUpperCase(),
      admin: isNewRoleAdmin
    });

    // 2. Mettre à jour le rôle dans Firestore (champs rôle et role) sur 'users' et 'utilisateurs'
    const rolePayload = {
      rôle: newRole.toUpperCase(),
      role: newRole.toUpperCase()
    };

    await Promise.allSettled([
      db.collection('users').doc(targetUid).set(rolePayload, { merge: true }),
      db.collection('utilisateurs').doc(targetUid).set(rolePayload, { merge: true })
    ]);

    return {
      success: true,
      message: `Le rôle de l'utilisateur ${targetUid} a été modifié en ${newRole.toUpperCase()} avec succès.`
    };
  } catch (error) {
    console.error('Erreur lors de la modification du rôle de l\'utilisateur:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Échec de la modification du rôle : ${error.message}`
    );
  }
});

/**
 * Cloud Function : onUserCreated (Auth Trigger)
 * Déclenchée lors de la création d'un utilisateur Firebase Authentication.
 * Écrit le rôle correspondant dans les Custom Claims Firebase de manière persistante.
 */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  const email = (user.email || '').toLowerCase().trim();
  let initialRole = 'CLIENT';

  if (email === 'urbain.traore@yahoo.fr' || email === 'urbain.traoreurb@gmail.com' || email.includes('admin')) {
    initialRole = 'ADMIN';
  } else if (email === 'sayouba@ujkz.bf') {
    initialRole = 'SEMI_WHOLESALER';
  }

  // Vérifier si un document Firestore a déjà été créé avec un rôle spécifique
  try {
    let userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists) {
      userDoc = await db.collection('utilisateurs').doc(user.uid).get();
    }
    if (userDoc.exists) {
      const data = userDoc.data();
      if (data.rôle || data.role) {
        initialRole = (data.rôle || data.role).toUpperCase();
      }
    }
  } catch (e) {
    console.warn('Erreur lors de la lecture du profil utilisateur lors du trigger auth:', e);
  }

  const isAdmin = initialRole === 'ADMIN';
  await admin.auth().setCustomUserClaims(user.uid, {
    role: initialRole,
    rôle: initialRole,
    admin: isAdmin
  });
  console.log(`[Cloud Function onUserCreated] Custom claims initialisés pour ${user.uid}: rôle=${initialRole}`);
});

/**
 * Cloud Function : onUserDocWritten (Firestore Trigger)
 * Déclenchée lors de la création ou modification d'un document dans 'users/{uid}'.
 * Synchronise immédiatement les Custom Claims avec le rôle défini dans Firestore.
 */
exports.onUserDocWritten = functions.firestore
  .document('users/{uid}')
  .onWrite(async (change, context) => {
    const uid = context.params.uid;
    const data = change.after.exists ? change.after.data() : null;
    if (!data) return null;

    const assignedRole = (data.rôle || data.role || 'CLIENT').toUpperCase();
    const isAdmin = assignedRole === 'ADMIN';

    try {
      await admin.auth().setCustomUserClaims(uid, {
        role: assignedRole,
        rôle: assignedRole,
        admin: isAdmin
      });
      console.log(`[Cloud Function onUserDocWritten] Synchronisation Custom Claims pour ${uid}: ${assignedRole}`);
    } catch (e) {
      console.warn(`[Cloud Function onUserDocWritten] Impossible de définir les claims pour ${uid}:`, e.message);
    }
    return null;
  });


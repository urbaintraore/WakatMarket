/**
 * Helpers partagés de l'API WakatMarket (Render / Express).
 *
 * Miroir ESM de cloud-functions/common.js : même schéma Firestore (snake_case)
 * que l'ancien Postgres pour conserver les mappers du client :
 *   profiles, products, inventory, orders, ventes, relations,
 *   notifications, conversations, messages, factures, comptabilite
 *
 * Initialisation firebase-admin :
 *   - variable FIREBASE_SERVICE_ACCOUNT : contenu JSON du service account,
 *   - sinon GOOGLE_APPLICATION_CREDENTIALS / ADC (Application Default Credentials).
 */
import admin from 'firebase-admin';

if (!admin.apps.length) {
  const saJson = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (saJson) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(saJson))
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

const serverTimestamp = () => admin.firestore.FieldValue.serverTimestamp();
const increment = (n) => admin.firestore.FieldValue.increment(n);

// E-mails administrateurs "racine" (miroir serveur de la liste explicite
// ROOT_ADMIN_EMAILS de src/types.ts). Aucun e-mail contenant "admin" n'est
// auto-promu : l'attribution ADMIN passe par cette liste ou modifierRoleUtilisateur.
const ADMIN_EMAILS = ['urbain.traore@yahoo.fr', 'urbain.traoreurb@gmail.com', 'maremillogo10@gmail.com'];

const ROLE_ADMIN = 'ADMIN';
const ROLE_SEMI_WHOLESALER = 'SEMI_WHOLESALER';

/**
 * Miroir serveur de normalizeUserRole (src/types.ts) : normalise n'importe quel
 * intitulé de rôle vers les valeurs de l'enum UserRole.
 */
function normalizeRole(inputRole) {
  if (!inputRole) return 'CLIENT';
  const raw = String(inputRole).trim().toUpperCase();

  if (raw === ROLE_ADMIN || raw.includes('ADMIN')) return ROLE_ADMIN;
  if (raw === 'MANUFACTURER' || raw.includes('FABRICANT') || raw.includes('MANUFACTURER') || raw.includes('USINE')) return 'MANUFACTURER';
  if (
    raw === 'SEMI_WHOLESALER' ||
    raw.includes('SEMI_WHOLESALER') ||
    raw.includes('SEMI-WHOLESALER') ||
    raw.includes('SEMI_GROSSISTE') ||
    raw.includes('SEMI-GROSSISTE') ||
    raw.includes('DEMIGROSSISTE') ||
    raw.includes('DEMI-GROSSISTE') ||
    raw.includes('DEMI_GROSSISTE') ||
    raw.includes('HALF_WHOLESALER') ||
    raw.includes('DEMI') ||
    raw.includes('SEMI')
  ) return ROLE_SEMI_WHOLESALER;
  if (raw === 'WHOLESALER' || raw.includes('WHOLESALER') || raw.includes('GROSSISTE')) return 'WHOLESALER';
  if (raw === 'RETAILER' || raw.includes('RETAILER') || raw.includes('DETAILLANT') || raw.includes('DÉTAILLANT') || raw.includes('BOUTIQUE')) return 'RETAILER';
  if (raw === 'DRIVER_M2W' || raw.includes('DRIVER_M2W') || raw.includes('M2W')) return 'DRIVER_M2W';
  if (raw === 'DRIVER_W2R' || raw.includes('DRIVER_W2R') || raw.includes('W2R')) return 'DRIVER_W2R';
  if (raw === 'DRIVER_R2C' || raw.includes('DRIVER_R2C') || raw.includes('R2C')) return 'DRIVER_R2C';
  if (raw === 'DRIVER_W2SG' || raw.includes('DRIVER_W2SG') || raw.includes('W2SG')) return 'DRIVER_W2SG';
  if (raw === 'DRIVER_SG2R' || raw.includes('DRIVER_SG2R') || raw.includes('SG2R')) return 'DRIVER_SG2R';
  if (raw.includes('LIVREUR') || raw.includes('DRIVER')) return 'DRIVER_R2C';
  if (raw === 'CLIENT' || raw.includes('CLIENT') || raw.includes('ACHETEUR') || raw.includes('CUSTOMER')) return 'CLIENT';

  const allRoles = [
    'ADMIN', 'MANUFACTURER', 'WHOLESALER', 'SEMI_WHOLESALER', 'RETAILER',
    'CLIENT', 'DRIVER_M2W', 'DRIVER_W2R', 'DRIVER_R2C', 'DRIVER_W2SG', 'DRIVER_SG2R'
  ];
  if (allRoles.includes(raw)) return raw;

  return 'CLIENT';
}

/**
 * Miroir serveur de isBonkoungou (src/types.ts) : forçage du rôle
 * SEMI_WHOLESALER pour l'utilisateur Bonkoungou.
 */
function isBonkoungou(email, companyName, name) {
  const e = (email || '').toLowerCase().trim();
  const c = (companyName || '').toLowerCase().trim();
  const n = (name || '').toLowerCase().trim();
  return (
    e.includes('bonkoungou') ||
    e.includes('bonkougou') ||
    e.includes('sayouba') ||
    c.includes('bonkoungou') ||
    c.includes('bonkougou') ||
    n.includes('bonkoungou') ||
    n.includes('bonkougou') ||
    n.includes('sayouba')
  );
}

/**
 * Détermine le rôle d'un utilisateur en appliquant les forçages métier
 * (admins par e-mail, Bonkoungou), sinon le rôle normalisé du profil.
 */
function computeRole(email, companyName, name, existingRole) {
  const e = (email || '').toLowerCase().trim();
  if (ADMIN_EMAILS.includes(e)) return ROLE_ADMIN;
  if (isBonkoungou(email, companyName, name)) return ROLE_SEMI_WHOLESALER;
  return normalizeRole(existingRole || 'CLIENT');
}

/** Lit le profil Firestore d'un utilisateur (collection 'profiles'). */
async function getProfile(uid) {
  const snap = await db.collection('profiles').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

/**
 * Vérifie côté serveur qu'un uid est administrateur :
 *   1. claims personnalisées (admin === true),
 *   2. sinon profil Firestore (role === ADMIN ou e-mail privilégié).
 */
async function isAdminUid(uid) {
  if (!uid) return false;
  try {
    const user = await admin.auth().getUser(uid);
    if (user && user.customClaims && user.customClaims.admin === true) return true;
  } catch (e) {
    console.warn(`[isAdminUid] Impossible de lire les claims de ${uid}:`, e.message);
  }
  try {
    const profile = await getProfile(uid);
    if (!profile) return false;
    const email = profile.email || '';
    if (ADMIN_EMAILS.includes(email.toLowerCase().trim())) return true;
    return normalizeRole(profile.role) === ROLE_ADMIN;
  } catch (e) {
    console.warn(`[isAdminUid] Impossible de vérifier le profil de ${uid}:`, e.message);
    return false;
  }
}

/** Retourne le rôle normalisé effectif d'un utilisateur (claims ou profil). */
async function getUserRole(uid) {
  try {
    const user = await admin.auth().getUser(uid);
    if (user.customClaims && user.customClaims.role) {
      const fromClaims = normalizeRole(user.customClaims.role);
      if (fromClaims !== 'CLIENT' && (user.customClaims.role || '').toUpperCase().includes(user.customClaims.role.toUpperCase())) {
        return fromClaims;
      }
    }
  } catch (e) { /* ignorer */ }
  const profile = await getProfile(uid);
  return normalizeRole(profile ? profile.role : 'CLIENT');
}

/**
 * Crée une notification dans la collection plate 'notifications'
 * (compatible avec le lecteur du client : user_id, title, message,
 *  read/lu, created_at ISO, type, related_id, metadata).
 */
async function createNotification({ userId, type, title, message, relatedId, senderId, extra = {} }) {
  if (!userId) return null;
  const docRef = db.collection('notifications').doc();
  const payload = {
    id: docRef.id,
    user_id: userId,
    type: type || 'info',
    title: title || '',
    message: message || '',
    read: false,
    lu: false,
    created_at: new Date().toISOString(),
    ...extra
  };
  if (relatedId) {
    payload.related_id = relatedId;
    payload.relation_id = relatedId;
  }
  if (senderId) {
    payload.sender_id = senderId;
    payload['metadata'] = { sender_id: senderId, related_id: relatedId || null };
  }
  await docRef.set(payload);
  return docRef.id;
}

/** Nom lisible d'un profil (companyName ou name), pour les notifications. */
function displayName(profileData) {
  if (!profileData) return 'Un partenaire';
  const full = String(profileData.companyName || profileData.name || '').trim() ||
    [profileData.prenom, profileData.nom].filter(Boolean).join(' ').trim();
  return full || 'Un partenaire';
}

/**
 * Lit une relation (early return null si absente) avec compatibilité
 * des deux schémas : { grossiste_id, client_id, statut, created_at }
 * et l'ancien { demandeurId, destinataireId, participants }.
 */
async function getRelation(relationId) {
  if (!relationId) return null;
  const snap = await db.collection('relations').doc(relationId).get();
  return snap.exists ? snap.data() : null;
}

/**
 * Normalise une relation depuis/vers Firestore :
 *   - statut : 'en_attente' | 'actif' | 'refuse'
 *   - grossiste_id / client_id toujours renseignés si possible.
 */
function normalizeRelation(rel) {
  if (!rel) return null;
  const grossisteId = rel.grossiste_id || rel.senderId || rel.demandeurId || rel.sender_id || '';
  const clientId = rel.client_id || rel.receiverId || rel.destinataireId || rel.receiver_id || '';
  const rawStatut = String(rel.statut || rel.status || 'en_attente').toLowerCase();
  let statut = 'en_attente';
  if (rawStatut === 'actif' || rawStatut === 'active' || rawStatut === 'ACTIF'.toLowerCase()) statut = 'actif';
  else if (rawStatut === 'refuse' || rawStatut === 'refusee' || rawStatut === 'bloque' || rawStatut === 'blocked') statut = 'refuse';
  return { ...rel, grossiste_id: grossisteId, client_id: clientId, statut };
}

export {
  db,
  admin,
  serverTimestamp,
  increment,
  ADMIN_EMAILS,
  normalizeRole,
  isBonkoungou,
  computeRole,
  getProfile,
  isAdminUid,
  getUserRole,
  createNotification,
  displayName,
  getRelation,
  normalizeRelation
};
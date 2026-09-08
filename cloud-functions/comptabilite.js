/**
 * Comptabilité — Cloud Functions (SDK v2).
 *
 * Agrège les ventes (collection 'ventes', champs snake_case) dans des
 * résumés mensuels par utilisateur : CA + créances (vendeur) et dépenses
 * d'achats (acheteur). Structure : comptabilite/{uid}/resumeMensuel/{yyyy-mm}.
 */
const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');

const { db, admin, serverTimestamp } = require('./common');

function getYearMonth(dateOrIso) {
  const d = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Statuts de vente à exclure de la comptabilité (annulés / rejetés). */
function isAnnulee(vente) {
  const statut = String(vente.statut || vente.status || '').toUpperCase();
  return statut === 'ANNULEE' || statut === 'CANCELLED' || statut === 'REJETEE' || statut === 'REJECTED';
}

/** Détection des paiements à crédit (mode de paiement différé). */
function isCredit(vente) {
  const mode = String(vente.mode_paiement || vente.modePaiement || vente.paymentMethod || '').toUpperCase();
  const statut = String(vente.statut || vente.status || '').toUpperCase();
  return mode.includes('CREDIT') || mode.includes('DEFERRED') || mode.includes('DIFFERE') ||
    statut === 'CREDIT' || vente.paymentStatus === 'DEFERRED';
}

/**
 * Trigger ventes/{venteId} (création / mise à jour).
 * Met à jour le résumé mensuel du vendeur (CA, créances) et de l'acheteur
 * (dépenses d'achats) via des incréments idempotents par écriture.
 */
exports.onVenteWritten = onDocumentWritten('ventes/{venteId}', async (event) => {
  const newData = event.data.after ? event.data.after.data() : null;
  if (!newData) return null; // Vente supprimée

  const vendeurId = newData.vendeur_id || newData.vendeurId;
  const acheteurId = newData.acheteur_id || newData.acheteurId;
  const total = Number(newData.total || newData.totalAmount || 0);

  if (isAnnulee(newData)) return null;
  if (total <= 0) return null;

  const ym = getYearMonth(newData.created_at || newData.createdAt || new Date().toISOString());
  const batch = db.batch();

  if (vendeurId) {
    batch.set(db.collection('comptabilite').doc(vendeurId).collection('resumeMensuel').doc(ym), {
      ca: admin.firestore.FieldValue.increment(total),
      creances: admin.firestore.FieldValue.increment(isCredit(newData) ? total : 0),
      updated_at: serverTimestamp()
    }, { merge: true });
  }

  if (acheteurId && acheteurId !== 'CLIENT_ANONYME' && acheteurId !== 'CLIENT_ANONYME') {
    batch.set(db.collection('comptabilite').doc(acheteurId).collection('resumeMensuel').doc(ym), {
      depenses_achats: admin.firestore.FieldValue.increment(total),
      updated_at: serverTimestamp()
    }, { merge: true });
  }

  await batch.commit();
  return null;
});

/**
 * Trigger comptabilite/{uid}/depenses/{depenseId}.
 * Incrémente les dépenses manuelles du résumé mensuel de l'utilisateur.
 */
exports.onDepenseCreated = onDocumentCreated('comptabilite/{uid}/depenses/{depenseId}', async (event) => {
  const uid = event.params.uid;
  const data = event.data.data();
  const montant = Number(data.montant || data.amount || 0);
  if (montant <= 0) return null;

  const ym = getYearMonth(data.date || data.created_at || new Date().toISOString());
  await db.collection('comptabilite').doc(uid).collection('resumeMensuel').doc(ym).set({
    depenses_manuelles: admin.firestore.FieldValue.increment(montant),
    updated_at: serverTimestamp()
  }, { merge: true });
  return null;
});
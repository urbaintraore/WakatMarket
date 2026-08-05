const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Helper to get YYYY-MM from date
function getYearMonth(dateObj) {
  const d = dateObj ? new Date(dateObj) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Cloud Function : onVenteWritten
 * Déclenchée sur création ou modification d'une vente dans /ventes/{venteId}
 * Met à jour le résumé mensuel pour le vendeur (CA et Créances) et l'acheteur (Dépenses d'achats).
 */
exports.onVenteWritten = functions.firestore
  .document('ventes/{venteId}')
  .onWrite(async (change, context) => {
    const newData = change.after.exists ? change.after.data() : null;
    const oldData = change.before.exists ? change.before.data() : null;

    if (!newData) return null; // Vente supprimée

    const statut = newData.statut || 'VALIDE';
    if (statut === 'annulee' || statut === 'CANCELLED') return null;

    const vendeurId = newData.vendeurId;
    const acheteurId = newData.acheteurId;
    const total = Number(newData.total || newData.totalAmount || 0);
    const isCredit = statut === 'credit' || newData.paymentStatus === 'DEFERRED';
    const dateVente = newData.dateVente ? newData.dateVente.toDate() : new Date();
    const ym = getYearMonth(dateVente);

    const batch = db.batch();

    // 1. Mise à jour du résumé Vendeur (CA + Créances si crédit)
    if (vendeurId) {
      const vendeurResumeRef = db.collection('comptabilite').doc(vendeurId).collection('resumeMensuel').doc(ym);
      batch.set(vendeurResumeRef, {
        ca: admin.firestore.FieldValue.increment(total),
        creances: admin.firestore.FieldValue.increment(isCredit ? total : 0),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // 2. Mise à jour du résumé Acheteur (Dépenses d'achats)
    if (acheteurId && acheteurId !== 'CLIENT_ANONYME') {
      const acheteurResumeRef = db.collection('comptabilite').doc(acheteurId).collection('resumeMensuel').doc(ym);
      batch.set(acheteurResumeRef, {
        depensesAchats: admin.firestore.FieldValue.increment(total),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    await batch.commit();
    return null;
  });

/**
 * Cloud Function : onDepenseCreated
 * Déclenchée sur création d'une dépense manuelle dans /comptabilite/{uid}/depenses/{depenseId}
 * Met à jour le résumé mensuel de l'utilisateur (Dépenses manuelles).
 */
exports.onDepenseCreated = functions.firestore
  .document('comptabilite/{uid}/depenses/{depenseId}')
  .onCreate(async (snap, context) => {
    const uid = context.params.uid;
    const data = snap.data();
    const montant = Number(data.montant || 0);
    const dateDepense = data.date ? new Date(data.date) : new Date();
    const ym = getYearMonth(dateDepense);

    const resumeRef = db.collection('comptabilite').doc(uid).collection('resumeMensuel').doc(ym);
    await resumeRef.set({
      depensesManuelles: admin.firestore.FieldValue.increment(montant),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return null;
  });

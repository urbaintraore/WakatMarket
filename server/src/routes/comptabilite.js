/**
 * Comptabilité — POST /api/comptabilite/...
 * Port des triggers onVenteWritten / onDepenseCreated avec une idempotence par
 * marqueur (compta_processed_at) pour fonctionner à la demande depuis le client,
 * plus un endpoint /recompute (admin) pour reconstruire les résumés mensuels.
 *
 * Structure : comptabilite/{uid}/resumeMensuel/{yyyy-mm}
 *   { ca, creances, depenses_achats, depenses_manuelles, updated_at }
 */
import { Router } from 'express';
import { db, increment, serverTimestamp } from '../common.js';

const router = Router();

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
 * POST /api/comptabilite/ventes/:venteId/process
 * Incrémente le résumé mensuel vendeur (CA, créances) + acheteur (dépenses).
 * Idempotent : ne s'exécute qu'une fois par vente (marqueur compta_processed_at).
 */
router.post('/ventes/:venteId/process', async (req, res) => {
  try {
    const venteId = req.params.venteId;
    const ref = db.collection('ventes').doc(venteId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Vente introuvable.' });

    const newData = snap.data();
    if (newData.compta_processed_at) {
      return res.json({ success: true, skipped: true, message: 'Vente déjà intégrée en comptabilité.' });
    }

    const vendeurId = newData.vendeur_id || newData.vendeurId;
    const acheteurId = newData.acheteur_id || newData.acheteurId;
    const total = Number(newData.total || newData.totalAmount || 0);

    if (isAnnulee(newData) || total <= 0) {
      await ref.update({ compta_processed_at: serverTimestamp(), compta_rejected: true });
      return res.json({ success: true, skipped: true, message: 'Vente annulée ou sans montant (ignorée).' });
    }

    const ym = getYearMonth(newData.created_at || newData.createdAt || new Date().toISOString());
    const batch = db.batch();

    if (vendeurId) {
      batch.set(db.collection('comptabilite').doc(vendeurId).collection('resumeMensuel').doc(ym), {
        ca: increment(total),
        creances: increment(isCredit(newData) ? total : 0),
        updated_at: serverTimestamp()
      }, { merge: true });
    }

    if (acheteurId && acheteurId !== 'CLIENT_ANONYME') {
      batch.set(db.collection('comptabilite').doc(acheteurId).collection('resumeMensuel').doc(ym), {
        depenses_achats: increment(total),
        updated_at: serverTimestamp()
      }, { merge: true });
    }

    batch.update(ref, { compta_processed_at: serverTimestamp() });
    await batch.commit();

    res.json({ success: true, message: `Vente ${venteId} intégrée (${ym}).` });
  } catch (error) {
    console.error('[comptabilite] Erreur process vente:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/comptabilite/depenses/:depenseId/process
 * Incrémente les dépenses manuelles du résumé mensuel. Idempotent via marqueur.
 */
router.post('/depenses/:depenseId/process', async (req, res) => {
  try {
    const depenseId = req.params.depenseId;
    const uid = req.uid;

    const ref = db.collection('comptabilite').doc(uid).collection('depenses').doc(depenseId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Dépense introuvable.' });

    const data = snap.data();
    if (data.compta_processed_at) {
      return res.json({ success: true, skipped: true, message: 'Dépense déjà intégrée.' });
    }

    const montant = Number(data.montant || data.amount || 0);
    if (montant <= 0) return res.status(400).json({ error: 'Montant de dépense invalide.' });

    const ym = getYearMonth(data.date || data.created_at || new Date().toISOString());

    await db.collection('comptabilite').doc(uid).collection('resumeMensuel').doc(ym).set({
      depenses_manuelles: increment(montant),
      updated_at: serverTimestamp()
    }, { merge: true });

    await ref.update({ compta_processed_at: serverTimestamp() });

    res.json({ success: true, message: `Dépense ${depenseId} intégrée (${ym}).` });
  } catch (error) {
    console.error('[comptabilite] Erreur process dépense:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/comptabilite/recompute  — admin.
 * Reconstruit les résumés mensuels d'un utilisateur à partir des ventes
 * (vendeur + acheteur) et des dépenses. body : { uid, yearMonth? }.
 * Sert à rattraper les données écrites avant la mise en place de l'API.
 */
router.post('/recompute', async (req, res) => {
  try {
    const uid = (req.body && req.body.uid) || '';
    const yearMonth = (req.body && req.body.yearMonth) || null;
    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'uid requis.' });
    }

    const resumeCol = db.collection('comptabilite').doc(uid).collection('resumeMensuel');
    const accum = {};

    const addTo = (ym, key, amount) => {
      if (!ym) return;
      if (!accum[ym]) accum[ym] = { ca: 0, creances: 0, depenses_achats: 0, depenses_manuelles: 0 };
      accum[ym][key] = (accum[ym][key] || 0) + amount;
    };

    const vendeurSnap = await db.collection('ventes').where('vendeur_id', '==', uid).get();
    const acheteurSnap = await db.collection('ventes').where('acheteur_id', '==', uid).get();

    const seen = new Set();
    for (const snap of [vendeurSnap, acheteurSnap]) {
      for (const doc of snap.docs) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);

        const v = doc.data();
        const total = Number(v.total || v.totalAmount || 0);
        if (isAnnulee(v) || total <= 0) continue;

        const ym = getYearMonth(v.created_at || v.createdAt || '');
        if (yearMonth && ym !== yearMonth) continue;

        if (v.vendeur_id === uid) {
          addTo(ym, 'ca', total);
          addTo(ym, 'creances', isCredit(v) ? total : 0);
        }
        if (v.acheteur_id === uid) {
          addTo(ym, 'depenses_achats', total);
        }
      }
    }

    const depensesSnap = await db.collection('comptabilite').doc(uid).collection('depenses').get();
    for (const doc of depensesSnap.docs) {
      const d = doc.data();
      const montant = Number(d.montant || d.amount || 0);
      if (montant <= 0) continue;
      const ym = getYearMonth(d.date || d.created_at || '');
      if (yearMonth && ym !== yearMonth) continue;
      addTo(ym, 'depenses_manuelles', montant);
    }

    const batch = db.batch();
    const monthes = Object.keys(accum);
    for (const ym of monthes) {
      batch.set(resumeCol.doc(ym), { ...accum[ym], updated_at: serverTimestamp() });
    }
    await batch.commit();

    res.json({ success: true, months: monthes, message: `Résumés recomputés pour ${uid} (${monthes.length} mois).` });
  } catch (error) {
    console.error('[comptabilite] Erreur recompute:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
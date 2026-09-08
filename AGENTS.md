# AGENTS.md

WakatMarket: React 19 + Vite 6 + TypeScript + Tailwind v4 SPA — an offline-first ERP/marketplace (French UI) for African B2B distribution/supply chains. Firebase (Auth + Firestore, realtime via `onSnapshot`) is the backend; files go to Cloudflare R2 through a Worker; the app also runs fully offline via a local store + sync queue.

## Commands

- `npm run dev` — Vite dev server on port 3000 (`--host=0.0.0.0`)
- `npm run lint` — **typecheck only** (`tsc --noEmit`); there is no ESLint. It must pass clean.
- `npm run build` — production build. No test framework exists; verify with `lint` + `build`.
- `npm run clean` — removes `dist/` and `server.js` (generated artifact).
- Both `bun.lock` and `package-lock.json` are committed; npm is the expected runner.

## Architecture (data flow — read before editing)

- `src/data.ts` exports `db` (localStorage cache) and `USE_DEMO_DATA = false`. `filterMockData` drops records whose IDs match `MOCK_ID_REGEX` so demo data never surfaces. `DEFAULT_PRODUCTS` no longer exists — products come from Firestore (`INITIAL_PRODUCTS: Product[] = []`).
- Mutations go through `src/services/syncService.ts`: queued in IndexedDB (`offlineStorage.ts`, DB `wakat_erp_offline_db`, localStorage fallback) then pushed to Firebase via `firestoreUpsert` (in `src/firebase.ts`), which requires an `id` on every doc. `src/services/dbMappers.ts` maps local entities ↔ Firestore documents (snake_case). **Do not write to Firestore directly from components** — route writes through the sync/offline layer so offline mode keeps working.
- Firestore uses **flat collections, document id = entity id / uid**, realtime via `onSnapshot` in the service hooks. Collections: `profiles`, `products`, `inventory`, `orders`, `ventes`, `relations`, `notifications`, `conversations`, `messages`, plus `factures` and `comptabilite/{uid}/resumeMensuel|depenses` created server-side.
  - `profiles` doc: `{ id, email, nom, prenom, telephone, address, ville, pays, role, avatar, limite_credit }`.
  - `orders`: `items` is a JSON **string** (`[{productId, quantity, priceAtOrder}]`), statuts en majuscules (`PENDING/CONFIRMED/CANCELLED/DELIVERED`), `statutPaiement` ∈ `en_attente_preuve | preuve_soumise | valide | rejete`, `preuvePaiementUrl`. La preuve de paiement passe bien par la collection `orders` (paymentProofService).
  - `notifications` (plates): `{ id, user_id, type, title, message, read, lu, created_at (ISO, triable lexicographiquement), related_id/relation_id, sender_id }`.
  - `relations`: `{ id (uid1_uid2 triés), grossiste_id, client_id, statut ('en_attente'|'actif'|'refuse'), created_at }`.
  - `inventory`: champs camelCase `vitesseVenteJournaliere`, `joursRestants`, `seuilAlerte` (lus par `CommonDashboardParts`) — à conserver dans les Cloud Functions.
- `src/firebase.ts` ships with hardcoded default config so the app works in dev with no env vars. Env vars override: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`. Unauthorized reads write Firestore locally + fire a `wakat_firestore_permission_error` event; no valid config → `firebaseConfigError` + banner, offline still works.
- Uploads go to **Cloudflare R2**: `src/cloudflare.ts` (`uploadToCloudflare(folder, filePath, file, contentType?)` **returns a string** — the public URL). Contract with the Worker: `POST {workerUrl}/sign` `{path, contentType, size}` → `{uploadUrl, publicUrl}`; the client PUTs directly to `uploadUrl`; fallback public URL is `{workerUrl}/file/{path}`.
- **Backend** (repo root): `cloud-functions/` (Firebase Functions SDK v2, node 20 — **référence, déploiement bloqué sur plan Spark**), `firestore.rules`, `storage.rules`, `firebase.json`, `firestore.indexes.json`, `workers/r2-uploads/` (Cloudflare Worker + `wrangler.toml`). La logique métier : partenaires (demandes de connexion atomiques + notifications), vérification de commandes (conflits de stock → alertes `server_confirmed`), vente callable, comptabilité mensuelle (CA/créances/dépenses, idempotente via `compta_processed_at`), rôles/claims + suppression de compte admin, paiements (validation/rejet/preuve), réapprovisionnement planifié (vitesse de vente 14 j, alertes stock).
- **L'API Render** vit dans un **repo GitHub dédié** : `github.com/mareaugustin/wakatmarket-api` (`/opt/wakatmarket-api`, pas dans WakatMarket). Elle porte les callables/triggers en REST ; le client l'appelle en **fire-and-forget** après chaque upsert Firestore réussi (hooks `syncService.notifyBackend` → `src/services/apiService.ts`, Bearer JWT via `authService.getToken()`). Endpoints idempotents (flags `server_confirmed`, `server_preuve_notifie`, `connexion_notifs`, `compta_processed_at`). Config : `.env` `VITE_BACKEND_URL` ; variables Render `FIREBASE_SERVICE_ACCOUNT` (JSON) + `CRON_SECRET` ; cron stock via `GET/POST /api/cron/stock-alerts` (header `x-cron-secret`, Render cron payant sinon cron-job.org).
- Firebase Auth: le client guette les users (`onAuthStateChanged`, clé `wakat_active_user_id`). Les Cloud Functions posent des **custom claims** (`admin`, `role`) sur les profils administrateurs ; le client se fie aussi au profil.
- **Les règles Firestore/les pare-feu** ne sont pas uniformisées avec le client : les écritures administratives passent par le SDK Admin (qui bypass les règles). Tout changement de schéma doit mettre à jour `firestore.rules`, `storage.rules`, `firestore.indexes.json` **et** les Cloud Functions.

## Gotchas

- UI strings, comments, and error messages are **French**; keep new UI text in French.
- Path alias `@/*` maps to the repo root (vite + tsconfig).
- The repo recently migrated Supabase → Firebase. Legacy records under localStorage keys `wakat_fb_users_v2_*` are still read and migrated in `db.getUsers()` and `userService` — don't remove that path.
- Roles live in `src/types.ts` (`UserRole` enum). Always parse untrusted/legacy role strings through `normalizeUserRole`. Root admins come from the explicit allowlist `ROOT_ADMIN_EMAILS` (miroir serveur `ADMIN_EMAILS` dans `cloud-functions/common.js` **et** `server/src/common.js` du repo `mareaugustin/wakatmarket-api` ; actuellement `urbain.traore@yahoo.fr`, `urbain.traoreurb@gmail.com`, `maremillogo10@gmail.com`) — **aucun e-mail contenant « admin » n'est auto-promu** ; `isBonkoungou()` forces `SEMI_WHOLESALER`. Update both lists together when adding a root admin.
- Money is CFA (see `formatCFA`). No floating-point rounding assumptions.
- PWA uses plain `public/sw.js` + `public/manifest.json` registered in `src/main.tsx` — no vite-plugin-pwa, no offline build manifest to regenerate.
- The Gemini capability is declared in `metadata.json`/`package.json` (`@google/genai`) with `GEMINI_API_KEY` injected at runtime (server-side), but **no client code calls it** — `AICopilot` uses the heuristic `triggerAIAnalysis()` in `src/data.ts`.
- Work on branch `dev-millogo`; `main` tracks releases.
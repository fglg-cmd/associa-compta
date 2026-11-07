# AssociaCompta — mémo pour Claude

Logiciel en ligne de comptabilité pour associations françaises (trésoriers bénévoles).
**Toujours répondre en français**, simplement : le fondateur n'est pas développeur.

## Où est quoi

| Service | Référence |
|---|---|
| Site en production | https://associa-compta.vercel.app (`/api/health` donne la version déployée) |
| GitHub | `fglg-cmd/associa-compta`, branche `main` = production |
| Vercel | projet `prj_uRNPiLgF9q4171mlLM9OXPgAGR6v`, équipe `team_qyxg78SOqvTzMqYTmbtlewYi`, racine `apps/web`, région `dub1` |
| Supabase | projet `fglg-associa-compta`, réf. `bnakednfoksziuwxzhxx` (UE, Irlande) — via le connecteur Supabase |

- Appels à l'API Vercel : en-tête `Authorization: Bearer proxy-injected` (le jeton est injecté
  par l'environnement « associa-compta », jamais visible ni à demander dans le chat).
- Chaque envoi sur `main` déclenche un déploiement Vercel. Si le webhook GitHub le rate :
  `POST https://api.vercel.com/v13/deployments?teamId=…` avec
  `{"name":"associa-compta","project":"<id>","target":"production","gitSource":{"type":"github","repoId":1446264086,"ref":"main"}}`.
- Vérifier une mise en ligne : attendre que `/api/health` renvoie le hash du dernier commit.

## Règles

- Ne jamais demander, afficher ni enregistrer de secret dans le chat ou le dépôt.
- Le fondateur ne veut pas de dépenses : IA coupée (`AI_ENABLED=off`), pas de Google Vision,
  pas de nom de domaine pour l'instant.
- Phase de lancement gratuite : `BETA_FREE=on` dans Vercel (tout gratuit, paiement bloqué).
  Passage au payant : voir `docs/05-LANCEMENT.md`.
- Migrations SQL dans `supabase/migrations/` puis appliquées via le connecteur Supabase.
- Comptes de test en production : `e2e.*@associa-test.fr`, à supprimer après usage
  (associations via Paramètres > Supprimer, puis les utilisateurs).

## Code

- Monorepo pnpm : `apps/web` (Next.js 15), `packages/accounting` (moteur comptable),
  `packages/bank-import` (relevés CSV/OFX/QIF, catégories).
- Montants en centimes (`bigint`), partie double garantie par la base, écritures validées
  immuables (correction par contre-passation), RLS sur toutes les tables.
- Justificatifs : lecture (`src/lib/ocr.ts`, Tesseract + `ocr-data/`), extraction
  (`src/lib/ocr-extract.ts`), création automatique de la dépense/recette
  (`src/modules/documents/actions.ts`, `autoCreateOperation`).

## Avant chaque envoi

```bash
pnpm -r test
```

```bash
cd apps/web && npx tsc --noEmit -p . && npx next lint
```

Documentation complète : `docs/` (01 vision, 02 architecture, 03 exploitation, 04 état,
05 lancement, 06 audit).

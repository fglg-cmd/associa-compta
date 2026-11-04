# ASSOCIA COMPTA

**La gestion financière des associations, simple, juste et conforme.**

ASSOCIA COMPTA est un SaaS pour les associations françaises. Il couvre la banque (import
CSV, OFX ou QIF), la comptabilité en partie double conforme au règlement ANC 2018-06, les
justificatifs avec OCR, les adhérents et cotisations, les projets et événements, et les
rapports d'AG (PDF, Excel, CSV et FEC). Il inclut aussi un assistant financier IA et un
back-office SaaS.

| Document | Contenu |
|---|---|
| [`docs/01-AUDIT-ET-VISION.md`](docs/01-AUDIT-ET-VISION.md) | Audit, vision produit, architecture, base de données, UX, roadmap |
| [`docs/02-ARCHITECTURE.md`](docs/02-ARCHITECTURE.md) | Organisation du code, conventions, flux de données, sécurité |
| [`docs/03-EXPLOITATION.md`](docs/03-EXPLOITATION.md) | Installation, configuration, déploiement, check-list de lancement |
| [`docs/04-ETAT.md`](docs/04-ETAT.md) | État exact : ce qui est livré, testé, à vérifier, à venir |

## Démarrage rapide (développement)

Prérequis : Node 22, pnpm 10, Docker (pour Supabase local).

```bash
pnpm install
```

```bash
npx supabase start
```

```bash
cp apps/web/.env.example apps/web/.env.local
```

Reportez ensuite dans `apps/web/.env.local` l'URL, la clé `anon` et la clé `service_role`
affichées par `supabase start`, puis lancez :

```bash
pnpm dev
```

L'application est servie sur http://localhost:3000. Les intégrations sans clé (Stripe,
Resend, IA, OCR Google Vision) sont désactivées proprement, et l'interface l'indique.

## Tests

```bash
pnpm -r test
```

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres pnpm test:db
```

```bash
pnpm --filter @associa/web e2e
```

- `pnpm -r test` : moteur comptable, parseurs bancaires, extraction OCR (Vitest).
- `pnpm test:db` : migrations, intégrité comptable et isolation multi-tenant, sur un PostgreSQL jetable.
- `pnpm --filter @associa/web e2e` : parcours complet dans le navigateur (Playwright), contre Supabase local.

## Monorepo

```
apps/web               Next.js 15 : interface, API, server actions
packages/accounting    moteur comptable pur (plan associatif, états financiers, anomalies, prévisionnel)
packages/bank-import   parseurs CSV, OFX et QIF, empreintes anti-doublon, règles de catégorisation
supabase/migrations    schéma PostgreSQL, RLS, fonctions comptables, stockage
supabase/tests         tests SQL d'intégrité et d'isolation
```

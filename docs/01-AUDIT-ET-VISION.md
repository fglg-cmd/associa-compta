# ASSOCIA COMPTA 2.0 — Audit initial, vision et plan de reconstruction

> Document fondateur rédigé par le CTO avant toute ligne de code.
> Statut : validé — sert de référence pour toutes les décisions d'architecture.

---

## 1. Analyse du projet existant

### 1.1 Ce qui a été fourni

Le prototype (HTML / CSS / JavaScript « vanilla ») n'a pas été transmis dans
l'environnement de reconstruction : aucun fichier, aucun dépôt. Conformément au
mandat (« le code actuel ne doit pas être réutilisé »), l'audit porte donc sur ce
que le prototype a **validé** — le besoin métier, décrit dans le cahier des
charges — et sur les caractéristiques structurelles inhérentes à ce type de
prototype (application statique HTML/CSS/JS sans backend).

### 1.2 Forces (ce que le prototype a prouvé)

| Force | Ce que l'on garde |
|---|---|
| Le besoin est réel : les trésoriers bénévoles gèrent encore sur Excel / Google Sheets | Le positionnement « zéro compétence comptable » |
| Le périmètre fonctionnel est juste : banque, justificatifs, adhérents, projets, rapports AG | Les 9 modules métier, renommés et réorganisés |
| Les flux utilisateurs sont identifiés : saisir → justifier → rapprocher → présenter à l'AG | Ce flux devient la colonne vertébrale de l'UX |
| Le marché est clair : 1,5 million d'associations actives en France, dont environ 90 % sans salarié | Une tarification freemium adaptée aux petites structures |

### 1.3 Faiblesses structurelles (pourquoi on repart de zéro)

| # | Faiblesse | Conséquence | Réponse 2.0 |
|---|---|---|---|
| F1 | Pas de vrai backend : données dans le navigateur ou dans des fichiers | Perte de données, aucun multi-utilisateur | PostgreSQL (Supabase) et RLS |
| F2 | Pas de moteur comptable (simple liste de recettes et dépenses) | Ni bilan ni balance exacts, non conforme au règlement ANC 2018-06 | Moteur en partie double, avec l'équilibre débit = crédit garanti par la base |
| F3 | Montants en `float` JavaScript | Erreurs d'arrondi (0,1 + 0,2) | Tous les montants en **centimes entiers** (`bigint`) |
| F4 | Pas d'isolation entre associations | Impossible à vendre en SaaS | Multi-tenant strict : `organization_id` partout et politiques RLS |
| F5 | Pas d'authentification sérieuse | Risque RGPD | Supabase Auth (Google, Microsoft, e-mail) et rôles |
| F6 | Pas de piste d'audit | Le trésorier ne peut rien prouver au commissaire aux comptes | Écritures validées immuables, contre-passation, journal d'audit |
| F7 | CSS et JS monolithiques | Impossible à maintenir à plusieurs | Monorepo TypeScript modulaire, design system |
| F8 | Aucun test | Régressions | Vitest sur le moteur comptable et les parseurs bancaires, tests SQL |

---

## 2. Vision produit

**« Le Stripe de la comptabilité associative. »**

Le trésorier ne fait pas de comptabilité : il **vit la vie de son association**
(il encaisse une cotisation, paie une facture, organise une kermesse) et
ASSOCIA COMPTA **produit la comptabilité en arrière-plan**, en partie double et
conforme au plan comptable associatif.

### Principes
1. **Langage humain d'abord, comptable ensuite.** L'interface parle de
   « Recette », « Dépense », « Cotisation ». Les comptes PCG (706, 756, 512…)
   restent disponibles en mode expert.
2. **Chaque mouvement bancaire devient une écriture.** Import CSV, OFX ou QIF,
   catégorisation automatique par règles apprises, rapprochement en un clic.
3. **Un justificatif pour chaque euro.** Glisser-déposer, OCR, association
   automatique au mouvement par montant et date.
4. **L'AG en un clic.** Compte de résultat, bilan, rapport financier rédigé par
   l'IA, export PDF, Excel ou CSV.
5. **La confiance par la conception.** Exercices clôturés verrouillés, écritures
   validées immuables, journal d'audit complet.

### Positionnement concurrentiel

| | Excel/Sheets | Basicompta | AssoConnect | **ASSOCIA COMPTA** |
|---|---|---|---|---|
| Partie double automatique | ✗ | ✓ (expert) | ✓ | ✓ (invisible) |
| Import OFX/QIF/CSV + règles | ✗ | partiel | partiel | ✓ |
| OCR justificatifs | ✗ | ✗ | partiel | ✓ |
| Assistant IA financier | ✗ | ✗ | ✗ | ✓ |
| Budget par projet/événement | manuel | ✗ | partiel | ✓ |
| UX moderne (⌘K, raccourcis) | ✗ | ✗ | moyen | ✓ |
| Prix petite asso | gratuit | ~10 €/mois | 30 €+/mois | **gratuit → 19 €/mois** |

### Modèle économique
| Plan | Prix | Cible | Limites |
|---|---|---|---|
| Découverte | 0 € | moins de 50 adhérents | 1 compte bancaire, 100 documents, 10 questions IA par mois |
| Essentiel | 9 €/mois HT | association de quartier, club | 3 comptes, 2 000 documents, 50 questions IA |
| Pro | 19 €/mois HT | fédérations, associations employeuses | illimité, multi-utilisateurs avancé, export FEC |

---

## 3. Architecture

### 3.1 Décisions clés (avec alternatives écartées)

| Décision | Choix | Alternatives écartées et raisons |
|---|---|---|
| Topologie | **Monolithe modulaire** : Next.js 15 (App Router) pour l'UI et l'API, plus des packages métier purs | Microservices : prématuré pour une équipe de moins de 10, coût DevOps élevé. Backend Express séparé : double déploiement, double authentification |
| Logique métier | Packages TypeScript **purs et testés** (`@associa/accounting`, `@associa/bank-import`) | Logique dans les composants : intestable |
| Intégrité comptable | **Dans PostgreSQL** (triggers différés, fonctions `SECURITY INVOKER`) | Validation côté application seulement : contournable |
| Isolation multi-tenant | **RLS PostgreSQL** sur chaque table, `organization_id` partout | Schéma par client : migrations ×N. Une base par client : coût |
| Montants | `bigint` en centimes | `numeric` : correct mais lent et ambigu côté JS. `float` : faux |
| Monorepo | pnpm workspaces | Nx/Turborepo : surdimensionné au lancement, ajoutable ensuite |
| UI | Tailwind v4 et composants shadcn/ui (Radix), Framer Motion | MUI/Chakra : look générique, moins rapide |
| Exports | `exceljs` (XLSX), `@react-pdf/renderer` (PDF), CSV natif | Puppeteer : lourd en serverless |
| OCR | Google Vision si une clé est configurée, sinon Tesseract.js côté serveur | — |
| IA | Anthropic Claude (par défaut), OpenAI en repli, via une interface `LLMProvider` | — |

### 3.2 Arborescence

```
associa-compta/
├── apps/web/                 Next.js 15 : UI, route handlers, server actions
│   ├── src/app/(marketing)   site public et tarifs
│   ├── src/app/(auth)        connexion et inscription
│   ├── src/app/app/[org]/    application (par association)
│   ├── src/app/admin/        back-office SaaS
│   ├── src/app/api/          webhooks Stripe, IA (streaming), exports, OCR, cron
│   ├── src/modules/          un dossier par domaine : queries, actions, schémas zod
│   ├── src/components/ui     design system (shadcn)
│   └── src/lib/              clients supabase, stripe, resend, ia, observabilité
├── packages/accounting       moteur comptable pur (PCG associatif, états financiers)
├── packages/bank-import      parseurs CSV, OFX et QIF, déduplication, règles
├── supabase/migrations       schéma SQL, RLS, fonctions, stockage
├── supabase/tests            tests SQL d'isolation et d'intégrité
├── docs/                     architecture, décisions, exploitation
└── docker-compose.yml        stack locale complète
```

### 3.3 Sécurité
- RLS sur 100 % des tables métier ; la clé `service_role` n'est utilisée que
  dans les webhooks et tâches cron, jamais exposée au client.
- Rôles par association : `owner`, `admin`, `treasurer`, `member`, `viewer`
  (lecture seule, pour le commissaire aux comptes).
- Webhooks Stripe vérifiés par signature ; cron protégé par `CRON_SECRET`.
- En-têtes de sécurité (CSP, HSTS, X-Frame-Options), validation zod de toutes
  les entrées et limitation de débit sur l'IA.
- RGPD : données hébergées dans l'UE (région Supabase eu-west), export et
  suppression d'association.

---

## 4. Base de données

Schéma complet : `supabase/migrations/`. Vue d'ensemble :

```
organizations ─┬─ memberships ── auth.users / profiles
               ├─ fiscal_years
               ├─ accounts (plan comptable, PCG asso pré-chargé)
               ├─ journals (BQ, CA, VT, AC, OD, AN)
               ├─ journal_entries ── entry_lines (débit/crédit en centimes)
               ├─ bank_accounts ── bank_imports ── bank_transactions
               ├─ categorization_rules
               ├─ documents (Supabase Storage + texte OCR + recherche plein texte)
               ├─ members ── member_fees (cotisations) ── fee_reminders
               ├─ projects (projets et événements) ── project_budget_lines
               ├─ ai_conversations ── ai_messages
               ├─ subscriptions (Stripe)
               └─ audit_log
platform_admins (back-office)
```

Invariants garantis par la base :
1. Une écriture validée (`posted`) a Σ débits = Σ crédits, et au moins deux lignes.
2. Une écriture validée n'est ni modifiable ni supprimable (correction par contre-passation).
3. Aucune écriture ne peut être créée dans un exercice clôturé.
4. Chaque ligne a soit un débit soit un crédit, positif.
5. Un mouvement bancaire est unique par `(bank_account_id, fingerprint)`, ce qui rend la réimportation sans risque.

---

## 5. UX

### Navigation
Barre latérale fine (style Linear) : **Accueil · Banque · Opérations ·
Justificatifs · Adhérents · Projets · Comptabilité · Rapports · Assistant**,
plus la palette de commandes ⌘K.

### Parcours clés
1. **Onboarding en 90 secondes** : nom de l'association, date de clôture,
   compte bancaire, puis le plan comptable et les journaux sont créés automatiquement.
2. **Import bancaire** : déposer un fichier, prévisualiser, détecter les doublons,
   catégoriser automatiquement, puis valider. Chaque mouvement devient une écriture.
3. **Justificatif** : glisser un PDF, l'OCR lit le montant et la date, puis une
   correspondance est suggérée avec un mouvement bancaire.
4. **Préparer l'AG** : Rapports, Assemblée générale, puis PDF (compte de résultat,
   bilan, rapport rédigé par l'IA).

### Identité visuelle
- Neutres chauds (zinc), accent **indigo profond `#4F46E5`**, vert et rouge
  sobres pour les flux.
- Typographie Inter (UI) et chiffres tabulaires ; montants en gras.
- Thème clair et thème sombre, coins de 10 px, ombres très légères, animations
  de 150 à 250 ms.

---

## 6. Roadmap (J-30 → lancement)

| Semaine | Livrables |
|---|---|
| S1 | Schéma SQL et RLS, moteur comptable, parseurs bancaires, authentification, onboarding |
| S2 | Banque (import, règles, rapprochement), opérations, justificatifs (stockage, OCR) |
| S3 | Adhérents et cotisations, relances Resend, projets et budgets, rapports PDF/XLSX/CSV |
| S4 | Assistant IA, abonnements Stripe, back-office, observabilité, tests, durcissement, lancement |
| Après lancement | Synchronisation bancaire DSP2 (Bridge/GoCardless), export FEC, reçus fiscaux Cerfa 11580, application mobile, multi-devise |

**Le présent dépôt livre les semaines 1 à 4.** L'état exact de chaque module
(ce qui est fait, testé, ou reste à faire) est tenu à jour dans `docs/04-ETAT.md`.

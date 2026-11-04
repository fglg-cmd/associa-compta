# Architecture technique

## Principes

1. **Le métier est pur et testé.** `packages/accounting` et `packages/bank-import` n'ont
   aucune dépendance au framework : ce sont des fonctions déterministes, couvertes par Vitest.
2. **La base garantit les invariants comptables.** L'équilibre débit = crédit,
   l'immutabilité des écritures validées, le verrouillage des exercices clôturés et
   l'unicité des mouvements importés sont imposés par PostgreSQL (triggers et contraintes),
   quel que soit le client.
3. **L'isolation multi-tenant est assurée par RLS.** Chaque table métier porte un
   `organization_id` et une politique fondée sur `is_org_member()` ou `can_write_finance()`.
   Le client Supabase agit au nom de l'utilisateur : une erreur dans le code applicatif ne
   peut pas exposer les données d'une autre association.
4. **Les écritures passent par des fonctions SQL.** `create_journal_entry`,
   `book_bank_transaction`, `record_fee_payment`, etc. sont `SECURITY DEFINER` avec un
   contrôle de rôle explicite. Aucune politique ne permet d'écrire directement dans
   `journal_entries` ou `entry_lines`.
5. **Les montants sont toujours en centimes entiers** (`bigint` en SQL, `number` entier en TypeScript).

## Couches de l'application web

```
src/app/                 routes (Server Components par défaut)
  (marketing)/           site public, tarifs, pages légales
  (auth)/                connexion, inscription, mot de passe
  app/[org]/             application, une association par slug
  admin/                 back-office (is_platform_admin, vérifié dans chaque page)
  api/                   IA (streaming), exports, OCR, Stripe, cron, health
src/modules/<domaine>/   actions.ts (server actions "use server") + queries.ts (lectures)
src/components/ui/       design system (base shadcn/Radix, tokens CSS)
src/lib/                 clients (Supabase, Stripe, Resend, IA), auth, env, plans, OCR
```

### Contrat des server actions

Toutes les actions renvoient `ActionResult<T> = { ok: true, data } | { ok: false, error }`
grâce à `run()` (`src/lib/action.ts`), qui :

- valide les entrées avec zod ;
- vérifie le rôle (`requireOrgWriter`, `requireOrgAdmin`) ;
- traduit les erreurs PostgreSQL en messages français ;
- laisse passer les redirections Next.js (`unstable_rethrow`).

### Flux d'un import bancaire

1. `previewBankImport` lit le fichier sans rien écrire : format, colonnes CSV, doublons.
2. `importBankFile` parse le fichier, calcule les empreintes (FITID OFX ou hachage FNV-1a
   avec rang d'occurrence), applique les règles et mots-clés, puis insère avec
   `ON CONFLICT DO NOTHING`.
3. `bookTransactions` appelle la fonction SQL `book_bank_transactions`, qui génère une
   écriture validée par mouvement. Avec « mémoriser », une règle est apprise et les
   suggestions des mouvements encore en attente sont recalculées.
4. Le rapprochement (`bank_reconciliation`) compare le solde du relevé et le solde
   comptable du compte 512x, et détaille les écarts.

### États financiers

Les fonctions `buildIncomeStatement` et `buildBalanceSheet` partent de la balance SQL
(`trial_balance`). Le bilan combine trois éléments :

- la balance cumulée depuis l'origine (classes 1 à 5) ;
- le résultat de l'exercice (classes 6 et 7) ;
- le résultat des exercices antérieurs non encore affecté.

Le bilan reste ainsi équilibré sans écritures de clôture automatiques.

### Assistant IA

`/api/ai/chat` construit un instantané financier factuel (`modules/ai/context.ts`), qui ne
contient aucune donnée nominative d'adhérent. Le prompt système est stable et mis en cache
(`cache_control`). La réponse est diffusée en streaming depuis Claude (`claude-opus-5-5`,
effort `medium`, fallback serveur `default`). OpenAI sert de repli si seule sa clé est
configurée.

Des quotas mensuels par offre et un anti-rafale par utilisateur limitent l'usage.

## Sécurité

- En-têtes : CSP stricte, HSTS, X-Frame-Options DENY, Permissions-Policy.
- Webhook Stripe : signature vérifiée et idempotence via `stripe_events`.
- Cron : `Authorization: Bearer CRON_SECRET`.
- Plan et client Stripe : non modifiables par un utilisateur (trigger `protect_org_billing_fields`).
- Stockage : bucket privé, chemin `{organization_id}/…` contrôlé par politique, URL signées valables 10 minutes.
- Regex des règles : garde-fou anti-ReDoS.
- Piste d'audit inaltérable (`audit_log`) alimentée par triggers.

## Régénérer les types de la base

`src/lib/types.ts` est maintenu à la main. En CI, on peut le remplacer par :

```bash
npx supabase gen types typescript --local > apps/web/src/lib/database.types.ts
```

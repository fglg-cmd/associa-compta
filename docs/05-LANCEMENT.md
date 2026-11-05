# Mettre le site en ligne et commencer à vendre

Guide pas à pas pour le fondateur. Les étapes techniques déjà faites sont cochées.

## Déjà fait ✅

- [x] Code sur GitHub : `fglg-cmd/associa-compta`
- [x] Base de données Supabase `fglg-associa-compta` installée (10 migrations)
- [x] Tests réels sur la base : comptabilité, banque, cotisations, isolation entre associations, sécurité

---

## Étape 1 — Mettre le site en ligne avec Vercel (20 min, gratuit)

1. Allez sur **vercel.com**, puis « Sign up » avec votre compte GitHub.
2. Cliquez sur **Add New… → Project** et importez `fglg-cmd/associa-compta`.
3. Dans **Root Directory**, choisissez `apps/web`. Vercel détecte Next.js tout seul.
4. Ouvrez **Environment Variables** et ajoutez :

| Nom | Valeur |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bnakednfoksziuwxzhxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_DW8A8-Lwv3u6Q51lohz-KQ_KBkz2UoM` |
| `SUPABASE_SERVICE_ROLE_KEY` | à copier dans Supabase : **Project Settings → API Keys → Secret keys**. Cette clé est **secrète** : elle ne va que dans Vercel, jamais ailleurs. |
| `NEXT_PUBLIC_APP_URL` | l'adresse du site, par exemple `https://associa-compta.vercel.app` (puis votre domaine) |
| `CRON_SECRET` | une longue phrase aléatoire de votre choix |

5. Cliquez sur **Deploy**. En 2 à 3 minutes, le site est en ligne sur `https://xxx.vercel.app`.

## Étape 2 — Brancher la connexion des utilisateurs (10 min)

Dans Supabase, ouvrez **Authentication → URL Configuration** :

- **Site URL** : votre adresse Vercel (ou votre domaine).
- **Redirect URLs** : ajoutez `https://VOTRE-ADRESSE/auth/callback`.

Avec cela, l'inscription par e-mail fonctionne. Google et Microsoft sont facultatifs au
début ; vous pourrez les ajouter plus tard (voir `03-EXPLOITATION.md`).

Ensuite, **créez votre compte** sur le site, puis devenez administrateur de la plateforme.
Dans Supabase, ouvrez **SQL Editor** et exécutez la commande suivante, en remplaçant
l'adresse par la vôtre :

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'votre@email.fr';
```

Le back-office est ensuite accessible sur `/admin`.

## Étape 3 — Encaisser de l'argent avec Stripe (1 h)

1. Créez un compte sur **stripe.com** et activez-le (IBAN, pièce d'identité, SIREN).
2. Ouvrez **Catalogue de produits** et créez deux produits :
   - **Essentiel**, avec un prix de 9 € par mois et un prix de 90 € par an ;
   - **Pro**, avec un prix de 19 € par mois et un prix de 190 € par an.
3. Copiez les 4 identifiants `price_…` dans Vercel :
   - `STRIPE_PRICE_ESSENTIAL_MONTHLY`
   - `STRIPE_PRICE_ESSENTIAL_YEARLY`
   - `STRIPE_PRICE_PRO_MONTHLY`
   - `STRIPE_PRICE_PRO_YEARLY`
4. Ouvrez **Développeurs → Clés API** et copiez la clé secrète dans `STRIPE_SECRET_KEY`.
5. Ouvrez **Développeurs → Webhooks** et ajoutez un endpoint :
   - adresse : `https://VOTRE-ADRESSE/api/stripe/webhook` ;
   - événements :
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - copiez ensuite le secret du webhook dans `STRIPE_WEBHOOK_SECRET`.
6. Ouvrez **Paramètres → Portail client** et activez-le.
7. Dans Vercel, ouvrez **Deployments**, puis **Redeploy**.

## Étape 4 — E-mails et assistant IA (30 min)

- **Resend** (resend.com) : ajoutez votre domaine, puis mettez la clé dans `RESEND_API_KEY` et `EMAIL_FROM="ASSOCIA COMPTA <bonjour@votre-domaine.fr>"`.
- **Anthropic** (console.anthropic.com) : créez une clé API et mettez-la dans `ANTHROPIC_API_KEY`.
- Redéployez.

## Étape 5 — Les obligations légales (avant le premier client payant)

- [ ] Société créée, avec un SIREN.
- [ ] Dans Vercel, renseignez :
  - `NEXT_PUBLIC_LEGAL_COMPANY`
  - `NEXT_PUBLIC_LEGAL_FORM`
  - `NEXT_PUBLIC_LEGAL_CAPITAL`
  - `NEXT_PUBLIC_LEGAL_SIREN`
  - `NEXT_PUBLIC_LEGAL_ADDRESS`
  - `NEXT_PUBLIC_LEGAL_DIRECTOR`
  - `NEXT_PUBLIC_LEGAL_EMAIL`
- [ ] CGV relues par un juriste.
- [ ] Nom de domaine acheté et relié à Vercel (**Settings → Domains**).

---

## Vendre : le plan des 30 premiers jours

**Votre cible :** les trésoriers bénévoles des petites et moyennes associations (clubs
sportifs, associations de parents d'élèves, comités des fêtes, associations culturelles).
Ce sont 1,5 million d'associations en France, dont la plupart tiennent encore leurs comptes
sur Excel.

**Semaine 1 — Votre réseau**
- Inscrivez 5 à 10 associations que vous connaissez (clubs, écoles, voisins) sur l'offre gratuite.
- Asseyez-vous avec chaque trésorier pendant 30 minutes : importez son relevé avec lui et notez ce qui le bloque.
- C'est votre meilleur test produit et votre source de premiers témoignages.

**Semaine 2 — Le canal le plus efficace : les têtes de réseau**
- Contactez la **maison des associations** de votre ville et les **fédérations** locales (sportives, UDAF, FCPE…).
- Proposez-leur un atelier gratuit d'une heure, « Préparer son AG en 1 clic », pour leurs trésoriers.

**Semaine 3 — Le moment clé : la saison des AG**
- La plupart des associations clôturent au 31 décembre ou au 31 août et tiennent leur AG dans les mois qui suivent.
- Votre argument : « Votre bilan et votre compte de résultat prêts pour l'AG, sans Excel. »
- Publiez dans les groupes Facebook et LinkedIn de trésoriers d'associations, et sur les forums associatifs.

**Semaine 4 — Convertir**
- L'offre gratuite donne envie ; les limites (50 adhérents, 1 compte bancaire, exports détaillés) font passer à **Essentiel** à 9 € par mois.
- Le back-office (`/admin`) indique qui s'inscrit, qui est actif et le MRR. Appelez personnellement chaque nouvel inscrit actif.

**Objectif réaliste :** 100 associations inscrites et 15 à 20 clientes payantes à 3 mois,
soit environ 150 à 200 € de revenu mensuel, et une base de témoignages pour accélérer.

---

## Phase de lancement gratuite (active depuis le 5 novembre 2026)

La variable Vercel `BETA_FREE=on` donne l'offre Pro à toutes les associations et bloque tout
paiement. Le site affiche « Phase de lancement : tout est gratuit » et promet un préavis
d'au moins un mois.

**Passer au payant (vers 10 à 15 associations actives) :**
1. Créer la société (SIREN), renseigner les variables `NEXT_PUBLIC_LEGAL_*`, faire relire les CGV.
2. Prévenir les associations inscrites par e-mail, **au moins un mois avant**.
3. Passer Stripe en mode réel : nouvelle clé secrète, nouveaux `price_…`, nouveau webhook.
4. Le jour J : supprimer `BETA_FREE` dans Vercel (ou le passer à `off`), puis redéployer.

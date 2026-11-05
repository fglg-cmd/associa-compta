# État du produit — 4 novembre 2026

Légende : ✅ livré et testé automatiquement · 🟢 livré, compile et build OK, pas encore
exercé contre un Supabase réel · 🔑 dépend d'une clé tierce à configurer.

## Vérifié dans l'environnement de construction

| Vérification | Résultat |
|---|---|
| Migrations SQL (8) sur PostgreSQL 16 | ✅ appliquées sans erreur |
| Tests SQL d'intégrité et d'isolation (≈ 40 assertions) | ✅ toutes vertes |
| Moteur comptable (Vitest) | ✅ 33 tests |
| Import bancaire CSV, OFX et QIF, règles (Vitest) | ✅ 24 tests |
| Extraction OCR montant, date, fournisseur (Vitest) | ✅ 7 tests |
| `tsc --noEmit` sur tout le monorepo | ✅ 0 erreur |
| `next lint` | ✅ 0 avertissement |
| `next build` (production) | ✅ 40 routes |
| Serveur de production : pages publiques, redirections d'authentification, protection des API, en-têtes de sécurité | ✅ testé avec curl |
| Rendu visuel : accueil (clair, sombre, mobile), connexion, tarifs | ✅ captures Playwright relues ; débordement du header mobile corrigé |

### Ce qui n'a pas pu être exécuté ici

L'environnement de construction n'avait ni Docker ni projet Supabase, et l'exécution de
binaires tiers téléchargés y était bloquée. Les parcours connectés (onboarding, banque,
justificatifs, etc.) n'ont donc **pas été cliqués dans un navigateur contre un vrai
Supabase**. La suite Playwright `apps/web/e2e/journey.spec.ts` couvre ce parcours. Elle
doit être lancée **avant le lancement** (voir `docs/03-EXPLOITATION.md` §5).

### Base de production Supabase (5 novembre 2026)

Les migrations 0001 à 0010 sont appliquées sur le projet `fglg-associa-compta`.

Deux scénarios complets ont été exécutés directement sur la base de production, dans une
transaction annulée, ce qui ne laisse aucune donnée. Résultat : **OK**.

Ils couvrent :
- la création d'une association ;
- la banque : comptabilisation, contre-passation, recomptabilisation et rapprochement exact ;
- les cotisations ;
- la balance équilibrée et la piste d'audit ;
- l'isolation entre deux utilisateurs ;
- le blocage de l'anonyme et des fonctions internes.

Côté droits, 28 fonctions métier sont ouvertes aux utilisateurs connectés et 0 à l'anonyme.

### Production en ligne (5 novembre 2026)

Le site est en ligne sur https://associa-compta.vercel.app, avec déploiement automatique à
chaque envoi sur la branche `main`.

Vérifications faites avec un vrai compte :
- inscription confirmée par e-mail ;
- création de l'association, avec ses 101 comptes, son compte bancaire et son exercice ;
- accès au back-office.

**Stripe en mode test, validé de bout en bout :** paiement de l'offre Essentielle annuelle
avec la carte 4242, webhook reçu (2 événements), association passée en offre Essentielle.

Il reste à brancher :
- Resend (e-mails vers tous les destinataires) ;
- Anthropic (assistant IA) ;
- le passage de Stripe en mode réel ;
- le nom de domaine et les mentions légales.

## Modules

| Module | État | Détail |
|---|---|---|
| Auth Google, Microsoft, e-mail, lien magique, mot de passe oublié | 🟢 🔑 | flux PKCE via `/auth/callback` |
| Onboarding (plan comptable, journaux, exercice, compte bancaire) | ✅ SQL · 🟢 UI | |
| Multi-associations, rôles, invitations | ✅ SQL · 🟢 UI | 5 rôles dont lecteur pour le vérificateur aux comptes |
| Tableau de bord | 🟢 | trésorerie, KPI, recettes et dépenses sur 12 mois, prévisionnel 6 mois, échéancier, alertes, démarrage guidé |
| Moteur comptable | ✅ | partie double, numérotation sans trou, contre-passation, clôture, balance, grand livre, journaux, bilan, compte de résultat |
| Banque | ✅ cœur · 🟢 UI | import CSV, OFX et QIF, anti-doublon, suggestions, règles apprises, comptabilisation groupée, rapprochement, état de rapprochement |
| Opérations | 🟢 | saisie simple (recette ou dépense) et experte multi-lignes, brouillons, validation, contre-passation |
| Justificatifs | 🟢 🔑 | envoi direct au stockage, aperçu, dossiers, recherche plein texte (français, sans accents), OCR (couche texte PDF, Tesseract, Google Vision), rattachement automatique au mouvement |
| Adhérents | ✅ SQL · 🟢 UI | fiche, import CSV, appels de cotisation, encaissement comptabilisé, relances e-mail manuelles et automatiques (cron), historique |
| Projets et événements | ✅ SQL · 🟢 UI | budget par poste, réalisé, écarts, rentabilité |
| Rapports | 🟢 | à l'écran, PDF, Excel, CSV, FEC, dossier d'AG avec rapport rédigé par l'IA |
| Assistant IA | 🟢 🔑 | streaming, contexte financier factuel, quotas par offre, historique des conversations |
| Abonnements Stripe | 🟢 🔑 | Checkout, portail client, webhook idempotent, limites par offre appliquées côté serveur |
| Back-office | 🟢 | MRR et ARR, clients, attribution manuelle d'offre, abonnements, support avec réponse par e-mail |
| Observabilité | 🟢 🔑 | Sentry (sans données financières), PostHog UE (champs masqués) |
| Déploiement | 🟢 | Dockerfile standalone, docker-compose, Vercel (cdg1, cron), CI GitHub Actions |

## Limites connues et prochaines étapes

1. **Lancer la suite E2E** contre Supabase local, puis en préproduction (priorité 1).
2. **Types générés** : remplacer `src/lib/types.ts` par `supabase gen types` en CI.
3. **OCR des PDF scannés** : nécessite Google Vision. Sans cette clé, ces documents sont
   marqués « non lus » sans erreur.
4. **Reçus fiscaux** (Cerfa 11580) : pas encore implémentés. Forte demande, à prévoir en S+2.
5. **Synchronisation bancaire automatique** (DSP2, via Bridge ou GoCardless) : à prévoir
   en S+4. L'import de fichiers couvre toutes les banques en attendant.
6. **Affectation du résultat** : le résultat antérieur est présenté en report à nouveau
   dans le bilan. L'écriture d'affectation votée en AG se saisit en saisie experte (OD).
7. **Limite de débit** de l'assistant IA : calculée en base, suffisante au lancement. À
   passer sur Redis (Upstash) au-delà de quelques milliers d'utilisateurs actifs.

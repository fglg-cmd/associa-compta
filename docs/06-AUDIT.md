# Audit complet — 5 novembre 2026

Audit mené sur le site en production (https://associa-compta.vercel.app), la base Supabase
et le code. Script rejouable : `node scripts/audit/audit-production.cjs scripts/audit`.

## Résultat final

**76 contrôles automatiques réussis, 0 erreur JavaScript, 0 erreur serveur.**

Le parcours testé couvre :
- inscription, onboarding et déconnexion ;
- la banque : import CSV, suggestions, doublons, contre-passation, règles ;
- la saisie d'une dépense en espèces ;
- les justificatifs : envoi, OCR, recherche plein texte, aperçu ;
- les adhérents : import CSV, cotisation, encaissement ;
- les projets ;
- les 5 onglets de la comptabilité et les 4 onglets des rapports ;
- les 19 exports (PDF, Excel, CSV, FEC) ;
- les 5 onglets des paramètres ;
- la recherche ⌘K ;
- 14 pages sur mobile ;
- l'isolation entre clients, le back-office et les exports sans connexion.

## Défauts trouvés et corrigés

| # | Gravité | Défaut | Correction |
|---|---|---|---|
| 1 | 🔴 Critique | **Exports PDF en erreur 500 sur Vercel** (police Helvetica absente du paquet serveur) | Polices pdfkit incluses dans la fonction (`outputFileTracingIncludes`), test unitaire PDF |
| 2 | 🔴 Critique | **Exports tronqués à 1 000 lignes** sans erreur : grand livre, journal et **FEC incomplets** (limite Supabase) | Pagination automatique (`fetchAll`) des exports, du grand livre, des adhérents et du tableau de bord |
| 3 | 🔴 Critique | **Suppression d'une association impossible** si des cotisations étaient payées ; les fichiers étaient effacés avant l'échec | Trigger exécuté avec les droits du propriétaire ; suppression de l'association **avant** les fichiers ; test SQL ajouté |
| 4 | 🟠 Sécurité | **Redirection ouverte** après connexion (`?next=//site-pirate.com`) | `safeNextPath` (chemins internes uniquement), 10 tests |
| 5 | 🟠 Sécurité | **Injection de formules** dans les exports CSV (libellé `=HYPERLINK(...)` exécuté par Excel) | Neutralisation des cellules commençant par `= + - @`, test |
| 6 | 🟠 Sécurité | Stockage sans limite de taille ni de type de fichier | 25 Mo, PDF, images, Word et Excel uniquement |
| 7 | 🟠 Sécurité | Recherche ⌘K : caractères de syntaxe de filtre non filtrés | Assainissement de la saisie |
| 8 | 🟡 Accessibilité | Intitulés de formulaires non reliés aux champs (lecteurs d'écran, clic sur l'intitulé) | Association implicite dans le composant `Field` |
| 9 | 🟡 Fiabilité | Dates du jour calculées en UTC (veille entre 0 h et 1-2 h du matin en France) | Fuseau Europe/Paris |
| 10 | 🟡 Performance | 34 clés étrangères sans index, 8 politiques RLS réévaluées à chaque ligne, 5 politiques en double | Index créés, `(select auth.uid())`, politiques séparées par action |
| 11 | 🟡 SEO | Ni robots.txt ni sitemap | Ajoutés (espace privé exclu de l'indexation) |
| 12 | 🟡 Exploitation | Erreurs serveur (exports, IA) impossibles à diagnostiquer | Trace technique dans le journal d'audit |

Corrigés lors des étapes précédentes : suggestions de catégories invisibles après import,
adresse `localhost` dans les liens d'inscription, boutons Google et Microsoft inopérants,
fonctions internes appelables via l'API.

## Points restants (décisions ou réglages à faire)

1. **Vercel, offre Hobby** : les conditions d'utilisation interdisent l'usage commercial. Il faudra
   passer en offre **Pro (20 $ par mois)** avant le premier client payant.
2. **Supabase, offre gratuite** : le projet est **mis en pause après 7 jours sans activité**. Il faut
   passer en offre Pro (25 $ par mois, sauvegardes quotidiennes incluses) au lancement commercial.
3. **Protection contre les mots de passe compromis** (Supabase Auth) : disponible à partir de
   l'offre Pro de Supabase.
4. **E-mails** : sans nom de domaine, pas de relances ni de « mot de passe oublié » automatique
   (repli vers le support, en place).
5. **Les 19 fonctions `SECURITY DEFINER` signalées** par l'outil Supabase sont volontaires :
   chacune vérifie elle-même les droits de l'utilisateur (testé : un autre client est refusé).

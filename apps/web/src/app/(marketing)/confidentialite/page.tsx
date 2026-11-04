import { legal } from "@/lib/legal";
import { LegalPage } from "../legal-page";

export const metadata = { title: "Politique de confidentialité" };

export default function Page() {
  return (
    <LegalPage title="Politique de confidentialité et RGPD" updated="4 novembre 2026">
      <section><h2>Rôles</h2><p>Pour les comptes utilisateurs, {legal.company} est responsable de traitement. Pour les données saisies par une association dans son espace (adhérents, opérations, justificatifs), l&apos;association est responsable de traitement et {legal.company} agit en tant que sous-traitant au sens de l&apos;article 28 du RGPD.</p></section>
      <section><h2>Données traitées</h2><ul><li>Compte : nom, adresse e-mail, fournisseur de connexion (Google, Microsoft, e-mail).</li><li>Données de l&apos;association : opérations bancaires importées, écritures comptables, justificatifs, fichier des adhérents, cotisations.</li><li>Données techniques : journaux de sécurité, mesures d&apos;audience anonymisées.</li></ul></section>
      <section><h2>Finalités et bases légales</h2><ul><li>Fourniture du Service (exécution du contrat).</li><li>Facturation (obligation légale).</li><li>Sécurité et prévention de la fraude (intérêt légitime).</li><li>Amélioration du produit par mesure d&apos;audience (intérêt légitime, sans enregistrement des contenus financiers).</li></ul></section>
      <section><h2>Sous-traitants</h2><ul><li>Supabase (base de données, authentification, stockage) — hébergement dans l&apos;Union européenne.</li><li>Vercel (hébergement de l&apos;application).</li><li>Stripe (paiement des abonnements).</li><li>Resend (envoi des e-mails).</li><li>Anthropic et, le cas échéant, OpenAI (assistant IA — seules des données financières agrégées sont transmises, sans données nominatives d&apos;adhérents ; elles ne sont pas utilisées pour entraîner leurs modèles).</li><li>Google Cloud Vision, si activé (lecture des justificatifs).</li><li>Sentry et PostHog (supervision technique et mesure d&apos;audience, hébergement UE).</li></ul></section>
      <section><h2>Durées de conservation</h2><p>Les données de l&apos;association sont conservées tant que l&apos;espace existe ; elles sont supprimées dans un délai de 30 jours après la suppression de l&apos;espace (sauvegardes incluses). Les pièces comptables doivent être conservées 10 ans par l&apos;association (article L123-22 du Code de commerce) : exportez-les avant suppression.</p></section>
      <section><h2>Sécurité</h2><p>Chiffrement en transit (TLS) et au repos, cloisonnement strict des associations au niveau de la base de données, contrôle d&apos;accès par rôles, journal d&apos;audit, sauvegardes quotidiennes.</p></section>
      <section><h2>Vos droits</h2><p>Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de limitation, de portabilité et d&apos;opposition. Pour les exercer : <a className="text-accent" href={`mailto:${legal.email}`}>{legal.email}</a>. Vous pouvez introduire une réclamation auprès de la CNIL (cnil.fr).</p></section>
    </LegalPage>
  );
}

import { legal } from "@/lib/legal";
import { LegalPage } from "../legal-page";

export const metadata = { title: "Conditions générales d'utilisation et de vente" };

export default function Page() {
  return (
    <LegalPage title="Conditions générales d'utilisation et de vente" updated="4 novembre 2026">
      <section><h2>1. Objet</h2><p>Les présentes conditions régissent l&apos;utilisation du service en ligne ASSOCIA COMPTA (le « Service »), logiciel de gestion financière et comptable destiné aux associations, édité par {legal.company}. La création d&apos;un compte vaut acceptation des présentes conditions.</p></section>
      <section><h2>2. Compte et accès</h2><p>L&apos;utilisateur garantit l&apos;exactitude des informations fournies et la confidentialité de ses identifiants. Le propriétaire d&apos;un espace association est responsable des accès qu&apos;il accorde aux autres membres (administrateur, trésorier, membre du bureau, lecteur).</p></section>
      <section><h2>3. Description du Service</h2><p>Le Service permet notamment l&apos;import de relevés bancaires, la tenue d&apos;une comptabilité en partie double selon le plan comptable associatif (règlement ANC n° 2018-06), le stockage de justificatifs, la gestion des adhérents et cotisations, le suivi budgétaire de projets, la production d&apos;états financiers et l&apos;assistance par intelligence artificielle.</p></section>
      <section><h2>4. Responsabilités</h2><p>Le Service est un outil d&apos;aide à la gestion. Les écritures, catégorisations et documents produits restent sous la responsabilité de l&apos;association, de ses dirigeants et, le cas échéant, de son expert-comptable ou commissaire aux comptes. Les réponses de l&apos;assistant IA sont fournies à titre informatif et ne constituent pas un conseil juridique, fiscal ou comptable.</p></section>
      <section><h2>5. Offres et prix</h2><p>L&apos;offre Découverte est gratuite et soumise aux limites affichées sur la page Tarifs. Les offres payantes sont facturées d&apos;avance, mensuellement ou annuellement, via notre prestataire de paiement Stripe. Les prix sont indiqués hors taxes. L&apos;abonnement est renouvelé tacitement et résiliable à tout moment depuis l&apos;espace de facturation ; la résiliation prend effet à la fin de la période en cours. Les sommes versées pour la période en cours ne sont pas remboursables, sauf disposition légale contraire.</p></section>
      <section><h2>6. Disponibilité</h2><p>L&apos;éditeur met en œuvre les moyens raisonnables pour assurer la disponibilité du Service, sauvegardé quotidiennement. Des interruptions pour maintenance peuvent intervenir et sont, dans la mesure du possible, annoncées à l&apos;avance.</p></section>
      <section><h2>7. Données</h2><p>Les données de l&apos;association lui appartiennent. Elle peut les exporter à tout moment (FEC, Excel, CSV, PDF) et supprimer son espace. Le traitement des données personnelles est décrit dans la politique de confidentialité.</p></section>
      <section><h2>8. Droit applicable</h2><p>Les présentes conditions sont soumises au droit français. À défaut de résolution amiable, tout litige relèvera des tribunaux compétents du ressort du siège de l&apos;éditeur.</p></section>
    </LegalPage>
  );
}

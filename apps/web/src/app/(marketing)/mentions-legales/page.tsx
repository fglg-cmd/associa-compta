import { legal } from "@/lib/legal";
import { LegalPage } from "../legal-page";

export const metadata = { title: "Mentions légales" };

export default function Page() {
  return (
    <LegalPage title="Mentions légales" updated="4 novembre 2026">
      <section>
        <h2>Éditeur</h2>
        <p>{legal.company}{legal.form ? `, ${legal.form}` : ""}{legal.capital ? ` au capital de ${legal.capital}` : ""}{legal.siren ? `, immatriculée sous le numéro SIREN ${legal.siren}` : ""}{legal.address ? `, dont le siège est situé ${legal.address}` : ""}.</p>
        {legal.director && <p>Directeur de la publication : {legal.director}.</p>}
        <p>Contact : <a className="text-accent" href={`mailto:${legal.email}`}>{legal.email}</a></p>
      </section>
      <section><h2>Hébergement</h2><p>{legal.host}.</p></section>
      <section><h2>Propriété intellectuelle</h2><p>L&apos;ensemble des éléments du service (logiciel, interface, textes, logos) est protégé par le droit de la propriété intellectuelle. Toute reproduction non autorisée est interdite. Les données saisies par les associations restent leur propriété exclusive.</p></section>
    </LegalPage>
  );
}

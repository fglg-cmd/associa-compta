/** Identité légale de l'éditeur — configurée par variables d'environnement (obligatoire avant lancement). */
export const legal = {
  company: process.env.NEXT_PUBLIC_LEGAL_COMPANY ?? "ASSOCIA COMPTA",
  form: process.env.NEXT_PUBLIC_LEGAL_FORM ?? "",
  capital: process.env.NEXT_PUBLIC_LEGAL_CAPITAL ?? "",
  siren: process.env.NEXT_PUBLIC_LEGAL_SIREN ?? "",
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS ?? "",
  director: process.env.NEXT_PUBLIC_LEGAL_DIRECTOR ?? "",
  email: process.env.NEXT_PUBLIC_LEGAL_EMAIL ?? "contact@associa-compta.fr",
  host: "Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (application) ; Supabase Inc. — données hébergées dans l'Union européenne (région AWS eu-west-3, Paris)",
};

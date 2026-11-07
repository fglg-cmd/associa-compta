/**
 * Plan comptable associatif — règlement ANC n° 2018-06 (modifié par le
 * règlement ANC n° 2020-08). Sélection des comptes utiles à 95 % des
 * associations ; l'utilisateur peut en créer d'autres.
 *
 * SOURCE UNIQUE : ce fichier alimente la création des associations
 * (RPC create_organization) et la catégorisation « langage humain ».
 */

export type AccountKind =
  | "equity"
  | "fixed_asset"
  | "stock"
  | "third_party"
  | "financial"
  | "expense"
  | "income"
  | "special";

export interface ChartAccount {
  number: string;
  label: string;
  kind: AccountKind;
}

export const ASSOCIATION_CHART: readonly ChartAccount[] = [
  // Classe 1 — Fonds propres, fonds dédiés, emprunts
  { number: "102", label: "Fonds propres sans droit de reprise", kind: "equity" },
  { number: "103", label: "Fonds propres avec droit de reprise", kind: "equity" },
  { number: "106", label: "Réserves", kind: "equity" },
  { number: "110", label: "Report à nouveau (solde créditeur)", kind: "equity" },
  { number: "119", label: "Report à nouveau (solde débiteur)", kind: "equity" },
  { number: "120", label: "Résultat de l'exercice (excédent)", kind: "equity" },
  { number: "129", label: "Résultat de l'exercice (déficit)", kind: "equity" },
  { number: "131", label: "Subventions d'investissement", kind: "equity" },
  { number: "151", label: "Provisions pour risques", kind: "equity" },
  { number: "194", label: "Fonds reportés liés aux legs ou donations", kind: "equity" },
  { number: "195", label: "Fonds dédiés sur subventions d'exploitation", kind: "equity" },
  { number: "197", label: "Fonds dédiés sur contributions financières", kind: "equity" },
  { number: "164", label: "Emprunts auprès des établissements de crédit", kind: "equity" },
  { number: "165", label: "Dépôts et cautionnements reçus", kind: "equity" },

  // Classe 2 — Immobilisations
  { number: "205", label: "Logiciels, licences", kind: "fixed_asset" },
  { number: "213", label: "Constructions", kind: "fixed_asset" },
  { number: "215", label: "Matériel et outillage", kind: "fixed_asset" },
  { number: "2182", label: "Matériel de transport", kind: "fixed_asset" },
  { number: "2183", label: "Matériel de bureau et informatique", kind: "fixed_asset" },
  { number: "2184", label: "Mobilier", kind: "fixed_asset" },
  { number: "275", label: "Dépôts et cautionnements versés", kind: "fixed_asset" },
  { number: "2805", label: "Amortissements des logiciels", kind: "fixed_asset" },
  { number: "2815", label: "Amortissements du matériel", kind: "fixed_asset" },
  { number: "28183", label: "Amortissements du matériel informatique", kind: "fixed_asset" },

  // Classe 3 — Stocks
  { number: "37", label: "Stocks de marchandises", kind: "stock" },

  // Classe 4 — Tiers
  { number: "401", label: "Fournisseurs", kind: "third_party" },
  { number: "404", label: "Fournisseurs d'immobilisations", kind: "third_party" },
  { number: "411", label: "Usagers et clients", kind: "third_party" },
  { number: "421", label: "Personnel — rémunérations dues", kind: "third_party" },
  { number: "431", label: "Sécurité sociale (URSSAF)", kind: "third_party" },
  { number: "437", label: "Autres organismes sociaux", kind: "third_party" },
  { number: "441", label: "État — subventions à recevoir", kind: "third_party" },
  { number: "445", label: "État — TVA", kind: "third_party" },
  { number: "447", label: "Autres impôts et taxes", kind: "third_party" },
  { number: "451", label: "Fédération, comités, sections", kind: "third_party" },
  { number: "467", label: "Autres débiteurs et créditeurs", kind: "third_party" },
  { number: "468", label: "Charges à payer et produits à recevoir", kind: "third_party" },
  { number: "486", label: "Charges constatées d'avance", kind: "third_party" },
  { number: "487", label: "Produits constatés d'avance", kind: "third_party" },

  // Classe 5 — Financiers (les comptes 512x sont créés avec chaque compte bancaire)
  { number: "508", label: "Valeurs mobilières de placement", kind: "financial" },
  { number: "511", label: "Chèques et valeurs à encaisser", kind: "financial" },
  { number: "530", label: "Caisse", kind: "financial" },
  { number: "580", label: "Virements internes", kind: "financial" },

  // Classe 6 — Charges
  { number: "601", label: "Achats de matières et fournitures", kind: "expense" },
  { number: "6061", label: "Fournitures non stockables (eau, énergie)", kind: "expense" },
  { number: "6063", label: "Fournitures d'entretien et petit équipement", kind: "expense" },
  { number: "6064", label: "Fournitures administratives", kind: "expense" },
  { number: "6068", label: "Autres matières et fournitures", kind: "expense" },
  { number: "607", label: "Achats de marchandises (buvette, boutique)", kind: "expense" },
  { number: "611", label: "Sous-traitance générale", kind: "expense" },
  { number: "613", label: "Locations", kind: "expense" },
  { number: "614", label: "Charges locatives et de copropriété", kind: "expense" },
  { number: "615", label: "Entretien et réparations", kind: "expense" },
  { number: "616", label: "Primes d'assurance", kind: "expense" },
  { number: "618", label: "Documentation, formations, colloques", kind: "expense" },
  { number: "622", label: "Honoraires (expert-comptable, avocat…)", kind: "expense" },
  { number: "623", label: "Publicité, publications, communication", kind: "expense" },
  { number: "624", label: "Transports de biens et transports collectifs", kind: "expense" },
  { number: "625", label: "Déplacements, missions et réceptions", kind: "expense" },
  { number: "626", label: "Frais postaux et de télécommunications", kind: "expense" },
  { number: "627", label: "Services bancaires", kind: "expense" },
  { number: "628", label: "Cotisations versées (fédération) et divers", kind: "expense" },
  { number: "6281", label: "Abonnements logiciels et services en ligne", kind: "expense" },
  { number: "635", label: "Impôts et taxes", kind: "expense" },
  { number: "641", label: "Rémunérations du personnel", kind: "expense" },
  { number: "645", label: "Charges de sécurité sociale et prévoyance", kind: "expense" },
  { number: "647", label: "Autres charges sociales", kind: "expense" },
  { number: "651", label: "Redevances (SACEM, licences)", kind: "expense" },
  { number: "6571", label: "Bourses et aides accordées", kind: "expense" },
  { number: "658", label: "Charges diverses de gestion courante", kind: "expense" },
  { number: "661", label: "Charges d'intérêts", kind: "expense" },
  { number: "671", label: "Charges exceptionnelles sur opérations de gestion", kind: "expense" },
  { number: "681", label: "Dotations aux amortissements et provisions", kind: "expense" },
  { number: "689", label: "Reports en fonds dédiés", kind: "expense" },
  { number: "695", label: "Impôts sur les sociétés", kind: "expense" },

  // Classe 7 — Produits
  { number: "706", label: "Prestations de services (inscriptions, stages)", kind: "income" },
  { number: "707", label: "Ventes de marchandises (buvette, boutique)", kind: "income" },
  { number: "708", label: "Produits des activités annexes", kind: "income" },
  { number: "7083", label: "Locations diverses", kind: "income" },
  { number: "741", label: "Subventions d'exploitation — État", kind: "income" },
  { number: "742", label: "Subventions d'exploitation — Région", kind: "income" },
  { number: "743", label: "Subventions d'exploitation — Département", kind: "income" },
  { number: "744", label: "Subventions d'exploitation — Commune", kind: "income" },
  { number: "748", label: "Autres subventions d'exploitation", kind: "income" },
  { number: "7541", label: "Dons manuels", kind: "income" },
  { number: "7542", label: "Mécénat", kind: "income" },
  { number: "7543", label: "Legs, donations et assurances-vie", kind: "income" },
  { number: "755", label: "Contributions financières d'autres organismes", kind: "income" },
  { number: "756", label: "Cotisations", kind: "income" },
  { number: "758", label: "Produits divers de gestion courante", kind: "income" },
  { number: "768", label: "Autres produits financiers (intérêts)", kind: "income" },
  { number: "771", label: "Produits exceptionnels sur opérations de gestion", kind: "income" },
  { number: "781", label: "Reprises sur amortissements et provisions", kind: "income" },
  { number: "789", label: "Utilisations des fonds dédiés", kind: "income" },

  // Classe 8 — Contributions volontaires en nature
  { number: "860", label: "Secours en nature", kind: "special" },
  { number: "861", label: "Mise à disposition gratuite de biens", kind: "special" },
  { number: "864", label: "Personnel bénévole", kind: "special" },
  { number: "870", label: "Bénévolat", kind: "special" },
  { number: "871", label: "Prestations en nature", kind: "special" },
  { number: "875", label: "Dons en nature", kind: "special" },
];

/**
 * Catégories « langage humain » : ce que voit un trésorier non comptable.
 * Chaque catégorie pointe vers un compte du plan.
 */
export interface Category {
  key: string;
  label: string;
  account: string;
  direction: "in" | "out";
  keywords: readonly string[];
}

export const CATEGORIES: readonly Category[] = [
  { key: "membership", label: "Cotisations des adhérents", account: "756", direction: "in", keywords: ["cotisation", "adhesion", "adhérent", "licence"] },
  { key: "donation", label: "Dons", account: "7541", direction: "in", keywords: ["don ", "donation", "helloasso don"] },
  { key: "sponsorship", label: "Mécénat", account: "7542", direction: "in", keywords: ["mecenat", "mécénat", "sponsor"] },
  { key: "grant_city", label: "Subvention de la commune", account: "744", direction: "in", keywords: ["mairie", "commune", "ville de"] },
  { key: "grant_dept", label: "Subvention du département", account: "743", direction: "in", keywords: ["departement", "conseil departemental"] },
  { key: "grant_region", label: "Subvention de la région", account: "742", direction: "in", keywords: ["region", "conseil regional"] },
  { key: "grant_state", label: "Subvention de l'État", account: "741", direction: "in", keywords: ["ddfip", "prefecture", "ans ", "fdva", "dreets"] },
  { key: "services", label: "Inscriptions, stages, prestations", account: "706", direction: "in", keywords: ["inscription", "stage", "atelier"] },
  { key: "sales", label: "Buvette, boutique, ventes", account: "707", direction: "in", keywords: ["sumup", "buvette", "vente"] },
  { key: "interest", label: "Intérêts bancaires", account: "768", direction: "in", keywords: ["interets", "intérêts", "livret"] },
  { key: "supplies", label: "Fournitures et petit matériel", account: "6063", direction: "out", keywords: ["leroy merlin", "castorama", "decathlon", "action", "bricomarche", "intersport", "go sport", "materiel", "quincaillerie"] },
  { key: "office", label: "Fournitures de bureau", account: "6064", direction: "out", keywords: ["bureau vallee", "office depot", "papeterie"] },
  { key: "goods", label: "Achats buvette / boutique", account: "607", direction: "out", keywords: ["metro", "promocash", "carrefour", "leclerc", "auchan", "lidl", "intermarche", "super u", "boissons", "france boissons"] },
  { key: "energy", label: "Eau, électricité, gaz", account: "6061", direction: "out", keywords: ["edf", "engie", "total energies", "veolia", "suez"] },
  { key: "rent", label: "Loyer et locations", account: "613", direction: "out", keywords: ["loyer", "location"] },
  { key: "insurance", label: "Assurances", account: "616", direction: "out", keywords: ["maif", "macif", "maaf", "axa", "allianz", "groupama", "assurance", "mma"] },
  { key: "fees", label: "Honoraires", account: "622", direction: "out", keywords: ["honoraires", "expert comptable", "avocat"] },
  { key: "communication", label: "Communication et impression", account: "623", direction: "out", keywords: ["vistaprint", "imprimerie", "canva", "facebook ads", "google ads", "affiche", "flyer", "banniere", "publicitaire", "carte de visite", "site web", "site internet", "graphiste", "logo"] },
  { key: "travel", label: "Déplacements et réceptions", account: "625", direction: "out", keywords: ["sncf", "total", "esso", "peage", "autoroute", "restaurant", "uber", "blablacar", "boulangerie", "patisserie", "viennoiserie", "traiteur", "pizzeria", "carburant", "essence", "gazole"] },
  { key: "telecom", label: "Téléphone, internet, poste", account: "626", direction: "out", keywords: ["orange", "free mobile", "sfr", "bouygues", "la poste", "laposte"] },
  { key: "bank_fees", label: "Frais bancaires", account: "627", direction: "out", keywords: ["frais", "commission", "cotisation carte", "abonnement banque", "agios", "tenue de compte"] },
  { key: "software", label: "Logiciels et abonnements", account: "6281", direction: "out", keywords: ["google", "microsoft", "ovh", "o2switch", "zoom", "notion", "canva pro", "associa"] },
  { key: "federation", label: "Cotisation fédération", account: "628", direction: "out", keywords: ["federation", "fédération", "ligue", "fft", "fff", "ffr"] },
  { key: "royalties", label: "SACEM et redevances", account: "651", direction: "out", keywords: ["sacem", "spre"] },
  { key: "salaries", label: "Salaires", account: "641", direction: "out", keywords: ["salaire", "paie"] },
  { key: "social", label: "Charges sociales (URSSAF)", account: "645", direction: "out", keywords: ["urssaf", "cesu", "impact emploi"] },
  { key: "taxes", label: "Impôts et taxes", account: "635", direction: "out", keywords: ["dgfip", "impot", "taxe"] },
  { key: "other_out", label: "Autres dépenses", account: "658", direction: "out", keywords: [] },
  { key: "other_in", label: "Autres recettes", account: "758", direction: "in", keywords: [] },
];

export function accountKindFromNumber(number: string): AccountKind {
  const c = number[0];
  switch (c) {
    case "1": return "equity";
    case "2": return "fixed_asset";
    case "3": return "stock";
    case "4": return "third_party";
    case "5": return "financial";
    case "6": return "expense";
    case "7": return "income";
    default: return "special";
  }
}

export function isValidAccountNumber(number: string): boolean {
  return /^[1-8][0-9]{1,9}$/.test(number);
}

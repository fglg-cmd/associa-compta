/**
 * Extraction des informations clés d'un justificatif à partir du texte OCR :
 * montant total, date, fournisseur. Heuristiques déterministes et testées.
 */
import { parseAmount } from "@associa/accounting";

// Nombre : avec séparateurs de milliers (espace, espace insécable, point) ou d'un seul bloc,
// éventuellement suivi de centimes ; le symbole € (ou EUR) peut précéder ou suivre.
const AMOUNT_RE = /(?<![\d.,])(€|eur)?\s*(\d{1,3}(?:[   .]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)(?![\d])(\s*(?:€|eur(?:os?)?\b))?/gi;

const TOTAL_KEYWORDS = [
  /net\s*[àa]\s*payer/i,
  /total\s*t\.?t\.?c\.?/i,
  /montant\s*t\.?t\.?c\.?/i,
  /total\s*[àa]\s*payer/i,
  /montant\s*(total|d[ûu]|[àa] r[ée]gler)/i,
  /(?<!sous[\s-]?)\btotal\b(?!\s*(h\.?t|tva))/i,
  /\bmontant\b/i,
];

interface AmountToken {
  cents: number;
  /** Centimes écrits ou symbole € présent : c'est bien un montant. */
  explicit: boolean;
  /** Dernier élément de la ligne (« TOTAL : 2940 »). */
  atEnd: boolean;
}

function toCents(raw: string): number | null {
  if (/[.,]\d{2}$/.test(raw)) return parseAmount(raw);
  const n = Number(raw.replace(/[   .]/g, ""));
  return Number.isSafeInteger(n) ? n * 100 : null;
}

function amountsIn(line: string): AmountToken[] {
  const out: AmountToken[] = [];
  for (const m of line.matchAll(AMOUNT_RE)) {
    const cents = toCents(m[2]!);
    if (cents === null || cents <= 0) continue;
    const hasCents = /[.,]\d{2}$/.test(m[2]!);
    const atEnd = /^[\s.:;)€]*$/.test(line.slice(m.index! + m[0].length));
    out.push({ cents, explicit: hasCents || Boolean(m[1] || m[3]), atEnd });
  }
  return out;
}

/** Montant sur une ligne de total : montant explicite le plus à droite, sinon nombre entier en fin de ligne. */
function pickOnTotalLine(line: string): number | null {
  const tokens = amountsIn(line);
  const explicit = tokens.filter((t) => t.explicit);
  if (explicit.length) return explicit[explicit.length - 1]!.cents;
  const last = tokens[tokens.length - 1];
  return last?.atEnd && last.cents >= 1000 ? last.cents : null;
}

export function extractAmount(text: string): number | null {
  const lines = text.split(/\r?\n/);
  for (const kw of TOTAL_KEYWORDS) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]!;
      if (!kw.test(line)) continue;
      const onLine = pickOnTotalLine(line);
      if (onLine) return onLine;
      const next = lines[i + 1];
      if (next) {
        const n = amountsIn(next).filter((t) => t.explicit);
        if (n.length) return n[0]!.cents;
      }
    }
  }
  // Repli : le plus grand montant accompagné du symbole €
  const withSymbol = [...text.matchAll(AMOUNT_RE)].filter((m) => m[1] || m[3]).map((m) => toCents(m[2]!)).filter((v): v is number => v !== null && v > 0);
  return withSymbol.length ? Math.max(...withSymbol) : null;
}

/** Numéro de facture ou de reçu (« Facture n° F-2026-0042 », « #12345 »). */
export function extractReference(text: string): string | null {
  const patterns = [
    /(?:facture|invoice|re[çc]u|ticket|avoir|commande)\s*(?:n[°o.]|num[ée]ro|#)\s*:?\s*([A-Z0-9][A-Z0-9\-/_.]{1,30})/i,
    /n[°o]\s*(?:de\s*)?(?:facture|re[çc]u)\s*:?\s*([A-Z0-9][A-Z0-9\-/_.]{1,30})/i,
    /(?:^|\s)#\s?([A-Z0-9][A-Z0-9\-/_.]{2,30})/m,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const ref = m?.[1]?.replace(/[.\-/_]+$/, "");
    if (ref && /\d/.test(ref)) return ref;
  }
  return null;
}

const MONTHS: Record<string, number> = { janv: 1, janvier: 1, fevr: 2, fevrier: 2, fev: 2, mars: 3, avr: 4, avril: 4, mai: 5, juin: 6, juil: 7, juillet: 7, aout: 8, sept: 9, septembre: 9, oct: 10, octobre: 10, nov: 11, novembre: 11, dec: 12, decembre: 12 };

function valid(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 ? dt.toISOString().slice(0, 10) : null;
}

export function extractDate(text: string): string | null {
  const norm = text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const found: { date: string; score: number }[] = [];
  const lines = norm.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const ctx = /date|facture|du |emis|le /.test(line) ? 2 : 0;
    const echeance = /echeance|validite|expir/.test(line) ? -3 : 0;
    for (const m of line.matchAll(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/g)) {
      const y = m[3]!.length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      const d = valid(y, Number(m[2]), Number(m[1]));
      if (d) found.push({ date: d, score: ctx + echeance - idx * 0.01 });
    }
    for (const m of line.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
      const d = valid(Number(m[1]), Number(m[2]), Number(m[3]));
      if (d) found.push({ date: d, score: ctx + echeance - idx * 0.01 });
    }
    for (const m of line.matchAll(/\b(\d{1,2})(?:er)?\s+([a-z]{3,9})\.?\s+(\d{4})\b/g)) {
      const mo = MONTHS[m[2]!] ?? MONTHS[m[2]!.slice(0, 4)] ?? MONTHS[m[2]!.slice(0, 3)];
      const d = mo ? valid(Number(m[3]), mo, Number(m[1])) : null;
      if (d) found.push({ date: d, score: ctx + echeance + 0.5 - idx * 0.01 });
    }
  });
  found.sort((a, b) => b.score - a.score);
  return found[0]?.date ?? null;
}

const NOISE = /^(facture|invoice|devis|ticket|re[çc]u|date|page|tel|t[ée]l[ée]phone|siret|siren|tva|n[°o]|client|www\.|http|adresse|bon de|avoir|duplicata)/i;

export function extractVendor(text: string, exclude: string[] = []): string | null {
  const own = exclude.map((e) => e.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()).filter((e) => e.length >= 3);
  const isOwn = (l: string) => {
    const n = l.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return own.some((o) => n.includes(o));
  };
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 3 && l.length <= 60 && /[a-zA-Z]{3}/.test(l) && !NOISE.test(l) && !/\d{5}/.test(l) && !/@/.test(l) && !l.startsWith("#") && !isOwn(l));
  const company = lines.find((l) => /\b(sas|sarl|sa|eurl|sasu|sci|ltd|gmbh|inc)\b/i.test(l));
  const v = company ?? lines[0];
  return v ? v.replace(/[|*_]+/g, "").trim().slice(0, 80) : null;
}

const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/**
 * Sens de l'opération : une facture émise par l'association (son nom en tête du document,
 * avant le bloc « client ») est une recette ; tout autre justificatif est une dépense.
 */
export function detectDirection(text: string, ownNames: string[]): "in" | "out" {
  const own = ownNames.map((n) => fold(n).trim()).filter((n) => n.length >= 3);
  if (!own.length) return "out";
  const lines = fold(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const ownIdx = lines.findIndex((l) => own.some((o) => l.includes(o)));
  if (ownIdx < 0 || ownIdx > 1) return "out";
  const clientIdx = lines.findIndex((l) => /\b(client|factur[ée]e? a|destinataire|adresse de facturation|a l'attention|livre a|bill to)\b/.test(l));
  return clientIdx < 0 || ownIdx < clientIdx ? "in" : "out";
}

export function extractFields(text: string, opts: { exclude?: string[] } = {}) {
  return { amount: extractAmount(text), date: extractDate(text), vendor: extractVendor(text, opts.exclude), reference: extractReference(text) };
}

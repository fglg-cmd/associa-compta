/**
 * Montants : toujours des entiers en CENTIMES. Jamais de float dans le métier.
 */
export type Cents = number;

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const EUR_COMPACT = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});
const PLAIN = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 123456 → "1 234,56 €" */
export function formatEUR(cents: Cents, opts: { compact?: boolean; signed?: boolean } = {}): string {
  const value = cents / 100;
  const s = opts.compact && Math.abs(value) >= 10_000 ? EUR_COMPACT.format(value) : EUR.format(value);
  return opts.signed && cents > 0 ? `+${s}` : s;
}

/** 123456 → "1 234,56" (exports, tableaux) */
export function formatAmount(cents: Cents): string {
  return PLAIN.format(cents / 100);
}

/**
 * Convertit une saisie humaine ou un champ de relevé en centimes.
 * Gère : "1 234,56" · "1.234,56" · "1,234.56" · "-12.5" · "12,5 €" · "(45,00)" · "+3"
 * Retourne null si la valeur n'est pas un montant.
 */
export function parseAmount(input: string | number | null | undefined): Cents | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  let s = input.trim();
  if (!s) return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[€\s  ]|EUR/gi, "");
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (s.endsWith("-")) {
    negative = !negative;
    s = s.slice(0, -1);
  }
  if (!/^[\d.,']+$/.test(s)) return null;
  s = s.replace(/'/g, "");

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let intPart: string;
  let decPart = "";

  if (lastComma >= 0 && lastDot >= 0) {
    const decSep = lastComma > lastDot ? "," : ".";
    const idx = s.lastIndexOf(decSep);
    intPart = s.slice(0, idx).replace(/[.,]/g, "");
    decPart = s.slice(idx + 1);
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? "," : ".";
    const parts = s.split(sep);
    const last = parts[parts.length - 1] ?? "";
    if (parts.length > 2 || last.length === 3) {
      // "1.234.567" / "1 234" / "1.234" : séparateurs de milliers (usage bancaire FR)
      intPart = parts.join("");
    } else {
      // "12,5" / "12.50" : décimales
      intPart = parts[0] ?? "";
      decPart = last;
    }
  } else {
    intPart = s;
  }

  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart)) return null;
  if (!intPart && !decPart) return null;
  const cents = Number(intPart || "0") * 100 + Number((decPart + "00").slice(0, 2));
  // Arrondi bancaire au-delà de 2 décimales
  const third = decPart.length > 2 ? Number(decPart[2]) : 0;
  const rounded = third >= 5 ? cents + 1 : cents;
  return negative ? -rounded : rounded;
}

/** Somme sûre d'entiers */
export function sum(values: readonly Cents[]): Cents {
  let t = 0;
  for (const v of values) t += v;
  return t;
}

/** Répartit un montant en n parts entières dont la somme est exacte. */
export function allocate(total: Cents, ratios: readonly number[]): Cents[] {
  const totalRatio = ratios.reduce((a, b) => a + b, 0);
  if (totalRatio <= 0) throw new Error("Ratios invalides");
  const raw = ratios.map((r) => (total * r) / totalRatio);
  const floored = raw.map((x) => Math.floor(x));
  let remainder = total - sum(floored);
  const order = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floored[i] = (floored[i] ?? 0) + 1;
    remainder--;
  }
  return floored;
}

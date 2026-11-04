/**
 * Extraction des informations clés d'un justificatif à partir du texte OCR :
 * montant total, date, fournisseur. Heuristiques déterministes et testées.
 */
import { parseAmount } from "@associa/accounting";

const AMOUNT_RE = /(?<![\d.,])(\d{1,3}(?:[   .]\d{3})*(?:[.,]\d{2})|\d+[.,]\d{2})(?![\d])\s*(?:€|eur(?:os?)?)?/gi;

const TOTAL_KEYWORDS = [
  /net\s*[àa]\s*payer/i,
  /total\s*t\.?t\.?c\.?/i,
  /montant\s*t\.?t\.?c\.?/i,
  /total\s*[àa]\s*payer/i,
  /montant\s*(total|d[ûu]|[àa] r[ée]gler)/i,
  /\btotal\b(?!\s*h\.?t)/i,
  /\bmontant\b/i,
];

export function extractAmount(text: string): number | null {
  const lines = text.split(/\r?\n/);
  for (const kw of TOTAL_KEYWORDS) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]!;
      if (!kw.test(line)) continue;
      const candidates = [...line.matchAll(AMOUNT_RE)].map((m) => parseAmount(m[1]!)).filter((v): v is number => v !== null && v > 0);
      if (candidates.length) return candidates[candidates.length - 1]!;
      const next = lines[i + 1];
      if (next) {
        const n = [...next.matchAll(AMOUNT_RE)].map((m) => parseAmount(m[1]!)).filter((v): v is number => v !== null && v > 0);
        if (n.length) return n[0]!;
      }
    }
  }
  // Repli : le plus grand montant suivi du symbole €
  const euros = [...text.matchAll(/(\d{1,3}(?:[   .]\d{3})*[.,]\d{2})\s*(?:€|eur)/gi)].map((m) => parseAmount(m[1]!)).filter((v): v is number => v !== null && v > 0);
  return euros.length ? Math.max(...euros) : null;
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

export function extractVendor(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 3 && l.length <= 60 && /[a-zA-Z]{3}/.test(l) && !NOISE.test(l) && !/\d{5}/.test(l) && !/@/.test(l));
  const company = lines.find((l) => /\b(sas|sarl|sa|eurl|sasu|sci|ltd|gmbh|inc)\b/i.test(l));
  const v = company ?? lines[0];
  return v ? v.replace(/[|*_]+/g, "").trim().slice(0, 80) : null;
}

export function extractFields(text: string) {
  return { amount: extractAmount(text), date: extractDate(text), vendor: extractVendor(text) };
}

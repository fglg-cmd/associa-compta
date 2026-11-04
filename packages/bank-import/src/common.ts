/**
 * Types et utilitaires communs aux parseurs de relevés.
 */

export interface ParsedTransaction {
  /** ISO yyyy-mm-dd */
  date: string;
  valueDate?: string;
  /** Libellé nettoyé, lisible */
  label: string;
  /** Libellé brut du relevé */
  rawLabel: string;
  /** Centimes, signé (+ crédit / − débit) */
  amount: number;
  /** Identifiant fourni par la banque (OFX FITID) */
  bankId?: string;
  counterparty?: string;
}

export interface ParseResult {
  format: "csv" | "ofx" | "qif";
  transactions: ParsedTransaction[];
  /** Lignes ignorées (en-têtes, totaux, lignes illisibles) avec la raison */
  skipped: { line: number; reason: string }[];
  /** Méta-informations éventuelles (solde, compte) */
  meta: { accountId?: string; currency?: string; balance?: number; balanceDate?: string };
}

export class BankImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BankImportError";
  }
}

/**
 * Décode un fichier bancaire. Les banques françaises exportent souvent en
 * Windows-1252 / ISO-8859-1 : on tente l'UTF-8 strict puis on bascule.
 */
export function decodeBankFile(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.replace(/^﻿/, "");
}

const pad = (n: number) => String(n).padStart(2, "0");

function validDate(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Analyse une date de relevé. Ordre par défaut : jour/mois (usage français).
 * Formats : dd/mm/yyyy · dd/mm/yy · dd-mm-yyyy · dd.mm.yyyy · yyyy-mm-dd ·
 * yyyymmdd · "12 mars 2026"
 */
export function parseDate(input: string, order: "dmy" | "mdy" = "dmy"): string | null {
  const s = input.trim().toLowerCase();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return validDate(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return validDate(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{1,2})[-/.'](\d{1,2})[-/.'\s]*(\d{2,4})/);
  if (m) {
    let y = +m[3]!;
    if (m[3]!.length === 2) y += y < 70 ? 2000 : 1900;
    const a = +m[1]!;
    const b = +m[2]!;
    return order === "dmy" ? validDate(y, b, a) : validDate(y, a, b);
  }
  const months = ["jan", "fev", "mar", "avr", "mai", "juin", "juil", "aou", "sep", "oct", "nov", "dec"];
  const norm = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  m = norm.match(/^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})/);
  if (m) {
    const word = m[2]!;
    const idx = months.findIndex((p) => word.startsWith(p));
    if (idx >= 0) return validDate(+m[3]!, idx + 1, +m[1]!);
  }
  return null;
}

/** Nettoie un libellé bancaire pour l'affichage et la catégorisation. */
export function cleanLabel(raw: string): string {
  let s = raw.replace(/\s+/g, " ").trim();
  const wasUpper = s === s.toUpperCase();
  // Bruit : numéros de carte masqués, dates incrustées, références techniques
  s = s
    .replace(/\bX{1,}\d{4}\b/gi, " ")
    .replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, " ")
    .replace(/\s+(REF|RUM|ID EMETTEUR|ICS)[:\s]+\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Casse lisible : "LEROY MERLIN" → "Leroy Merlin"
  if (wasUpper) {
    s = s.toLowerCase().replace(/(^|[\s\-/'(])(\p{L})/gu, (_, sep: string, c: string) => sep + c.toUpperCase());
  }
  s = s
    .replace(/^(PRLV SEPA|PRELEVEMENT SEPA|PRELEVEMENT|PRLV)\s+/i, "Prélèvement ")
    .replace(/^(VIR SEPA RECU|VIREMENT SEPA RECU|VIR RECU|VIR INST RE|VIR SEPA)\s+(\/FRM\s+)?/i, "Virement reçu ")
    .replace(/^(VIR SEPA EMIS|VIREMENT EMIS|VIR EMIS)\s+(\/MOTIF\s+)?/i, "Virement émis ")
    .replace(/^(PAIEMENT PAR CARTE|PAIEMENT CB|CARTE|CB)\s+/i, "Carte ")
    .replace(/^(RETRAIT DAB|RETRAIT)\s+/i, "Retrait ")
    .replace(/^(REMISE CHEQUE|REM CHQ|REMISE CHQ)\s*/i, "Remise de chèque ")
    .replace(/^(CHEQUE|CHQ\.?)\s*/i, "Chèque ")
    .trim();
  return s.slice(0, 250) || raw.slice(0, 250);
}

/** FNV-1a 64 bits → hex (isomorphe, déterministe, sans dépendance). */
export function fnv1a64(input: string): string {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const bytes = new TextEncoder().encode(input);
  for (const b of bytes) {
    h ^= BigInt(b);
    h = (h * prime) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

function normForFingerprint(label: string): string {
  return label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
}

/**
 * Empreinte stable d'un mouvement, utilisée pour l'idempotence des imports.
 * Deux mouvements strictement identiques le même jour (ex. deux cotisations
 * de 20 € du même payeur) reçoivent des rangs d'occurrence différents.
 */
export function fingerprintTransactions(txs: ParsedTransaction[]): string[] {
  const counts = new Map<string, number>();
  return txs.map((t) => {
    if (t.bankId) return `id:${fnv1a64(t.bankId)}`;
    const base = `${t.date}|${t.amount}|${normForFingerprint(t.rawLabel)}`;
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return `h:${fnv1a64(`${base}|${n}`)}`;
  });
}

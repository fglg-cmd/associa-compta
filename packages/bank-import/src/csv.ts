/**
 * Parseur CSV de relevés bancaires, robuste aux exports des banques françaises
 * (Crédit Agricole, BNP, Société Générale, Crédit Mutuel, LCL, La Banque
 * Postale, Caisse d'Épargne, Qonto, Shine…) : séparateur auto, préambule,
 * colonnes débit/crédit séparées ou montant signé, dates jj/mm/aaaa.
 */
import { parseAmount } from "@associa/accounting";
import { BankImportError, cleanLabel, parseDate, type ParseResult, type ParsedTransaction } from "./common";

export interface CsvMapping {
  date: number;
  valueDate?: number;
  label: number;
  /** Colonnes de libellé complémentaires concaténées */
  extraLabels?: number[];
  amount?: number;
  debit?: number;
  credit?: number;
  /** Indice de la ligne d'en-tête (−1 si aucune) */
  headerRow: number;
  dateOrder: "dmy" | "mdy";
}

export interface CsvAnalysis {
  delimiter: string;
  rows: string[][];
  headers: string[];
  mapping: CsvMapping | null;
}

/** Découpe CSV conforme RFC 4180 (guillemets, guillemets doublés, retours ligne). */
export function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field.trim() === "") {
      inQuotes = true;
      field = "";
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows
    .map((r) => r.map((f) => f.trim()))
    .filter((r) => r.some((f) => f !== ""));
}

export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 30);
  const candidates = [";", ",", "\t", "|"];
  let best = ";";
  let bestScore = -1;
  for (const d of candidates) {
    const counts = sample.map((l) => splitCsv(l, d)[0]?.length ?? 1);
    const freq = new Map<number, number>();
    for (const c of counts) if (c > 1) freq.set(c, (freq.get(c) ?? 0) + 1);
    const [cols, occurrences] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0] ?? [1, 0];
    const score = occurrences * 10 + cols;
    if (occurrences > 0 && score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function findHeader(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = rows[i]!.map(norm);
    const hasDate = cells.some((c) => /^date|date$|^jour/.test(c));
    const hasMoney = cells.some((c) => /montant|debit|credit|amount|somme|valeur en|euros?$/.test(c));
    const hasLabel = cells.some((c) => /libell|description|intitul|nature|motif|detail|operation/.test(c));
    if (hasDate && (hasMoney || hasLabel)) return i;
  }
  return -1;
}

function mapFromHeader(headers: string[]): Omit<CsvMapping, "headerRow" | "dateOrder"> | null {
  const h = headers.map(norm);
  const find = (re: RegExp, exclude?: RegExp) => h.findIndex((c) => re.test(c) && !(exclude && exclude.test(c)));
  const date = (() => {
    const preferred = find(/date (d'?)?op|date comptable|^date$|date de l'operation|booking date|date operation/);
    return preferred >= 0 ? preferred : find(/date/, /valeur|value/);
  })();
  const valueDate = find(/valeur|value date/);
  const debit = find(/debit/);
  const credit = find(/credit/);
  const amount = find(/montant|amount|somme|valeur en/);
  let label = find(/libelle|description|intitule|motif|detail|nature|operation/, /date|type/);
  if (label < 0) label = find(/libell|tiers|beneficiaire|contrepartie|counterparty/);
  if (date < 0 || label < 0) return null;
  if (debit < 0 && credit < 0 && amount < 0) return null;
  const extraLabels = h
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => i !== label && /libelle (complementaire|2|interbancaire)|^info|complement|reference/.test(c))
    .map(({ i }) => i);
  return {
    date,
    valueDate: valueDate >= 0 && valueDate !== date ? valueDate : undefined,
    label,
    extraLabels,
    amount: debit >= 0 || credit >= 0 ? undefined : amount,
    debit: debit >= 0 ? debit : undefined,
    credit: credit >= 0 ? credit : undefined,
  };
}

function inferWithoutHeader(rows: string[][]): Omit<CsvMapping, "headerRow" | "dateOrder"> | null {
  const sample = rows.slice(0, 50);
  const width = Math.max(...sample.map((r) => r.length));
  const stats = Array.from({ length: width }, (_, i) => {
    const vals = sample.map((r) => r[i] ?? "").filter(Boolean);
    return {
      i,
      dates: vals.filter((v) => parseDate(v)).length,
      amounts: vals.filter((v) => /\d/.test(v) && parseAmount(v) !== null && !parseDate(v)).length,
      textLen: vals.reduce((t, v) => t + (/[a-z]/i.test(v) ? v.length : 0), 0),
    };
  });
  const date = [...stats].sort((a, b) => b.dates - a.dates)[0];
  const label = [...stats].sort((a, b) => b.textLen - a.textLen)[0];
  const amountCols = stats.filter((s) => s.amounts > sample.length * 0.3 && s.i !== date?.i);
  if (!date || !label || !date.dates || !amountCols.length) return null;
  if (amountCols.length >= 2) {
    return { date: date.i, label: label.i, debit: amountCols[0]!.i, credit: amountCols[1]!.i };
  }
  return { date: date.i, label: label.i, amount: amountCols[0]!.i };
}

function detectDateOrder(values: string[]): "dmy" | "mdy" {
  let dmy = 0;
  let mdy = 0;
  for (const v of values) {
    const m = v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]/);
    if (!m) continue;
    if (+m[1]! > 12) dmy++;
    if (+m[2]! > 12) mdy++;
  }
  return mdy > dmy ? "mdy" : "dmy";
}

export function analyzeCsv(text: string): CsvAnalysis {
  const delimiter = detectDelimiter(text);
  const rows = splitCsv(text, delimiter);
  if (!rows.length) throw new BankImportError("Le fichier est vide.");
  const headerRow = findHeader(rows);
  const headers = headerRow >= 0 ? rows[headerRow]! : rows[0]!.map((_, i) => `Colonne ${i + 1}`);
  const dataRows = headerRow >= 0 ? rows.slice(headerRow + 1) : rows;
  const base = headerRow >= 0 ? mapFromHeader(headers) : inferWithoutHeader(rows);
  const mapping: CsvMapping | null = base
    ? { ...base, headerRow, dateOrder: detectDateOrder(dataRows.map((r) => r[base.date] ?? "")) }
    : null;
  return { delimiter, rows, headers, mapping };
}

export function parseCsv(text: string, mappingOverride?: CsvMapping): ParseResult {
  const analysis = analyzeCsv(text);
  const mapping = mappingOverride ?? analysis.mapping;
  if (!mapping) {
    throw new BankImportError(
      "Colonnes non reconnues : indiquez quelles colonnes contiennent la date, le libellé et le montant.",
    );
  }
  const transactions: ParsedTransaction[] = [];
  const skipped: ParseResult["skipped"] = [];
  const start = mapping.headerRow + 1;

  analysis.rows.slice(start).forEach((row, idx) => {
    const line = start + idx + 1;
    const date = parseDate(row[mapping.date] ?? "", mapping.dateOrder);
    if (!date) {
      skipped.push({ line, reason: "date absente ou invalide" });
      return;
    }
    let amount: number | null = null;
    if (mapping.amount !== undefined) {
      amount = parseAmount(row[mapping.amount] ?? "");
    } else {
      const d = mapping.debit !== undefined ? parseAmount(row[mapping.debit] ?? "") : null;
      const c = mapping.credit !== undefined ? parseAmount(row[mapping.credit] ?? "") : null;
      if (d) amount = -Math.abs(d);
      else if (c) amount = Math.abs(c);
    }
    if (!amount) {
      skipped.push({ line, reason: "montant absent ou nul" });
      return;
    }
    const parts = [row[mapping.label] ?? "", ...(mapping.extraLabels ?? []).map((i) => row[i] ?? "")]
      .map((s) => s.trim())
      .filter(Boolean);
    const rawLabel = parts.join(" ").replace(/\s+/g, " ") || "Opération";
    const valueDate = mapping.valueDate !== undefined ? parseDate(row[mapping.valueDate] ?? "", mapping.dateOrder) ?? undefined : undefined;
    transactions.push({ date, valueDate, rawLabel, label: cleanLabel(rawLabel), amount });
  });

  if (!transactions.length) {
    throw new BankImportError("Aucune opération lisible dans ce fichier.");
  }
  return { format: "csv", transactions, skipped, meta: {} };
}

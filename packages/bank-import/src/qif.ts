/**
 * Parseur QIF (Quicken Interchange Format). Les banques françaises exportent
 * en jj/mm/aaaa ; l'ordre est déduit des données si ambigu.
 */
import { parseAmount } from "@associa/accounting";
import { BankImportError, cleanLabel, parseDate, type ParseResult, type ParsedTransaction } from "./common";

interface RawQif {
  D?: string;
  T?: string;
  P?: string;
  M?: string;
  N?: string;
  line: number;
}

export function parseQif(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const records: RawQif[] = [];
  let cur: RawQif = { line: 1 };
  lines.forEach((l, i) => {
    if (!l.trim() || l.startsWith("!")) return;
    const code = l[0]!;
    const value = l.slice(1).trim();
    if (code === "^") {
      if (cur.D || cur.T) records.push(cur);
      cur = { line: i + 2 };
      return;
    }
    if (code === "D") cur.D = value;
    else if (code === "T" || code === "U") cur.T ??= value;
    else if (code === "P") cur.P = value;
    else if (code === "M") cur.M = value;
    else if (code === "N") cur.N = value;
  });
  if (cur.D || cur.T) records.push(cur);
  if (!records.length) throw new BankImportError("Fichier QIF vide ou invalide.");

  // Ordre de date : si une première composante > 12, c'est jj/mm.
  let mdy = 0;
  let dmy = 0;
  for (const r of records) {
    const m = r.D?.match(/^(\d{1,2})[/.\-'](\d{1,2})/);
    if (!m) continue;
    if (+m[1]! > 12) dmy++;
    if (+m[2]! > 12) mdy++;
  }
  const order = mdy > dmy ? "mdy" : "dmy";

  const transactions: ParsedTransaction[] = [];
  const skipped: ParseResult["skipped"] = [];
  for (const r of records) {
    const date = r.D ? parseDate(r.D.replace(/'/g, "/").replace(/\s/g, ""), order) : null;
    const amount = parseAmount(r.T ?? "");
    if (!date || !amount) {
      skipped.push({ line: r.line, reason: "opération QIF incomplète" });
      continue;
    }
    const rawLabel = [r.P, r.M && r.M !== r.P ? r.M : ""].filter(Boolean).join(" ").trim() || (r.N ? `Chèque ${r.N}` : "Opération");
    transactions.push({ date, rawLabel, label: cleanLabel(rawLabel), amount, counterparty: r.P ? cleanLabel(r.P) : undefined });
  }
  if (!transactions.length) throw new BankImportError("Aucune opération lisible dans ce fichier QIF.");
  return { format: "qif", transactions, skipped, meta: {} };
}

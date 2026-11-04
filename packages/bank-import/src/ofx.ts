/**
 * Parseur OFX 1.x (SGML, balises non fermées) et OFX 2.x (XML).
 */
import { parseAmount } from "@associa/accounting";
import { BankImportError, cleanLabel, parseDate, type ParseResult, type ParsedTransaction } from "./common";

function tag(block: string, name: string): string | undefined {
  // <NAME>valeur  (jusqu'à '<' ou fin de ligne), fermant optionnel
  const re = new RegExp(`<${name}>([^<\\r\\n]*)`, "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1]!.trim()) : undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function ofxDate(v: string | undefined): string | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? parseDate(`${m[1]}-${m[2]}-${m[3]}`) : null;
}

export function parseOfx(text: string): ParseResult {
  if (!/<OFX>/i.test(text)) throw new BankImportError("Fichier OFX invalide (balise <OFX> absente).");
  const transactions: ParsedTransaction[] = [];
  const skipped: ParseResult["skipped"] = [];

  const blocks = text.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]!);
  blocks.forEach((b, i) => {
    const date = ofxDate(tag(b, "DTPOSTED"));
    const amount = parseAmount(tag(b, "TRNAMT") ?? "");
    if (!date || !amount) {
      skipped.push({ line: i + 1, reason: "transaction OFX incomplète" });
      return;
    }
    const name = tag(b, "NAME") ?? "";
    const memo = tag(b, "MEMO") ?? "";
    const rawLabel = [name, memo && memo !== name ? memo : ""].filter(Boolean).join(" ").trim() || tag(b, "TRNTYPE") || "Opération";
    const fitid = tag(b, "FITID");
    transactions.push({
      date,
      valueDate: ofxDate(tag(b, "DTUSER")) ?? undefined,
      rawLabel,
      label: cleanLabel(rawLabel),
      amount,
      bankId: fitid ? `${tag(text, "ACCTID") ?? ""}:${fitid}` : undefined,
      counterparty: name ? cleanLabel(name) : undefined,
    });
  });

  if (!transactions.length) throw new BankImportError("Aucune opération dans ce fichier OFX.");

  const ledger = text.match(/<LEDGERBAL>([\s\S]*?)(<\/LEDGERBAL>|<AVAILBAL>|$)/i)?.[1];
  return {
    format: "ofx",
    transactions,
    skipped,
    meta: {
      accountId: tag(text, "ACCTID"),
      currency: tag(text, "CURDEF"),
      balance: ledger ? parseAmount(tag(ledger, "BALAMT") ?? "") ?? undefined : undefined,
      balanceDate: ledger ? ofxDate(tag(ledger, "DTASOF")) ?? undefined : undefined,
    },
  };
}

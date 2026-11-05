import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAll } from "@/lib/fetch-all";
import type { FiscalYear } from "@/lib/types";
import { getStatements, getTrialBalance } from "../accounting/queries";

export interface Table {
  title: string;
  columns: { key: string; label: string; type?: "money" | "date" | "text" | "number"; width?: number }[];
  rows: Record<string, string | number | null>[];
  totals?: Record<string, number | string>;
}

const ymd = (d: string) => d.replaceAll("-", "");
const fecAmount = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export async function buildTables(orgId: string, fy: FiscalYear, report: string): Promise<Table[]> {
  const supabase = await createClient();

  if (report === "balance") {
    const rows = await getTrialBalance(orgId, fy.start_date, fy.end_date);
    return [{
      title: `Balance générale — ${fy.label}`,
      columns: [
        { key: "number", label: "Compte", width: 12 }, { key: "label", label: "Intitulé", width: 44 },
        { key: "debit", label: "Débit", type: "money" }, { key: "credit", label: "Crédit", type: "money" },
        { key: "sd", label: "Solde débiteur", type: "money" }, { key: "sc", label: "Solde créditeur", type: "money" },
      ],
      rows: rows.map((r) => ({ number: r.number, label: r.label, debit: r.debit, credit: r.credit, sd: Math.max(r.debit - r.credit, 0), sc: Math.max(r.credit - r.debit, 0) })),
      totals: { label: "Totaux", debit: rows.reduce((t, r) => t + r.debit, 0), credit: rows.reduce((t, r) => t + r.credit, 0) },
    }];
  }

  if (report === "grand-livre" || report === "journal" || report === "operations") {
    const rows = await fetchAll<Record<string, string | number | null>>((a, b) =>
      supabase.from("v_ledger_lines").select("date, journal_code, entry_number, account_number, account_label, label, reference, debit, credit").eq("organization_id", orgId).eq("fiscal_year_id", fy.id).eq("status", "posted")
        .order(report === "grand-livre" ? "account_number" : "journal_code").order("date").order("entry_number").order("line_no").range(a, b));
    return [{
      title: `${report === "grand-livre" ? "Grand livre" : "Journal général"} — ${fy.label}`,
      columns: [
        { key: "date", label: "Date", type: "date", width: 12 }, { key: "journal_code", label: "Journal", width: 8 }, { key: "entry_number", label: "N°", type: "number", width: 7 },
        { key: "account_number", label: "Compte", width: 10 }, { key: "account_label", label: "Intitulé du compte", width: 32 }, { key: "label", label: "Libellé", width: 44 },
        { key: "reference", label: "Pièce", width: 14 }, { key: "debit", label: "Débit", type: "money" }, { key: "credit", label: "Crédit", type: "money" },
      ],
      rows: rows.map((r) => ({ ...r, debit: Number(r.debit), credit: Number(r.credit) })),
      totals: { label: "Totaux", debit: rows.reduce((t, r) => t + Number(r.debit), 0), credit: rows.reduce((t, r) => t + Number(r.credit), 0) },
    }];
  }

  if (report === "compte-resultat" || report === "bilan") {
    const st = await getStatements(orgId, fy);
    if (report === "compte-resultat") {
      const is = st.income;
      const rows: Table["rows"] = [];
      const push = (label: string, amount: number | null, level = 1) => rows.push({ label: `${"  ".repeat(level - 1)}${label}`, amount });
      push(is.operatingIncome.label, null, 1);
      for (const l of is.operatingIncome.lines) push(l.label, l.amount, 2);
      push("Total des produits d'exploitation", is.operatingIncome.total, 1);
      push(is.operatingExpenses.label, null, 1);
      for (const l of is.operatingExpenses.lines) push(l.label, l.amount, 2);
      push("Total des charges d'exploitation", is.operatingExpenses.total, 1);
      push("RÉSULTAT D'EXPLOITATION", is.operatingResult, 1);
      push("Produits financiers", is.financialIncome, 2);
      push("Charges financières", is.financialExpenses, 2);
      push("RÉSULTAT FINANCIER", is.financialResult, 1);
      push("Produits exceptionnels", is.exceptionalIncome, 2);
      push("Charges exceptionnelles", is.exceptionalExpenses, 2);
      push("RÉSULTAT EXCEPTIONNEL", is.exceptionalResult, 1);
      push("Impôts sur les bénéfices", is.incomeTax, 2);
      push(is.netResult >= 0 ? "EXCÉDENT DE L'EXERCICE" : "DÉFICIT DE L'EXERCICE", is.netResult, 1);
      if (is.inKind.contributions || is.inKind.uses) {
        push("Contributions volontaires en nature", null, 1);
        push("Contributions reçues", is.inKind.contributions, 2);
        push("Emplois des contributions", is.inKind.uses, 2);
      }
      return [{ title: `Compte de résultat — ${fy.label}`, columns: [{ key: "label", label: "Rubrique", width: 60 }, { key: "amount", label: "Montant", type: "money" }], rows }];
    }
    const bs = st.balance;
    const side = (sections: typeof bs.assets) => sections.flatMap((s) => [{ label: s.label, amount: null }, ...s.lines.filter((l) => l.amount !== 0).map((l) => ({ label: `  ${l.label}`, amount: l.amount })), { label: `Total ${s.label.toLowerCase()}`, amount: s.total }]);
    return [
      { title: `Bilan au ${fy.end_date.split("-").reverse().join("/")} — Actif`, columns: [{ key: "label", label: "Actif", width: 60 }, { key: "amount", label: "Net", type: "money" }], rows: side(bs.assets), totals: { label: "TOTAL ACTIF", amount: bs.totalAssets } },
      { title: "Bilan — Passif", columns: [{ key: "label", label: "Passif", width: 60 }, { key: "amount", label: "Montant", type: "money" }], rows: side(bs.liabilities), totals: { label: "TOTAL PASSIF", amount: bs.totalLiabilities } },
    ];
  }

  if (report === "adherents") {
    const { data } = await supabase.from("members").select("member_number, last_name, first_name, email, phone, address_line, postal_code, city, joined_at, status").eq("organization_id", orgId).order("last_name");
    return [{
      title: "Liste des adhérents",
      columns: [
        { key: "member_number", label: "N°", type: "number", width: 7 }, { key: "last_name", label: "Nom", width: 20 }, { key: "first_name", label: "Prénom", width: 18 },
        { key: "email", label: "E-mail", width: 30 }, { key: "phone", label: "Téléphone", width: 16 }, { key: "address_line", label: "Adresse", width: 32 },
        { key: "postal_code", label: "CP", width: 8 }, { key: "city", label: "Ville", width: 18 }, { key: "joined_at", label: "Adhésion", type: "date", width: 12 }, { key: "status", label: "Statut", width: 10 },
      ],
      rows: (data ?? []) as Table["rows"],
    }];
  }

  throw new Error("Rapport inconnu");
}

/** Fichier des écritures comptables (article A47 A-1 du LPF). */
export async function buildFec(orgId: string, fy: FiscalYear): Promise<string> {
  const supabase = await createClient();
  const { data: journals } = await supabase.from("journals").select("code, label").eq("organization_id", orgId);
  const jl = new Map((journals ?? []).map((j) => [j.code as string, j.label as string]));
  const data = await fetchAll((a, b) => supabase.from("journal_entries")
    .select("date, entry_number, label, reference, posted_at, journals(code), entry_lines(line_no, label, debit, credit, accounts(number, label))")
    .eq("organization_id", orgId).eq("fiscal_year_id", fy.id).eq("status", "posted").order("date").order("entry_number").order("id").range(a, b));
  const header = ["JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib", "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit", "EcritureLet", "DateLet", "ValidDate", "Montantdevise", "Idevise"];
  const clean = (s: string | null | undefined) => (s ?? "").replace(/[\t\r\n|]/g, " ").trim();
  const out = [header.join("\t")];
  for (const e of (data ?? []) as unknown as { date: string; entry_number: number; label: string; reference: string | null; posted_at: string; journals: { code: string }; entry_lines: { line_no: number; label: string | null; debit: number; credit: number; accounts: { number: string; label: string } }[] }[]) {
    const code = e.journals.code;
    for (const l of [...e.entry_lines].sort((a, b) => a.line_no - b.line_no)) {
      out.push([
        code, clean(jl.get(code)), `${code}${String(e.entry_number).padStart(6, "0")}`, ymd(e.date), l.accounts.number.padEnd(3, "0"), clean(l.accounts.label), "", "",
        clean(e.reference) || `${code}${e.entry_number}`, ymd(e.date), clean(l.label ?? e.label), fecAmount(Number(l.debit)), fecAmount(Number(l.credit)), "", "", ymd(e.posted_at.slice(0, 10)), "", "",
      ].join("\t"));
    }
  }
  return out.join("\r\n") + "\r\n";
}

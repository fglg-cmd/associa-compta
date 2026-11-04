/**
 * États financiers : compte de résultat et bilan, présentés selon le
 * règlement ANC 2018-06, calculés à partir de la balance générale.
 */
import type { Cents } from "./money";

export interface TrialRow {
  number: string;
  label: string;
  debit: Cents;
  credit: Cents;
}

export interface StatementDetail {
  number: string;
  label: string;
  amount: Cents;
}

export interface StatementLine {
  key: string;
  label: string;
  amount: Cents;
  details: StatementDetail[];
}

export interface StatementSection {
  key: string;
  label: string;
  lines: StatementLine[];
  total: Cents;
}

// ---------------------------------------------------------------------------
// Compte de résultat
// ---------------------------------------------------------------------------

interface LineDef {
  key: string;
  label: string;
  prefixes: string[];
}

const INCOME_LINES: LineDef[] = [
  { key: "cotisations", label: "Cotisations", prefixes: ["756"] },
  { key: "ventes", label: "Ventes de biens et prestations de services", prefixes: ["70"] },
  { key: "subventions", label: "Subventions et produits de tiers financeurs", prefixes: ["74", "755"] },
  { key: "generosite", label: "Ressources liées à la générosité du public", prefixes: ["754"] },
  { key: "fonds_dedies_utilises", label: "Utilisations des fonds dédiés", prefixes: ["789"] },
  { key: "reprises", label: "Reprises sur amortissements, provisions et transferts", prefixes: ["78", "79"] },
  { key: "autres_produits", label: "Autres produits", prefixes: ["71", "72", "73", "75"] },
];

const EXPENSE_LINES: LineDef[] = [
  { key: "achats", label: "Achats", prefixes: ["60"] },
  { key: "services", label: "Services extérieurs et autres services", prefixes: ["61", "62"] },
  { key: "impots", label: "Impôts, taxes et versements assimilés", prefixes: ["63"] },
  { key: "personnel", label: "Salaires et charges sociales", prefixes: ["64"] },
  { key: "aides", label: "Aides financières accordées", prefixes: ["657"] },
  { key: "reports_fonds_dedies", label: "Reports en fonds dédiés", prefixes: ["689"] },
  { key: "dotations", label: "Dotations aux amortissements et provisions", prefixes: ["68"] },
  { key: "autres_charges", label: "Autres charges", prefixes: ["65"] },
];

function matchLine(number: string, defs: LineDef[]): LineDef | undefined {
  let best: LineDef | undefined;
  let bestLen = 0;
  for (const d of defs) {
    for (const p of d.prefixes) {
      if (number.startsWith(p) && p.length > bestLen) {
        best = d;
        bestLen = p.length;
      }
    }
  }
  return best;
}

function buildLines(rows: TrialRow[], defs: LineDef[], sign: 1 | -1): StatementLine[] {
  const lines = new Map<string, StatementLine>(
    defs.map((d) => [d.key, { key: d.key, label: d.label, amount: 0, details: [] }]),
  );
  for (const r of rows) {
    const def = matchLine(r.number, defs);
    if (!def) continue;
    const amount = sign * (r.credit - r.debit);
    if (amount === 0) continue;
    const line = lines.get(def.key)!;
    line.amount += amount;
    line.details.push({ number: r.number, label: r.label, amount });
  }
  return defs.map((d) => lines.get(d.key)!);
}

function section(key: string, label: string, lines: StatementLine[]): StatementSection {
  return { key, label, lines, total: lines.reduce((t, l) => t + l.amount, 0) };
}

export interface IncomeStatement {
  operatingIncome: StatementSection;
  operatingExpenses: StatementSection;
  operatingResult: Cents;
  financialIncome: Cents;
  financialExpenses: Cents;
  financialResult: Cents;
  exceptionalIncome: Cents;
  exceptionalExpenses: Cents;
  exceptionalResult: Cents;
  incomeTax: Cents;
  totalIncome: Cents;
  totalExpenses: Cents;
  netResult: Cents;
  inKind: { contributions: Cents; uses: Cents };
}

function net(rows: TrialRow[], prefix: string, sign: 1 | -1): Cents {
  return rows
    .filter((r) => r.number.startsWith(prefix))
    .reduce((t, r) => t + sign * (r.credit - r.debit), 0);
}

/** @param rows balance des comptes sur la période (exercice) */
export function buildIncomeStatement(rows: TrialRow[]): IncomeStatement {
  const income = rows.filter((r) => r.number.startsWith("7") && !/^7[67]/.test(r.number));
  const expense = rows.filter((r) => r.number.startsWith("6") && !/^6[679]/.test(r.number));

  const operatingIncome = section("operating_income", "Produits d'exploitation", buildLines(income, INCOME_LINES, 1));
  const operatingExpenses = section("operating_expenses", "Charges d'exploitation", buildLines(expense, EXPENSE_LINES, -1));

  const financialIncome = net(rows, "76", 1);
  const financialExpenses = net(rows, "66", -1);
  const exceptionalIncome = net(rows, "77", 1);
  const exceptionalExpenses = net(rows, "67", -1);
  const incomeTax = net(rows, "69", -1);

  const operatingResult = operatingIncome.total - operatingExpenses.total;
  const financialResult = financialIncome - financialExpenses;
  const exceptionalResult = exceptionalIncome - exceptionalExpenses;
  const totalIncome = operatingIncome.total + financialIncome + exceptionalIncome;
  const totalExpenses = operatingExpenses.total + financialExpenses + exceptionalExpenses + incomeTax;

  return {
    operatingIncome,
    operatingExpenses,
    operatingResult,
    financialIncome,
    financialExpenses,
    financialResult,
    exceptionalIncome,
    exceptionalExpenses,
    exceptionalResult,
    incomeTax,
    totalIncome,
    totalExpenses,
    netResult: totalIncome - totalExpenses,
    inKind: { contributions: net(rows, "87", 1), uses: net(rows, "86", -1) },
  };
}

// ---------------------------------------------------------------------------
// Bilan
// ---------------------------------------------------------------------------

export interface BalanceSheet {
  assets: StatementSection[];
  liabilities: StatementSection[];
  totalAssets: Cents;
  totalLiabilities: Cents;
  currentResult: Cents;
  balanced: boolean;
}

type Side = "asset" | "liability";

interface Placement {
  side: Side;
  section: string;
  line: string;
}

const SECTIONS: Record<string, { side: Side; label: string; lines: Record<string, string> }> = {
  fixed: {
    side: "asset",
    label: "Actif immobilisé",
    lines: { intangible: "Immobilisations incorporelles", tangible: "Immobilisations corporelles", financial: "Immobilisations financières" },
  },
  current: {
    side: "asset",
    label: "Actif circulant",
    lines: {
      stocks: "Stocks",
      receivables: "Créances (usagers, subventions à recevoir, autres)",
      securities: "Valeurs mobilières de placement",
      cash: "Disponibilités",
      prepaid: "Charges constatées d'avance",
    },
  },
  equity: {
    side: "liability",
    label: "Fonds propres",
    lines: {
      funds: "Fonds propres et réserves",
      carried: "Report à nouveau",
      result: "Résultat de l'exercice",
      grants: "Subventions d'investissement",
    },
  },
  provisions: {
    side: "liability",
    label: "Fonds reportés, fonds dédiés et provisions",
    lines: { provisions: "Provisions pour risques et charges", dedicated: "Fonds reportés et fonds dédiés" },
  },
  debts: {
    side: "liability",
    label: "Dettes",
    lines: {
      loans: "Emprunts et dettes financières",
      bank_overdraft: "Concours bancaires courants",
      suppliers: "Dettes fournisseurs",
      tax_social: "Dettes fiscales et sociales",
      other: "Autres dettes",
      deferred: "Produits constatés d'avance",
    },
  },
};

function place(number: string, balance: Cents): Placement | null {
  const n = number;
  const debitBal = balance >= 0;
  // Classe 1
  if (/^1[0]/.test(n)) return { side: "liability", section: "equity", line: "funds" };
  if (/^11/.test(n)) return { side: "liability", section: "equity", line: "carried" };
  if (/^12/.test(n)) return { side: "liability", section: "equity", line: "result" };
  if (/^13/.test(n)) return { side: "liability", section: "equity", line: "grants" };
  if (/^1[45]/.test(n)) return { side: "liability", section: "provisions", line: "provisions" };
  if (/^19/.test(n)) return { side: "liability", section: "provisions", line: "dedicated" };
  if (/^1[678]/.test(n)) return { side: "liability", section: "debts", line: "loans" };
  // Classe 2 (amortissements 28x/29x imputés en moins sur leur groupe)
  if (/^2/.test(n)) {
    const group = /^2[89]/.test(n) ? n[2] ?? "1" : n[1] ?? "1";
    const line = group === "0" ? "intangible" : group === "6" || group === "7" ? "financial" : "tangible";
    return { side: "asset", section: "fixed", line };
  }
  if (/^3/.test(n)) return { side: "asset", section: "current", line: "stocks" };
  // Classe 4
  if (/^486/.test(n)) return { side: "asset", section: "current", line: "prepaid" };
  if (/^487/.test(n)) return { side: "liability", section: "debts", line: "deferred" };
  if (/^4/.test(n)) {
    if (debitBal) return { side: "asset", section: "current", line: "receivables" };
    if (/^40/.test(n)) return { side: "liability", section: "debts", line: "suppliers" };
    if (/^4[234]/.test(n)) return { side: "liability", section: "debts", line: "tax_social" };
    return { side: "liability", section: "debts", line: "other" };
  }
  // Classe 5
  if (/^50/.test(n)) return { side: "asset", section: "current", line: "securities" };
  if (/^5/.test(n)) {
    if (debitBal) return { side: "asset", section: "current", line: "cash" };
    return { side: "liability", section: "debts", line: "bank_overdraft" };
  }
  return null;
}

/**
 * @param cumulative   balance cumulée depuis l'origine jusqu'à la date du bilan
 * @param periodStart  première date de l'exercice (pour séparer résultat courant / antérieur)
 * @param priorResult  Σ(produits − charges) des exercices antérieurs, non encore affecté
 *                     par écriture (calculé par l'appelant : classes 6-7 avant periodStart)
 * @param currentRows  balance de l'exercice en cours (classes 6-7 utilisées)
 */
export function buildBalanceSheet(params: {
  cumulative: TrialRow[];
  currentRows: TrialRow[];
  priorResult: Cents;
}): BalanceSheet {
  const { cumulative, currentRows, priorResult } = params;

  const acc: Record<string, Record<string, StatementLine>> = {};
  for (const [sk, s] of Object.entries(SECTIONS)) {
    acc[sk] = {};
    for (const [lk, label] of Object.entries(s.lines)) {
      acc[sk]![lk] = { key: lk, label, amount: 0, details: [] };
    }
  }

  for (const r of cumulative) {
    if (!/^[1-5]/.test(r.number)) continue;
    const balance = r.debit - r.credit;
    if (balance === 0) continue;
    const p = place(r.number, balance);
    if (!p) continue;
    const amount = p.side === "asset" ? balance : -balance;
    const line = acc[p.section]![p.line]!;
    line.amount += amount;
    line.details.push({ number: r.number, label: r.label, amount });
  }

  const currentResult = currentRows
    .filter((r) => /^[67]/.test(r.number))
    .reduce((t, r) => t + (r.credit - r.debit), 0);

  if (priorResult !== 0) {
    const l = acc.equity!.carried!;
    l.amount += priorResult;
    l.details.push({ number: "11", label: "Résultats antérieurs non affectés", amount: priorResult });
  }
  if (currentResult !== 0) {
    const l = acc.equity!.result!;
    l.amount += currentResult;
    l.details.push({ number: "12", label: currentResult >= 0 ? "Excédent de l'exercice" : "Déficit de l'exercice", amount: currentResult });
  }

  const toSections = (side: Side) =>
    Object.entries(SECTIONS)
      .filter(([, s]) => s.side === side)
      .map(([sk, s]) => section(sk, s.label, Object.values(acc[sk]!)));

  const assets = toSections("asset");
  const liabilities = toSections("liability");
  const totalAssets = assets.reduce((t, s) => t + s.total, 0);
  const totalLiabilities = liabilities.reduce((t, s) => t + s.total, 0);

  return {
    assets,
    liabilities,
    totalAssets,
    totalLiabilities,
    currentResult,
    balanced: totalAssets === totalLiabilities,
  };
}

// ---------------------------------------------------------------------------
// Grand livre
// ---------------------------------------------------------------------------

export interface LedgerLineInput {
  accountNumber: string;
  accountLabel: string;
  date: string;
  journalCode: string;
  entryNumber: number | null;
  label: string;
  debit: Cents;
  credit: Cents;
}

export interface LedgerAccount {
  number: string;
  label: string;
  lines: (LedgerLineInput & { balance: Cents })[];
  totalDebit: Cents;
  totalCredit: Cents;
  balance: Cents;
}

export function buildLedger(lines: LedgerLineInput[]): LedgerAccount[] {
  const map = new Map<string, LedgerAccount>();
  const sorted = [...lines].sort(
    (a, b) =>
      a.accountNumber.localeCompare(b.accountNumber) ||
      a.date.localeCompare(b.date) ||
      (a.entryNumber ?? 0) - (b.entryNumber ?? 0),
  );
  for (const l of sorted) {
    let acc = map.get(l.accountNumber);
    if (!acc) {
      acc = { number: l.accountNumber, label: l.accountLabel, lines: [], totalDebit: 0, totalCredit: 0, balance: 0 };
      map.set(l.accountNumber, acc);
    }
    acc.totalDebit += l.debit;
    acc.totalCredit += l.credit;
    acc.balance += l.debit - l.credit;
    acc.lines.push({ ...l, balance: acc.balance });
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Validation côté client (le serveur reste l'autorité)
// ---------------------------------------------------------------------------

export interface DraftLine {
  accountId: string;
  debit: Cents;
  credit: Cents;
}

export type EntryValidation = { ok: true } | { ok: false; error: string };

export function validateEntry(lines: DraftLine[]): EntryValidation {
  const filled = lines.filter((l) => l.accountId && (l.debit > 0 || l.credit > 0));
  if (filled.length < 2) return { ok: false, error: "Une écriture comporte au moins deux lignes." };
  for (const l of filled) {
    if (!Number.isInteger(l.debit) || !Number.isInteger(l.credit)) return { ok: false, error: "Montants invalides." };
    if (l.debit < 0 || l.credit < 0) return { ok: false, error: "Les montants doivent être positifs." };
    if (l.debit > 0 && l.credit > 0) return { ok: false, error: "Une ligne est soit au débit, soit au crédit." };
  }
  const d = filled.reduce((t, l) => t + l.debit, 0);
  const c = filled.reduce((t, l) => t + l.credit, 0);
  if (d !== c) return { ok: false, error: `Écriture déséquilibrée : écart de ${((d - c) / 100).toFixed(2).replace(".", ",")} €.` };
  return { ok: true };
}

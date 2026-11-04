import { describe, expect, it } from "vitest";
import {
  ASSOCIATION_CHART,
  CATEGORIES,
  allocate,
  buildBalanceSheet,
  buildIncomeStatement,
  buildLedger,
  defaultFiscalYear,
  detectAnomalies,
  forecastTreasury,
  formatEUR,
  parseAmount,
  validateEntry,
  type TrialRow,
} from "./index";

describe("parseAmount", () => {
  it.each([
    ["1 234,56", 123456],
    ["1.234,56", 123456],
    ["1,234.56", 123456],
    ["-12,5", -1250],
    ["12.50", 1250],
    ["12,5 €", 1250],
    ["(45,00)", -4500],
    ["+3", 300],
    ["1 000,00", 100000],
    ["0,01", 1],
    ["1.234", 123400],
    ["45,00-", -4500],
    ["2,345", 234500],
    ["10,005", 1000500],
    ["3.14159", 314],
  ])("%s → %d", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it("refuse les non-montants", () => {
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("12/03/2026")).toBeNull();
  });

  it("évite les erreurs de flottant", () => {
    expect(parseAmount(0.1)! + parseAmount(0.2)!).toBe(30);
  });
});

describe("formatEUR", () => {
  it("formate à la française", () => {
    expect(formatEUR(123456).replace(/\s/g, " ")).toBe("1 234,56 €");
    expect(formatEUR(-500).replace(/\s/g, " ")).toBe("-5,00 €");
  });
});

describe("allocate", () => {
  it("répartit sans perte de centime", () => {
    const parts = allocate(1000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(parts).toEqual([334, 333, 333]);
  });
});

describe("plan comptable", () => {
  it("est cohérent", () => {
    const numbers = ASSOCIATION_CHART.map((a) => a.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    for (const a of ASSOCIATION_CHART) expect(a.number).toMatch(/^[1-8][0-9]{1,9}$/);
    for (const c of CATEGORIES) expect(numbers).toContain(c.account);
    // Comptes requis par les fonctions SQL
    for (const n of ["110", "530", "756"]) expect(numbers).toContain(n);
  });
});

describe("validateEntry", () => {
  it("accepte une écriture équilibrée", () => {
    expect(validateEntry([
      { accountId: "a", debit: 1000, credit: 0 },
      { accountId: "b", debit: 0, credit: 1000 },
    ])).toEqual({ ok: true });
  });
  it("refuse une écriture déséquilibrée", () => {
    const r = validateEntry([
      { accountId: "a", debit: 1000, credit: 0 },
      { accountId: "b", debit: 0, credit: 999 },
    ]);
    expect(r.ok).toBe(false);
  });
  it("refuse débit et crédit sur la même ligne", () => {
    expect(validateEntry([
      { accountId: "a", debit: 10, credit: 10 },
      { accountId: "b", debit: 0, credit: 0 },
    ]).ok).toBe(false);
  });
});

// Scénario : association avec 1 000 € d'ouverture, cotisations, subvention,
// achats, matériel amorti, facture fournisseur non payée.
const period: TrialRow[] = [
  { number: "756", label: "Cotisations", debit: 0, credit: 300000 },
  { number: "744", label: "Subvention commune", debit: 0, credit: 150000 },
  { number: "7541", label: "Dons", debit: 0, credit: 20000 },
  { number: "768", label: "Intérêts", debit: 0, credit: 1500 },
  { number: "6063", label: "Petit équipement", debit: 80000, credit: 0 },
  { number: "616", label: "Assurance", debit: 45000, credit: 0 },
  { number: "627", label: "Frais bancaires", debit: 6000, credit: 0 },
  { number: "681", label: "Dotations", debit: 20000, credit: 0 },
  { number: "671", label: "Pénalité", debit: 1500, credit: 0 },
];

describe("compte de résultat", () => {
  const is = buildIncomeStatement(period);
  it("classe les produits et charges", () => {
    expect(is.operatingIncome.lines.find((l) => l.key === "cotisations")!.amount).toBe(300000);
    expect(is.operatingIncome.lines.find((l) => l.key === "subventions")!.amount).toBe(150000);
    expect(is.operatingIncome.lines.find((l) => l.key === "generosite")!.amount).toBe(20000);
    expect(is.operatingExpenses.lines.find((l) => l.key === "services")!.amount).toBe(51000);
    expect(is.operatingExpenses.lines.find((l) => l.key === "dotations")!.amount).toBe(20000);
  });
  it("calcule les résultats intermédiaires", () => {
    expect(is.operatingResult).toBe(470000 - 151000);
    expect(is.financialResult).toBe(1500);
    expect(is.exceptionalResult).toBe(-1500);
    expect(is.netResult).toBe(470000 + 1500 - 151000 - 1500);
  });
});

describe("bilan", () => {
  // Cumul depuis l'origine : 1 000 € d'ouverture, flux de l'exercice en banque
  // sauf une facture d'assurance non payée (401) et du matériel 2183 amorti.
  const bankFlows = 300000 + 150000 + 20000 + 1500 - 80000 - 6000 - 1500 - 100000;
  const cumulative: TrialRow[] = [
    { number: "110", label: "Report à nouveau", debit: 0, credit: 100000 },
    { number: "5121", label: "Banque", debit: 100000 + 471500, credit: 187500 },
    { number: "2183", label: "Matériel informatique", debit: 100000, credit: 0 },
    { number: "28183", label: "Amortissements", debit: 0, credit: 20000 },
    { number: "401", label: "Fournisseurs", debit: 0, credit: 45000 },
    ...period,
  ];

  it("est équilibré et intègre le résultat", () => {
    expect(100000 + 471500 - 187500).toBe(100000 + bankFlows);
    const bs = buildBalanceSheet({ cumulative, currentRows: period, priorResult: 0 });
    expect(bs.currentResult).toBe(319000);
    expect(bs.balanced).toBe(true);
    const fixed = bs.assets.find((s) => s.key === "fixed")!;
    expect(fixed.lines.find((l) => l.key === "tangible")!.amount).toBe(80000);
    const debts = bs.liabilities.find((s) => s.key === "debts")!;
    expect(debts.lines.find((l) => l.key === "suppliers")!.amount).toBe(45000);
  });

  it("présente un découvert au passif", () => {
    const bs = buildBalanceSheet({
      cumulative: [
        { number: "5121", label: "Banque", debit: 0, credit: 5000 },
        { number: "606", label: "Achats", debit: 5000, credit: 0 },
      ],
      currentRows: [{ number: "606", label: "Achats", debit: 5000, credit: 0 }],
      priorResult: 0,
    });
    expect(bs.balanced).toBe(true);
    expect(bs.liabilities.find((s) => s.key === "debts")!.lines.find((l) => l.key === "bank_overdraft")!.amount).toBe(5000);
    expect(bs.currentResult).toBe(-5000);
  });

  it("reporte les résultats antérieurs non affectés", () => {
    const prior: TrialRow[] = [{ number: "756", label: "Cotisations", debit: 0, credit: 10000 }];
    const cur: TrialRow[] = [{ number: "606", label: "Achats", debit: 3000, credit: 0 }];
    const bs = buildBalanceSheet({
      cumulative: [{ number: "530", label: "Caisse", debit: 10000, credit: 3000 }, ...prior, ...cur],
      currentRows: cur,
      priorResult: 10000,
    });
    expect(bs.balanced).toBe(true);
    expect(bs.liabilities[0]!.lines.find((l) => l.key === "carried")!.amount).toBe(10000);
  });
});

describe("grand livre", () => {
  it("calcule les soldes progressifs", () => {
    const l = buildLedger([
      { accountNumber: "530", accountLabel: "Caisse", date: "2026-02-01", journalCode: "CA", entryNumber: 2, label: "B", debit: 0, credit: 300 },
      { accountNumber: "530", accountLabel: "Caisse", date: "2026-01-01", journalCode: "CA", entryNumber: 1, label: "A", debit: 1000, credit: 0 },
    ]);
    expect(l[0]!.lines.map((x) => x.balance)).toEqual([1000, 700]);
    expect(l[0]!.balance).toBe(700);
  });
});

describe("anomalies", () => {
  const base = { status: "booked" as const, hasDocument: true };
  it("détecte doublons, retards et justificatifs manquants", () => {
    const res = detectAnomalies(
      [
        { id: "1", date: "2026-03-01", label: "CB METRO 01/03", amount: -12000, ...base },
        { id: "2", date: "2026-03-02", label: "CB METRO 02/03", amount: -12000, ...base },
        { id: "3", date: "2026-01-01", label: "VIR X", amount: 5000, status: "pending", hasDocument: false },
        { id: "4", date: "2026-03-10", label: "AMAZON", amount: -8000, status: "booked", hasDocument: false },
      ],
      { today: "2026-03-15", currentBalance: -100 },
    );
    const codes = res.map((a) => a.code);
    expect(codes).toContain("possible_duplicate");
    expect(codes).toContain("stale_pending");
    expect(codes).toContain("missing_receipt");
    expect(res[0]!.code).toBe("negative_balance");
  });
});

describe("prévisionnel", () => {
  it("projette la trésorerie avec les flux connus", () => {
    const f = forecastTreasury({
      currentBalance: 100000,
      history: [
        { month: "2026-01-01", income: 10000, expense: 5000 },
        { month: "2026-02-01", income: 10000, expense: 5000 },
      ],
      scheduled: [{ date: "2026-03-15", amount: 3000, label: "Cotisation" }],
      fromMonth: "2026-03-01",
      months: 2,
    });
    expect(f[0]).toEqual({ month: "2026-03-01", projectedBalance: 108000, expectedIncome: 13000, expectedExpense: 5000 });
    expect(f[1]!.projectedBalance).toBe(113000);
  });
});

describe("exercice par défaut", () => {
  it("civil", () => {
    expect(defaultFiscalYear(new Date("2026-11-04"), 1)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
  it("sportif (septembre)", () => {
    expect(defaultFiscalYear(new Date("2026-03-04"), 9)).toEqual({ start: "2025-09-01", end: "2026-08-31" });
  });
});

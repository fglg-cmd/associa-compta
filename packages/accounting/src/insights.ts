/**
 * Analyse financière déterministe : détection d'anomalies et prévisionnel.
 * Ces calculs sont exacts et reproductibles ; l'IA ne fait que les commenter.
 */
import type { Cents } from "./money";

export interface TxForAnalysis {
  id: string;
  date: string; // ISO yyyy-mm-dd
  label: string;
  amount: Cents;
  status: "pending" | "booked" | "matched" | "ignored";
  hasDocument: boolean;
}

export type AnomalySeverity = "info" | "warning" | "critical";

export interface Anomaly {
  code:
    | "possible_duplicate"
    | "unusual_amount"
    | "stale_pending"
    | "missing_receipt"
    | "negative_balance"
    | "unbalanced_reconciliation";
  severity: AnomalySeverity;
  title: string;
  detail: string;
  transactionIds: string[];
  amount?: Cents;
}

const DAY = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function normalize(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[0-9]{2}\/[0-9]{2}(\/[0-9]{2,4})?/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

export interface AnomalyOptions {
  today: string;
  /** Seuil au-delà duquel une dépense doit avoir un justificatif (défaut 50 €) */
  receiptThreshold?: Cents;
  /** Ancienneté (jours) d'un mouvement non comptabilisé avant alerte (défaut 30) */
  staleDays?: number;
  currentBalance?: Cents;
  reconciliationGap?: Cents;
}

export function detectAnomalies(txs: TxForAnalysis[], opts: AnomalyOptions): Anomaly[] {
  const out: Anomaly[] = [];
  const receiptThreshold = opts.receiptThreshold ?? 5_000;
  const staleDays = opts.staleDays ?? 30;
  const now = toTime(opts.today);
  const active = txs.filter((t) => t.status !== "ignored");

  // 1. Doublons probables : même montant, libellé proche, à ≤ 3 jours
  const byAmount = new Map<number, TxForAnalysis[]>();
  for (const t of active) {
    const list = byAmount.get(t.amount) ?? [];
    list.push(t);
    byAmount.set(t.amount, list);
  }
  const seen = new Set<string>();
  for (const list of byAmount.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        if (toTime(b.date) - toTime(a.date) > 3 * DAY) break;
        const key = [a.id, b.id].sort().join(":");
        if (seen.has(key)) continue;
        if (normalize(a.label) === normalize(b.label) && Math.abs(a.amount) >= 1_000) {
          seen.add(key);
          out.push({
            code: "possible_duplicate",
            severity: "warning",
            title: "Doublon possible",
            detail: `Deux mouvements identiques (« ${a.label} ») à ${Math.round((toTime(b.date) - toTime(a.date)) / DAY)} jour(s) d'intervalle.`,
            transactionIds: [a.id, b.id],
            amount: a.amount,
          });
        }
      }
    }
  }

  // 2. Dépense inhabituelle : > 4 × médiane des dépenses et > 500 €
  const expenses = active.filter((t) => t.amount < 0).map((t) => -t.amount);
  const med = median(expenses);
  if (expenses.length >= 8) {
    for (const t of active) {
      if (t.amount < 0 && -t.amount > Math.max(4 * med, 50_000)) {
        out.push({
          code: "unusual_amount",
          severity: "info",
          title: "Dépense inhabituelle",
          detail: `« ${t.label} » est ${Math.round(-t.amount / med)} fois supérieure à la dépense médiane.`,
          transactionIds: [t.id],
          amount: t.amount,
        });
      }
    }
  }

  // 3. Mouvements en attente depuis trop longtemps
  const stale = txs.filter((t) => t.status === "pending" && now - toTime(t.date) > staleDays * DAY);
  if (stale.length) {
    out.push({
      code: "stale_pending",
      severity: stale.length > 20 ? "critical" : "warning",
      title: `${stale.length} mouvement(s) à catégoriser`,
      detail: `Des mouvements de plus de ${staleDays} jours ne sont pas encore comptabilisés.`,
      transactionIds: stale.map((t) => t.id),
      amount: stale.reduce((s, t) => s + t.amount, 0),
    });
  }

  // 4. Dépenses sans justificatif
  const missing = active.filter((t) => t.amount <= -receiptThreshold && !t.hasDocument);
  if (missing.length) {
    out.push({
      code: "missing_receipt",
      severity: missing.length > 10 ? "warning" : "info",
      title: `${missing.length} dépense(s) sans justificatif`,
      detail: `Dépenses de plus de ${receiptThreshold / 100} € sans pièce jointe.`,
      transactionIds: missing.map((t) => t.id),
      amount: missing.reduce((s, t) => s + t.amount, 0),
    });
  }

  if (opts.currentBalance !== undefined && opts.currentBalance < 0) {
    out.push({
      code: "negative_balance",
      severity: "critical",
      title: "Trésorerie négative",
      detail: "Le solde comptable de vos comptes financiers est négatif.",
      transactionIds: [],
      amount: opts.currentBalance,
    });
  }

  if (opts.reconciliationGap !== undefined && opts.reconciliationGap !== 0) {
    out.push({
      code: "unbalanced_reconciliation",
      severity: "warning",
      title: "Écart de rapprochement",
      detail: "Le solde bancaire et le solde comptable ne concordent pas.",
      transactionIds: [],
      amount: opts.reconciliationGap,
    });
  }

  const rank: Record<AnomalySeverity, number> = { critical: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ---------------------------------------------------------------------------
// Prévisionnel de trésorerie
// ---------------------------------------------------------------------------

export interface MonthlyFlow {
  month: string; // yyyy-mm-01
  income: Cents;
  expense: Cents;
}

export interface ScheduledFlow {
  date: string;
  amount: Cents; // signé
  label: string;
}

export interface ForecastPoint {
  month: string;
  projectedBalance: Cents;
  expectedIncome: Cents;
  expectedExpense: Cents;
}

function addMonths(isoMonth: string, n: number): string {
  const [y, m] = isoMonth.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Projection mensuelle : moyenne pondérée des 6 derniers mois (les plus
 * récents pèsent davantage) + encaissements attendus connus (cotisations dues).
 */
export function forecastTreasury(params: {
  currentBalance: Cents;
  history: MonthlyFlow[];
  scheduled: ScheduledFlow[];
  fromMonth: string; // yyyy-mm-01 du mois prochain
  months: number;
}): ForecastPoint[] {
  const recent = params.history.slice(-6);
  const weights = recent.map((_, i) => i + 1);
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const avgIncome = Math.round(recent.reduce((t, h, i) => t + h.income * weights[i]!, 0) / wsum);
  const avgExpense = Math.round(recent.reduce((t, h, i) => t + h.expense * weights[i]!, 0) / wsum);

  const out: ForecastPoint[] = [];
  let balance = params.currentBalance;
  for (let i = 0; i < params.months; i++) {
    const month = addMonths(params.fromMonth, i);
    const next = addMonths(params.fromMonth, i + 1);
    const known = params.scheduled.filter((s) => s.date >= month && s.date < next);
    const knownIn = known.filter((s) => s.amount > 0).reduce((t, s) => t + s.amount, 0);
    const knownOut = known.filter((s) => s.amount < 0).reduce((t, s) => t - s.amount, 0);
    const expectedIncome = avgIncome + knownIn;
    const expectedExpense = avgExpense + knownOut;
    balance += expectedIncome - expectedExpense;
    out.push({ month, projectedBalance: balance, expectedIncome, expectedExpense });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Exercices
// ---------------------------------------------------------------------------

/** Exercice par défaut contenant `today`, débutant au mois `startMonth` (1-12). */
export function defaultFiscalYear(today: Date, startMonth: number): { start: string; end: string } {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth() + 1;
  const startYear = m >= startMonth ? y : y - 1;
  const start = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const end = new Date(Date.UTC(startYear + 1, startMonth - 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

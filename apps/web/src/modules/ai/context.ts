import "server-only";
import { formatEUR } from "@associa/accounting";
import { createClient } from "@/lib/supabase/server";
import { getStatements, resolveFiscalYear } from "../accounting/queries";
import { getDashboard } from "../dashboard/queries";

const e = (c: number) => formatEUR(c).replace(/ | /g, " ");

/** Instantané financier factuel transmis à l'IA (aucune donnée nominative d'adhérent). */
export async function buildFinancialContext(orgId: string, orgName: string, fyId?: string | null) {
  const supabase = await createClient();
  const fy = await resolveFiscalYear(orgId, fyId);
  const [st, dash, { data: projects }, { count: members }] = await Promise.all([
    getStatements(orgId, fy),
    getDashboard(orgId, fy),
    supabase.rpc("project_financials", { p_org: orgId }),
    supabase.from("members").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"),
  ]);
  const { data: pnames } = await supabase.from("projects").select("id, name, kind").eq("organization_id", orgId);
  const pmap = new Map((pnames ?? []).map((p) => [p.id as string, p]));
  const is = st.income;
  const lines: string[] = [];
  lines.push(`# Données de l'association « ${orgName} » (générées le ${new Date().toLocaleDateString("fr-FR")})`);
  lines.push(`Exercice : ${fy.label}, du ${fy.start_date} au ${fy.end_date} (${fy.status === "open" ? "en cours, non clôturé" : "clôturé"}). Données arrêtées au ${st.to}.`);
  lines.push(`\n## Compte de résultat`);
  for (const l of is.operatingIncome.lines.filter((l) => l.amount)) lines.push(`- Produit — ${l.label} : ${e(l.amount)}${l.details.length > 1 ? ` (${l.details.map((d) => `${d.label} ${e(d.amount)}`).join(", ")})` : ""}`);
  for (const l of is.operatingExpenses.lines.filter((l) => l.amount)) lines.push(`- Charge — ${l.label} : ${e(l.amount)}${l.details.length > 1 ? ` (${l.details.slice(0, 6).map((d) => `${d.label} ${e(d.amount)}`).join(", ")})` : ""}`);
  lines.push(`- Résultat financier : ${e(is.financialResult)} ; exceptionnel : ${e(is.exceptionalResult)}`);
  lines.push(`- Total produits : ${e(is.totalIncome)} ; total charges : ${e(is.totalExpenses)} ; RÉSULTAT : ${e(is.netResult)} (${is.netResult >= 0 ? "excédent" : "déficit"})`);
  if (is.inKind.contributions) lines.push(`- Contributions volontaires en nature : ${e(is.inKind.contributions)}`);
  lines.push(`\n## Bilan au ${st.to}`);
  for (const s of st.balance.assets) for (const l of s.lines.filter((l) => l.amount)) lines.push(`- Actif — ${l.label} : ${e(l.amount)}`);
  for (const s of st.balance.liabilities) for (const l of s.lines.filter((l) => l.amount)) lines.push(`- Passif — ${l.label} : ${e(l.amount)}`);
  lines.push(`- Total bilan : ${e(st.balance.totalAssets)}${st.balance.balanced ? "" : " (ATTENTION : actif ≠ passif)"}`);
  lines.push(`\n## Trésorerie`);
  lines.push(`- Disponible aujourd'hui : ${e(dash.treasury.total)} (${dash.treasury.accounts.map((a) => `${a.label} ${e(a.balance)}`).join(" ; ")})`);
  lines.push(`- Flux mensuels (12 mois, recettes/dépenses) : ${dash.flows.map((f) => `${f.month.slice(0, 7)} +${e(f.income)}/-${e(f.expense)}`).join(" ; ")}`);
  lines.push(`- Projection à 6 mois : ${dash.forecast.map((f) => `${f.month.slice(0, 7)} ${e(f.projectedBalance)}`).join(" ; ")}`);
  lines.push(`\n## Adhérents`);
  lines.push(`- Adhérents actifs : ${members ?? 0} ; cotisations à encaisser : ${dash.unpaidFees.count} pour ${e(dash.unpaidFees.total)}`);
  const fin = (projects ?? []) as { project_id: string; budget_income: number; budget_expense: number; actual_income: number; actual_expense: number }[];
  if (fin.length) {
    lines.push(`\n## Projets et événements`);
    for (const p of fin) {
      const meta = pmap.get(p.project_id);
      lines.push(`- ${meta?.name ?? "Projet"} (${meta?.kind === "event" ? "événement" : "projet"}) : réalisé recettes ${e(Number(p.actual_income))} / dépenses ${e(Number(p.actual_expense))} ; budget recettes ${e(Number(p.budget_income))} / dépenses ${e(Number(p.budget_expense))}`);
    }
  }
  lines.push(`\n## Contrôles automatiques`);
  lines.push(`- Mouvements bancaires non catégorisés : ${dash.pendingTx}`);
  if (dash.anomalies.length) for (const a of dash.anomalies) lines.push(`- [${a.severity}] ${a.title} — ${a.detail}${a.amount ? ` (${e(a.amount)})` : ""}`);
  else lines.push("- Aucune anomalie détectée.");
  return { context: lines.join("\n"), fy };
}

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import { requireOrgMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveFiscalYear, getStatements } from "@/modules/accounting/queries";
import { buildFec, buildTables } from "@/modules/reports/tabular";
import { toCsv, toXlsx } from "@/modules/reports/render";
import { renderPdf } from "@/modules/reports/pdf";
import { planOf } from "@/lib/plans";
import { publicEnv } from "@/lib/public-env";
import { slugify } from "@/lib/utils";
import type { Organization } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const REPORTS = ["balance", "grand-livre", "journal", "compte-resultat", "bilan", "fec", "adherents", "ag", "operations"] as const;
const TITLES: Record<string, string> = {
  balance: "Balance générale", "grand-livre": "Grand livre", journal: "Journal général", operations: "Journal général",
  "compte-resultat": "Compte de résultat", bilan: "Bilan", adherents: "Liste des adhérents", ag: "Comptes annuels — Assemblée générale",
};

async function generate(orgId: string, params: { rapport: string; format: string; exercice?: string | null; narrative?: string; interactive?: boolean }) {
  const { org } = await requireOrgMember(orgId);
  const supabase = await createClient();
  const { data: full } = await supabase.from("organizations").select("*").eq("id", orgId).single<Organization>();
  const report = z.enum(REPORTS).parse(params.rapport);
  const format = z.enum(["pdf", "xlsx", "csv", "txt"]).parse(params.format);
  if (format !== "csv" && planOf(org.plan).tier === "free" && report !== "compte-resultat" && report !== "bilan" && report !== "ag") {
    if (params.interactive) return NextResponse.redirect(`${publicEnv.appUrl}/app/${org.slug}/parametres?onglet=abonnement&raison=export`, 303);
    return NextResponse.json({ error: "Les exports Excel et PDF détaillés sont inclus dans l'offre Essentiel." }, { status: 402 });
  }
  const fy = await resolveFiscalYear(orgId, params.exercice);
  const base = `${slugify(full!.name)}_${report}_${fy.start_date.slice(0, 4)}`;

  if (report === "fec") {
    const fec = await buildFec(orgId, fy);
    const siren = full!.siren ?? "000000000";
    return new NextResponse(fec, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="${siren}FEC${fy.end_date.replaceAll("-", "")}.txt"` } });
  }

  const tables = report === "ag"
    ? [...(await buildTables(orgId, fy, "compte-resultat")), ...(await buildTables(orgId, fy, "bilan"))]
    : await buildTables(orgId, fy, report);

  if (format === "csv") return new NextResponse(toCsv(tables), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` } });
  if (format === "xlsx") {
    const buf = await toXlsx(tables, full!.name);
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${base}.xlsx"` } });
  }

  let kpis: { label: string; value: number }[] | undefined;
  if (report === "ag" || report === "compte-resultat") {
    const st = await getStatements(orgId, fy);
    kpis = [
      { label: "Produits", value: st.income.totalIncome },
      { label: "Charges", value: st.income.totalExpenses },
      { label: st.income.netResult >= 0 ? "Excédent" : "Déficit", value: st.income.netResult },
      { label: "Total du bilan", value: st.balance.totalAssets },
    ];
  }
  const details = [full!.rna && `RNA ${full!.rna}`, full!.siren && `SIREN ${full!.siren}`, full!.city].filter(Boolean).join(" · ");
  const pdf = await renderPdf({
    orgName: full!.name,
    orgDetails: details,
    title: TITLES[report]!,
    subtitle: `${fy.label}, du ${fy.start_date.split("-").reverse().join("/")} au ${fy.end_date.split("-").reverse().join("/")}${fy.status === "open" ? " (exercice non clôturé)" : ""}`,
    tables,
    narrative: params.narrative,
    kpis,
    landscape: ["grand-livre", "journal", "operations", "adherents"].includes(report),
  });
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"` } });
}

function handle(e: unknown) {
  unstable_rethrow(e);
  const msg = (e as Error).message;
  if (/droits|Accès/.test(msg)) return NextResponse.json({ error: msg }, { status: 403 });
  if (e instanceof z.ZodError) return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  console.error("[export]", e);
  return NextResponse.json({ error: "Échec de la génération" }, { status: 500 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const sp = req.nextUrl.searchParams;
  try {
    return await generate(orgId, { rapport: sp.get("rapport") ?? "", format: sp.get("format") ?? "pdf", exercice: sp.get("exercice"), interactive: true });
  } catch (e) {
    return handle(e);
  }
}

/** POST : rapport d'AG avec le texte rédigé (édité par l'utilisateur). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  try {
    const form = await req.formData();
    const narrative = String(form.get("narrative") ?? "").slice(0, 20000);
    return await generate(orgId, { rapport: "ag", format: "pdf", exercice: String(form.get("exercice") ?? ""), narrative });
  } catch (e) {
    return handle(e);
  }
}

"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseAmount } from "@associa/accounting";
import { requireOrgWriter } from "@/lib/auth";
import { run, unwrap } from "@/lib/action";

const optDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional().transform((v) => v || null);

const projectSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court.").max(120),
  kind: z.enum(["project", "event"]),
  description: z.string().trim().max(2000).optional().transform((v) => v || null),
  start_date: optDate,
  end_date: optDate,
  status: z.enum(["planned", "active", "closed"]).default("active"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#4F46E5"),
});

export async function saveProject(orgId: string, projectId: string | null, form: FormData) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const v = projectSchema.parse(Object.fromEntries(form));
    if (v.start_date && v.end_date && v.end_date < v.start_date) throw new Error("La date de fin précède la date de début.");
    if (projectId) {
      unwrap(await supabase.from("projects").update(v).eq("id", projectId).eq("organization_id", orgId));
    } else {
      const p = unwrap(await supabase.from("projects").insert({ ...v, organization_id: orgId }).select("id").single<{ id: string }>());
      projectId = p!.id;
    }
    revalidatePath(`/app/${org.slug}/projets`, "layout");
    return projectId;
  });
}

export async function deleteProject(orgId: string, projectId: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    unwrap(await supabase.from("projects").delete().eq("id", projectId).eq("organization_id", orgId));
    revalidatePath(`/app/${org.slug}/projets`, "layout");
  });
}

export async function saveBudgetLine(orgId: string, projectId: string, lineId: string | null, form: FormData) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    const v = z.object({ label: z.string().trim().min(1).max(120), direction: z.enum(["income", "expense"]), amount: z.string(), accountId: z.union([z.literal(""), z.uuid()]).optional() }).parse(Object.fromEntries(form));
    const amount = parseAmount(v.amount);
    if (amount === null || amount < 0) throw new Error("Montant invalide.");
    const row = { label: v.label, direction: v.direction, amount, account_id: v.accountId || null };
    if (lineId) unwrap(await supabase.from("project_budget_lines").update(row).eq("id", lineId).eq("organization_id", orgId));
    else unwrap(await supabase.from("project_budget_lines").insert({ ...row, organization_id: orgId, project_id: projectId }));
    revalidatePath(`/app/${org.slug}/projets`, "layout");
  });
}

export async function deleteBudgetLine(orgId: string, lineId: string) {
  return run(async () => {
    const { supabase, org } = await requireOrgWriter(orgId);
    unwrap(await supabase.from("project_budget_lines").delete().eq("id", lineId).eq("organization_id", orgId));
    revalidatePath(`/app/${org.slug}/projets`, "layout");
  });
}

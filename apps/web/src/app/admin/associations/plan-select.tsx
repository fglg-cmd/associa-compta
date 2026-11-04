"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { setOrganizationPlan } from "@/modules/admin/actions";
import { Select } from "@/components/ui/input";

export function PlanSelect({ orgId, plan }: { orgId: string; plan: string }) {
  const [pending, start] = useTransition();
  return (
    <Select defaultValue={plan} disabled={pending} className="h-7 w-32 text-xs" onChange={(e) => {
      const v = e.target.value;
      if (!confirm(`Attribuer manuellement l'offre « ${v} » ? (hors facturation Stripe)`)) return;
      start(async () => { const r = await setOrganizationPlan(orgId, v); if (r.ok) toast.success("Offre mise à jour"); else toast.error(r.error); });
    }}>
      <option value="free">Découverte</option>
      <option value="essential">Essentiel</option>
      <option value="pro">Pro</option>
    </Select>
  );
}

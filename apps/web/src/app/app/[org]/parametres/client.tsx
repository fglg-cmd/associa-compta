"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatEUR } from "@associa/accounting";
import { createSupportTicket, deleteOrganization, inviteMember, removeMembership, revokeInvitation, updateMemberRole, updateOrganization } from "@/modules/org/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { Organization } from "@/lib/types";
import type { PlanDef, PlanTier } from "@/lib/plans";
import { cn, fmtDate } from "@/lib/utils";

function useAct() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { toast.error(r.error); return; }
      if (msg) toast.success(msg);
      router.refresh();
    });
  return { pending, act };
}

export function OrgForm({ orgId, org, disabled }: { orgId: string; org: Organization; disabled: boolean }) {
  const { pending, act } = useAct();
  return (
    <form action={(fd) => act(() => updateOrganization(orgId, fd), "Informations enregistrées")} className="grid gap-3">
      <fieldset disabled={disabled} className="grid gap-3">
        <Field label="Nom de l'association"><Input name="name" required defaultValue={org.name} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="N° RNA" hint="W suivi de 9 caractères"><Input name="rna" defaultValue={org.rna ?? ""} placeholder="W751234567" className="uppercase" /></Field>
          <Field label="SIREN" hint="Obligatoire pour le FEC"><Input name="siren" defaultValue={org.siren ?? ""} inputMode="numeric" maxLength={9} /></Field>
        </div>
        <Field label="Adresse du siège"><Input name="address_line" defaultValue={org.address_line ?? ""} /></Field>
        <div className="grid grid-cols-[120px_1fr] gap-3">
          <Field label="Code postal"><Input name="postal_code" defaultValue={org.postal_code ?? ""} /></Field>
          <Field label="Ville"><Input name="city" defaultValue={org.city ?? ""} /></Field>
        </div>
        <Field label="E-mail de contact" hint="Adresse de réponse des relances de cotisation."><Input name="email" type="email" defaultValue={org.email ?? ""} /></Field>
        {!disabled && <Button type="submit" variant="primary" loading={pending} className="justify-self-start">Enregistrer</Button>}
      </fieldset>
    </form>
  );
}

const ROLES = [["admin", "Administrateur"], ["treasurer", "Trésorier"], ["member", "Membre du bureau"], ["viewer", "Lecteur"]] as const;

export function MemberRow({ orgId, userId, name, email, role, canEdit, isSelf }: { orgId: string; userId: string; name: string; email: string; role: string; canEdit: boolean; isSelf: boolean }) {
  const { pending, act } = useAct();
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-[13px]">
      <div className="min-w-0 flex-1"><div className="font-medium">{name}{isSelf && <span className="ml-1.5 text-xs text-muted">(vous)</span>}</div><div className="text-xs text-muted">{email}</div></div>
      {canEdit ? (
        <>
          <Select defaultValue={role} disabled={pending} onChange={(e) => act(() => updateMemberRole(orgId, userId, e.target.value), "Rôle mis à jour")} className="w-44">
            <option value="owner">Propriétaire</option>
            {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Button size="icon-sm" variant="ghost" aria-label="Retirer" onClick={() => confirm(`Retirer ${name} de l'association ?`) && act(() => removeMembership(orgId, userId), "Accès retiré")}><Trash2 /></Button>
        </>
      ) : (
        <Badge>{role === "owner" ? "Propriétaire" : ROLES.find((r) => r[0] === role)?.[1]}</Badge>
      )}
    </li>
  );
}

export function InviteForm({ orgId, emailEnabled }: { orgId: string; emailEnabled: boolean }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  return (
    <div className="grid gap-3">
      <form
        action={(fd) => start(async () => {
          const r = await inviteMember(orgId, fd);
          if (!r.ok) { toast.error(r.error); return; }
          setUrl(r.data.url);
          toast.success(r.data.emailed ? "Invitation envoyée par e-mail" : "Invitation créée : partagez le lien ci-dessous");
          router.refresh();
        })}
        className="flex flex-wrap gap-2"
      >
        <Input name="email" type="email" required placeholder="tresorier.adjoint@monasso.fr" className="min-w-60 flex-1" />
        <Select name="role" defaultValue="treasurer" className="w-44">{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <Button type="submit" variant="primary" loading={pending}>Inviter</Button>
      </form>
      {url && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
          <span className="min-w-0 flex-1 truncate font-mono">{url}</span>
          <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(url); setCopied(true); }}>{copied ? <Check /> : <Copy />} Copier</Button>
        </div>
      )}
      {!emailEnabled && <p className="text-xs text-muted">L&apos;envoi d&apos;e-mails n&apos;est pas configuré : transmettez le lien d&apos;invitation vous-même.</p>}
    </div>
  );
}

export function RevokeInvite({ orgId, id }: { orgId: string; id: string }) {
  const { pending, act } = useAct();
  return <Button size="sm" variant="ghost" loading={pending} onClick={() => act(() => revokeInvitation(orgId, id), "Invitation annulée")}>Annuler</Button>;
}

export function BillingPanel({ orgId, current, plans, subscription, canManage, billingEnabled, success }: {
  orgId: string; current: PlanTier; plans: PlanDef[]; canManage: boolean; billingEnabled: boolean; success: boolean;
  subscription: { status: string; current_period_end: string | null; cancel_at_period_end: boolean; interval: string | null } | null;
}) {
  const [interval, setInterval] = useState<"month" | "year">("year");
  const [loading, setLoading] = useState<string | null>(null);

  async function go(path: string, body: object, key: string) {
    setLoading(key);
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok || !json.url) { toast.error(json.error ?? "Impossible d'ouvrir la page de paiement"); return; }
      window.location.href = json.url;
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid gap-4">
      {success && <div className="rounded-lg bg-positive-soft px-4 py-3 text-[13px] text-positive">Merci ! Votre abonnement est actif. La mise à jour peut prendre quelques secondes.</div>}
      {subscription && current !== "free" && (
        <Card className="flex flex-wrap items-center gap-3 p-4 text-[13px]">
          <div className="flex-1">
            <div className="font-medium">Offre {plans.find((p) => p.tier === current)?.name} · {subscription.interval === "year" ? "annuelle" : "mensuelle"}</div>
            <div className="text-xs text-muted">{subscription.cancel_at_period_end ? "Résiliée, active jusqu'au " : "Prochain renouvellement le "}{subscription.current_period_end ? fmtDate(subscription.current_period_end) : "—"}{subscription.status === "past_due" && " · paiement en échec, mettez à jour votre carte"}</div>
          </div>
          {canManage && <Button onClick={() => go("/api/stripe/portal", { orgId }, "portal")} loading={loading === "portal"}>Factures et moyen de paiement</Button>}
        </Card>
      )}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5 text-[13px]">
          <button onClick={() => setInterval("month")} className={cn("rounded-md px-3 py-1 font-medium", interval === "month" ? "bg-surface shadow-sm" : "text-muted")}>Mensuel</button>
          <button onClick={() => setInterval("year")} className={cn("rounded-md px-3 py-1 font-medium", interval === "year" ? "bg-surface shadow-sm" : "text-muted")}>Annuel <span className="text-positive">−17 %</span></button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {plans.map((p) => {
          const price = interval === "year" ? p.yearly / 12 : p.monthly;
          const isCurrent = p.tier === current;
          return (
            <Card key={p.tier} className={cn("flex flex-col p-5", p.tier === "essential" && "border-accent/50 shadow-md")}>
              <div className="flex items-center justify-between"><span className="font-semibold">{p.name}</span>{isCurrent && <Badge tone="accent">Offre actuelle</Badge>}</div>
              <p className="text-xs text-muted">{p.tagline}</p>
              <div className="mt-4 text-2xl font-semibold tabular">{p.monthly === 0 ? "Gratuit" : formatEUR(Math.round(price)).replace(",00", "")}<span className="text-sm font-normal text-muted">{p.monthly ? " HT / mois" : ""}</span></div>
              {interval === "year" && p.yearly > 0 && <p className="text-xs text-muted">soit {formatEUR(p.yearly).replace(",00", "")} HT par an</p>}
              <ul className="mt-4 grid flex-1 gap-1.5 text-[13px]">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-positive" />{f}</li>)}</ul>
              {!isCurrent && p.tier !== "free" && canManage && (
                billingEnabled ? (
                  <Button variant={p.tier === "essential" ? "primary" : "secondary"} className="mt-5" loading={loading === p.tier} onClick={() => current === "free" ? go("/api/stripe/checkout", { orgId, plan: p.tier, interval }, p.tier) : go("/api/stripe/portal", { orgId }, p.tier)}>
                    {current === "free" ? `Passer à ${p.name}` : "Changer d'offre"}
                  </Button>
                ) : <p className="mt-5 text-xs text-muted">Paiement en ligne non configuré.</p>
              )}
            </Card>
          );
        })}
      </div>
      <p className="text-center text-xs text-muted">Paiement sécurisé par Stripe · Facture conforme envoyée chaque période · Sans engagement, résiliable à tout moment.</p>
    </div>
  );
}

export function SupportForm({ orgId }: { orgId: string }) {
  const { pending, act } = useAct();
  return (
    <form action={(fd) => act(() => createSupportTicket(orgId, fd), "Message envoyé, nous revenons vers vous rapidement")} className="grid gap-3">
      <Field label="Sujet"><Input name="subject" required minLength={3} /></Field>
      <Field label="Message"><Textarea name="message" required minLength={10} rows={6} /></Field>
      <Button type="submit" variant="primary" loading={pending} className="justify-self-start">Envoyer</Button>
    </form>
  );
}

export function DangerZone({ orgId, orgName, isOwner }: { orgId: string; orgName: string; isOwner: boolean }) {
  const [confirmName, setConfirmName] = useState("");
  const [pending, start] = useTransition();
  if (!isOwner) return <p className="text-[13px] text-muted">Seul le propriétaire peut supprimer l&apos;association.</p>;
  return (
    <div className="grid gap-3">
      <Field label={<>Tapez <strong>{orgName}</strong> pour confirmer</>}><Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} /></Field>
      <Button variant="danger" className="justify-self-start" disabled={confirmName !== orgName} loading={pending} onClick={() => start(async () => { const r = await deleteOrganization(orgId, confirmName); if (r && !r.ok) toast.error(r.error); })}>
        Supprimer définitivement
      </Button>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, EyeOff, Link2, MoreHorizontal, Paperclip, RotateCcw, Sparkles, Undo2, Inbox } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { toast } from "sonner";
import { formatEUR } from "@associa/accounting";
import {
  bookTransactions,
  findMatchCandidates,
  matchTransaction,
  setTransactionIgnored,
  unbookTransaction,
  type MatchCandidate,
} from "@/modules/bank/actions";
import { AccountSelect } from "@/components/finance/account-select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/misc";
import type { Account, BankTransaction, Project } from "@/lib/types";
import { cn, fmtDate, fmtDateShort } from "@/lib/utils";

type Tx = BankTransaction & { counterpartAccountId: string | null; hasDocument: boolean; bankName: string };

export function TransactionsTable({
  orgId,
  canWrite,
  view,
  transactions,
  accounts,
  excludeAccountIds,
  projects,
  showBankName,
  slug,
}: {
  orgId: string;
  canWrite: boolean;
  view: "pending" | "done" | "ignored" | "all";
  transactions: Tx[];
  accounts: Pick<Account, "id" | "number" | "label" | "is_active">[];
  excludeAccountIds: string[];
  projects: Pick<Project, "id" | "name">[];
  showBankName: boolean;
  slug: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState<Record<string, { accountId: string; projectId: string }>>(() =>
    Object.fromEntries(transactions.map((t) => [t.id, { accountId: t.suggested_account_id ?? "", projectId: t.suggested_project_id ?? "" }])),
  );
  // Après un import ou une navigation, la liste change sans que le composant soit recréé :
  // on complète les choix avec les suggestions des nouveaux mouvements.
  useEffect(() => {
    setChoice((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const t of transactions) {
        const cur = next[t.id];
        if (!cur || (!cur.accountId && t.suggested_account_id)) {
          next[t.id] = { accountId: t.suggested_account_id ?? cur?.accountId ?? "", projectId: cur?.projectId || t.suggested_project_id || "" };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [transactions]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [learn, setLearn] = useState(true);
  const [matching, setMatching] = useState<{ tx: Tx; candidates: MatchCandidate[] } | null>(null);
  const accountLabel = useMemo(() => new Map(accounts.map((a) => [a.id, `${a.number} · ${a.label}`])), [accounts]);

  const ready = transactions.filter((t) => t.status === "pending" && choice[t.id]?.accountId);

  function book(ids: string[]) {
    const items = ids.map((id) => ({ txId: id, accountId: choice[id]!.accountId, projectId: choice[id]!.projectId || null })).filter((i) => i.accountId);
    if (!items.length) { toast.error("Choisissez une catégorie."); return; }
    start(async () => {
      const r = await bookTransactions(orgId, { items, learn });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(`${r.data.booked} mouvement(s) comptabilisé(s)`, {
        description: r.data.learned ? `${r.data.learned} règle(s) apprise(s) pour les prochains imports.` : undefined,
      });
      setSelected(new Set());
      router.refresh();
    });
  }

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    start(async () => {
      const r = await fn();
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(success);
      router.refresh();
    });
  }

  function openMatch(tx: Tx) {
    start(async () => {
      const r = await findMatchCandidates(orgId, tx.id);
      if (!r.ok) { toast.error(r.error); return; }
      setMatching({ tx, candidates: r.data });
    });
  }

  if (!transactions.length) {
    return (
      <Card>
        <EmptyState
          icon={Inbox}
          title={view === "pending" ? "Tout est à jour" : "Aucun mouvement"}
          description={view === "pending" ? "Aucun mouvement en attente. Importez un nouveau relevé quand vous le souhaitez." : "Aucun mouvement ne correspond à ce filtre."}
        />
      </Card>
    );
  }

  const allPendingIds = transactions.filter((t) => t.status === "pending").map((t) => t.id);
  const toggleAll = () => setSelected(selected.size === allPendingIds.length ? new Set() : new Set(allPendingIds));

  return (
    <>
      {canWrite && view === "pending" && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-surface px-4 py-2.5 shadow-xs">
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={selected.size > 0 && selected.size === allPendingIds.length} onChange={toggleAll} className="accent-[var(--accent)]" />
            {selected.size ? `${selected.size} sélectionné(s)` : "Tout sélectionner"}
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-muted" title="Les prochains mouvements identiques recevront automatiquement la même catégorie.">
            <input type="checkbox" checked={learn} onChange={(e) => setLearn(e.target.checked)} className="accent-[var(--accent)]" />
            Retenir mes choix
          </label>
          <div className="ml-auto flex gap-2">
            {selected.size > 0 && (
              <Button size="sm" variant="primary" loading={pending} onClick={() => book([...selected].filter((id) => choice[id]?.accountId))}>
                <Check /> Valider la sélection
              </Button>
            )}
            {selected.size === 0 && ready.length > 0 && (
              <Button size="sm" variant="primary" loading={pending} onClick={() => book(ready.map((t) => t.id))}>
                <Sparkles /> Valider les {ready.length} suggestion{ready.length > 1 ? "s" : ""}
              </Button>
            )}
          </div>
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {transactions.map((t) => {
            const c = choice[t.id] ?? { accountId: "", projectId: "" };
            const suggested = t.status === "pending" && t.suggested_account_id && c.accountId === t.suggested_account_id;
            return (
              <div key={t.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-surface-2/40 lg:flex-nowrap", pending && "opacity-90")}>
                {canWrite && t.status === "pending" && (
                  <input
                    type="checkbox"
                    aria-label="Sélectionner"
                    checked={selected.has(t.id)}
                    onChange={() => { const s = new Set(selected); if (s.has(t.id)) s.delete(t.id); else s.add(t.id); setSelected(s); }}
                    className="accent-[var(--accent)]"
                  />
                )}
                <Tooltip content={fmtDate(t.date)}><span className="w-12 shrink-0 text-xs text-muted tabular">{fmtDateShort(t.date)}</span></Tooltip>
                <div className="min-w-0 flex-1 basis-56">
                  <div className="truncate text-[13px] font-medium" title={t.raw_label ?? t.label}>{t.label}</div>
                  {(showBankName || t.status !== "pending") && (
                    <div className="truncate text-xs text-muted">
                      {showBankName && t.bankName}
                      {showBankName && t.status !== "pending" && " · "}
                      {t.status === "booked" && t.counterpartAccountId && accountLabel.get(t.counterpartAccountId)}
                      {t.status === "matched" && "Rapproché d'une écriture existante"}
                      {t.status === "ignored" && "Ignoré"}
                    </div>
                  )}
                </div>
                <span className={cn("w-28 shrink-0 text-right text-[13px] font-semibold tabular", t.amount > 0 && "text-positive")}>{formatEUR(t.amount, { signed: true })}</span>

                {t.status === "pending" && canWrite && (
                  <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:flex-nowrap">
                    <div className="relative w-full sm:w-72">
                      <AccountSelect
                        labelFirst
                        accounts={accounts}
                        direction={t.amount > 0 ? "in" : "out"}
                        exclude={excludeAccountIds}
                        value={c.accountId}
                        onChange={(v) => setChoice({ ...choice, [t.id]: { ...c, accountId: v } })}
                        className={cn("h-8 text-[13px]", suggested && "border-accent/40 bg-accent-soft/40")}
                      />
                    </div>
                    {projects.length > 0 && (
                      <Select value={c.projectId} onChange={(e) => setChoice({ ...choice, [t.id]: { ...c, projectId: e.target.value } })} className="h-8 w-full text-[13px] sm:w-40">
                        <option value="">Sans projet</option>
                        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </Select>
                    )}
                    <div className="flex gap-1">
                      <Tooltip content="Valider cette catégorie"><Button size="icon" variant="primary" disabled={!c.accountId || pending} onClick={() => book([t.id])} aria-label="Comptabiliser"><Check /></Button></Tooltip>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" disabled={pending} aria-label="Autres actions"><MoreHorizontal /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-72">
                          <DropdownMenuItem onSelect={() => openMatch(t)}><Link2 /> Associer à une opération déjà saisie</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => act(() => setTransactionIgnored(orgId, t.id, true), "Mouvement ignoré")}><EyeOff /> Ignorer (doublon, virement interne)</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                )}

                {(t.status === "booked" || t.status === "matched") && (
                  <div className="flex items-center gap-1">
                    {t.hasDocument ? (
                      <Badge tone="positive"><Paperclip className="size-3" /> Justifié</Badge>
                    ) : (
                      canWrite && t.amount < 0 && (
                        <Button asChild size="sm" variant="ghost"><Link href={`/app/${slug}/justificatifs?action=ajouter&tx=${t.id}`}><Paperclip /> Justificatif</Link></Button>
                      )
                    )}
                    {canWrite && (
                      <Tooltip content={t.status === "booked" ? "Annuler la comptabilisation (contre-passation)" : "Annuler le rapprochement"}>
                        <Button size="icon-sm" variant="ghost" disabled={pending} onClick={() => act(() => unbookTransaction(orgId, t.id), "Comptabilisation annulée")} aria-label="Annuler"><Undo2 /></Button>
                      </Tooltip>
                    )}
                  </div>
                )}
                {t.status === "ignored" && canWrite && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => setTransactionIgnored(orgId, t.id, false), "Mouvement restauré")}><RotateCcw /> Restaurer</Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Dialog open={!!matching} onOpenChange={(o) => !o && setMatching(null)}>
        {matching && (
          <DialogContent title="Rapprocher le mouvement" description={`${matching.tx.label} · ${formatEUR(matching.tx.amount, { signed: true })} · ${fmtDate(matching.tx.date)}`}>
            {matching.candidates.length === 0 ? (
              <p className="py-4 text-[13px] text-muted">Aucune écriture de même montant n&apos;a été trouvée sur ce compte à ±20 jours. Comptabilisez directement le mouvement avec une catégorie.</p>
            ) : (
              <div className="grid gap-1.5">
                {matching.candidates.map((c) => (
                  <button
                    key={c.entryId}
                    disabled={pending}
                    onClick={() => act(async () => { const r = await matchTransaction(orgId, matching.tx.id, c.entryId); if (r.ok) setMatching(null); return r; }, "Mouvement rapproché")}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left text-[13px] hover:border-accent hover:bg-accent-soft/40"
                  >
                    <span className="w-16 text-xs text-muted tabular">{fmtDateShort(c.date)}</span>
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.entryNumber && <span className="text-xs text-muted">n° {c.entryNumber}</span>}
                  </button>
                ))}
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

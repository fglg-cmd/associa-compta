"use client";
import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, ListOrdered, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatEUR } from "@associa/accounting";
import { deleteDraftEntry, postEntry, reverseEntry } from "@/modules/accounting/actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { cn, fmtDateNum } from "@/lib/utils";

export interface EntryView {
  id: string;
  date: string;
  label: string;
  reference: string | null;
  status: "draft" | "posted";
  source: string;
  entry_number: number | null;
  journal: string;
  reversal_of: string | null;
  reversed: boolean;
  lines: { id: string; line_no: number; account_id: string; label: string | null; debit: number; credit: number }[];
}

const SOURCE: Record<string, string> = { bank: "Banque", member_fee: "Cotisation", manual: "Saisie", opening: "À-nouveau", reversal: "Contre-passation", import: "Import", closing: "Clôture" };

export function EntriesList({ orgId, entries, accounts, canWrite, highlight }: { orgId: string; entries: EntryView[]; accounts: Record<string, { number: string; label: string }>; canWrite: boolean; highlight?: string }) {
  const [open, setOpen] = useState<Set<string>>(new Set(highlight ? [highlight] : []));
  const [pending, start] = useTransition();
  const router = useRouter();

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(msg);
      router.refresh();
    });

  if (!entries.length) return <Card><EmptyState icon={ListOrdered} title="Aucune écriture" description="Les écritures apparaissent ici dès que vous comptabilisez un mouvement bancaire ou saisissez une opération." /></Card>;

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-[13px] tabular">
        <thead className="border-b border-border text-left text-xs text-muted">
          <tr>
            <th className="w-8" />
            <th className="py-2 font-medium">Date</th>
            <th className="font-medium">Pièce</th>
            <th className="font-medium">Libellé</th>
            <th className="hidden font-medium md:table-cell">Origine</th>
            <th className="pr-3 text-right font-medium">Montant</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((e) => {
            const total = e.lines.reduce((t, l) => t + Number(l.debit), 0);
            const isOpen = open.has(e.id);
            return (
              <Fragment key={e.id}>
                <tr className={cn("cursor-pointer hover:bg-surface-2/60", highlight === e.id && "bg-accent-soft/40")} onClick={() => { const s = new Set(open); if (s.has(e.id)) s.delete(e.id); else s.add(e.id); setOpen(s); }}>
                  <td className="pl-3"><ChevronRight className={cn("size-3.5 text-subtle transition-transform", isOpen && "rotate-90")} /></td>
                  <td className="py-2.5 text-muted">{fmtDateNum(e.date)}</td>
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{e.journal}{e.entry_number ? `-${String(e.entry_number).padStart(4, "0")}` : ""}</td>
                  <td className="max-w-0 w-full">
                    <div className="flex items-center gap-2">
                      <span className={cn("truncate", e.reversed && "text-muted line-through")}>{e.label}</span>
                      {e.status === "draft" && <Badge tone="warning">Brouillon</Badge>}
                      {e.reversed && <Badge>Contre-passée</Badge>}
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap px-3 text-xs text-muted md:table-cell">{SOURCE[e.source] ?? e.source}</td>
                  <td className="whitespace-nowrap pr-3 text-right font-medium">{formatEUR(total)}</td>
                  <td className="pr-2" onClick={(ev) => ev.stopPropagation()}>
                    {canWrite && (e.status === "draft" || (!e.reversed && e.source !== "reversal")) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" disabled={pending} aria-label="Actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {e.status === "draft" ? (
                            <>
                              <DropdownMenuItem onSelect={() => act(() => postEntry(orgId, e.id), "Écriture validée")}><CheckCircle2 /> Valider</DropdownMenuItem>
                              <DropdownMenuItem destructive onSelect={() => act(() => deleteDraftEntry(orgId, e.id), "Brouillon supprimé")}><Trash2 /> Supprimer le brouillon</DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem onSelect={() => act(() => reverseEntry(orgId, e.id), "Écriture contre-passée")}><RotateCcw /> Contre-passer (annuler)</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-surface-2/40">
                    <td />
                    <td colSpan={6} className="py-2 pr-3">
                      <table className="w-full text-xs">
                        <tbody>
                          {e.lines.map((l) => (
                            <tr key={l.id}>
                              <td className="w-20 py-1 font-mono text-muted">{accounts[l.account_id]?.number}</td>
                              <td className="py-1">{accounts[l.account_id]?.label}{l.label ? <span className="text-muted"> — {l.label}</span> : null}</td>
                              <td className="w-28 py-1 text-right">{Number(l.debit) ? formatEUR(Number(l.debit)) : ""}</td>
                              <td className="w-28 py-1 text-right">{Number(l.credit) ? formatEUR(Number(l.credit)) : ""}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {e.reference && <p className="mt-1 text-xs text-muted">Référence : {e.reference}</p>}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

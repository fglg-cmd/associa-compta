"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import * as D from "@radix-ui/react-dialog";
import { ArrowLeftRight, FileText, FolderKanban, ListOrdered, Plus, Upload, UserPlus, Users, Loader2 } from "lucide-react";
import { formatEUR } from "@associa/accounting";
import { globalSearch, type SearchHit } from "@/modules/search/actions";
import { NAV, SETTINGS_NAV } from "./nav";

const HIT_ICON = { member: Users, document: FileText, transaction: ArrowLeftRight, entry: ListOrdered, project: FolderKanban };

export function CommandPalette({ slug, canWrite, aiEnabled = true }: { slug: string; canWrite: boolean; aiEnabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, start] = useTransition();
  const base = `/app/${slug}`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => start(async () => setHits(await globalSearch(slug, query))), 180);
    return () => clearTimeout(t);
  }, [query, slug]);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const actions = canWrite
    ? [
        { label: "Importer un relevé bancaire", icon: Upload, href: `${base}/banque?action=importer` },
        { label: "Saisir une recette ou une dépense", icon: Plus, href: `${base}/operations?action=nouvelle` },
        { label: "Ajouter un justificatif", icon: FileText, href: `${base}/justificatifs?action=ajouter` },
        { label: "Ajouter un adhérent", icon: UserPlus, href: `${base}/adherents?action=ajouter` },
        { label: "Créer un projet ou un événement", icon: FolderKanban, href: `${base}/projets?action=creer` },
      ]
    : [];

  const item = "flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted";

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <D.Content className="fixed left-1/2 top-[14vh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <D.Title className="sr-only">Palette de commandes</D.Title>
          <D.Description className="sr-only">Rechercher et naviguer</D.Description>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-2 border-b border-border px-3.5">
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Rechercher un adhérent, un justificatif, une opération…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
              />
              {pending && <Loader2 className="size-4 animate-spin text-subtle" />}
            </div>
            <Command.List className="max-h-[56vh] overflow-y-auto p-1.5 scrollbar-thin">
              <Command.Empty className="px-3 py-8 text-center text-[13px] text-muted">
                {query.length >= 2 && !pending ? "Aucun résultat." : "Tapez au moins deux caractères."}
              </Command.Empty>
              {hits.length > 0 && (
                <Command.Group heading="Résultats" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-subtle">
                  {hits.map((h) => {
                    const Icon = HIT_ICON[h.type];
                    return (
                      <Command.Item key={`${h.type}-${h.id}`} value={`${h.type}-${h.id}`} onSelect={() => go(h.href)} className={item}>
                        <Icon />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{h.title}</span>
                          <span className="block truncate text-xs text-muted">{h.subtitle}</span>
                        </span>
                        {h.amount !== undefined && <span className="tabular text-xs text-muted">{formatEUR(h.amount)}</span>}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}
              {query.length < 2 && (
                <>
                  {actions.length > 0 && (
                    <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-subtle">
                      {actions.map((a) => (
                        <Command.Item key={a.label} value={a.label} onSelect={() => go(a.href)} className={item}>
                          <a.icon /> {a.label}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}
                  <Command.Group heading="Navigation" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-subtle">
                    {[...NAV.filter((n) => aiEnabled || n.href !== "/assistant"), SETTINGS_NAV].map((n) => (
                      <Command.Item key={n.label} value={n.label} onSelect={() => go(base + n.href)} className={item}>
                        <n.icon /> <span className="flex-1">{n.label}</span>
                        {"shortcut" in n && <span className="font-mono text-[11px] text-subtle">{n.shortcut}</span>}
                      </Command.Item>
                    ))}
                  </Command.Group>
                </>
              )}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

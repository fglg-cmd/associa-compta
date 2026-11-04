"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Bot, MessageSquarePlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/ui/markdown";
import { cn, fmtDateShort } from "@/lib/utils";

const SUGGESTIONS = [
  "Fais-moi un point sur la situation financière de l'association.",
  "Y a-t-il des anomalies à corriger avant la clôture ?",
  "Explique-moi simplement la différence entre le résultat et la trésorerie.",
  "Quels sont nos trois plus gros postes de dépenses et comment les réduire ?",
  "Comment préparer la présentation des comptes à l'assemblée générale ?",
  "Notre trésorerie tiendra-t-elle les six prochains mois ?",
];

type Msg = { id: string; role: "user" | "assistant"; content: string };

export function Chat({ orgId, slug, enabled, conversationId, conversations, initialMessages, quota }: {
  orgId: string; slug: string; enabled: boolean; conversationId: string | null;
  conversations: { id: string; title: string; updated_at: string }[]; initialMessages: Msg[]; quota: { used: number; limit: number };
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [convId, setConvId] = useState(conversationId);
  const end = useRef<HTMLDivElement>(null);
  const base = `/app/${slug}/assistant`;

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    const assistantId = crypto.randomUUID();
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: q }, { id: assistantId, role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId, conversationId: convId, message: q }) });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Erreur" }));
        setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: `⚠️ ${err.error}` } : x)));
        return;
      }
      const newId = res.headers.get("X-Conversation-Id");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, content: x.content + chunk } : x)));
      }
      if (newId && !convId) {
        setConvId(newId);
        window.history.replaceState(null, "", `${base}?c=${newId}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="-my-2 grid h-[calc(100dvh-7rem)] gap-6 lg:h-[calc(100dvh-4rem)] lg:grid-cols-[220px_1fr]">
      <aside className="hidden flex-col gap-1 overflow-y-auto scrollbar-thin lg:flex">
        <Button asChild variant="secondary" className="mb-2 justify-start"><Link href={base}><MessageSquarePlus /> Nouvelle conversation</Link></Button>
        {conversations.map((c) => (
          <Link key={c.id} href={`${base}?c=${c.id}`} className={cn("rounded-md px-2.5 py-1.5 text-[13px]", c.id === convId ? "bg-surface font-medium shadow-xs border border-border" : "border border-transparent text-muted hover:bg-surface-2")}>
            <span className="block truncate">{c.title}</span>
            <span className="text-[11px] text-subtle">{fmtDateShort(c.updated_at)}</span>
          </Link>
        ))}
      </aside>

      <section className="flex min-h-0 flex-col rounded-xl border border-border bg-surface shadow-xs">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-accent-soft text-accent"><Sparkles className="size-4" /></span><div><div className="text-sm font-semibold">Assistant financier</div><div className="text-xs text-muted">Il connaît vos comptes, jamais ceux des autres associations.</div></div></div>
          <span className="text-xs text-muted tabular">{quota.used} / {quota.limit} ce mois-ci</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 scrollbar-thin">
          {!enabled ? (
            <div className="grid h-full place-items-center text-center text-[13px] text-muted">L&apos;assistant n&apos;est pas activé sur cette installation.</div>
          ) : messages.length === 0 ? (
            <div className="mx-auto grid max-w-xl gap-6 pt-8 text-center">
              <div><Bot className="mx-auto size-8 text-accent" /><h2 className="mt-3 text-lg font-semibold">Que voulez-vous savoir ?</h2><p className="mt-1 text-[13px] text-muted">Posez une question sur vos finances, la comptabilité ou votre prochaine AG.</p></div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)} className="rounded-lg border border-border px-3 py-2.5 text-left text-[13px] hover:border-accent hover:bg-accent-soft/40">{s}</button>)}
              </div>
            </div>
          ) : (
            <div className="mx-auto grid max-w-2xl gap-5">
              {messages.map((m) => (
                <div key={m.id} className={cn("text-[14px]", m.role === "user" ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-accent-foreground" : "")}>
                  {m.role === "user" ? m.content : m.content ? <Markdown text={m.content} /> : <span className="inline-flex gap-1 text-subtle"><span className="animate-pulse">●</span><span className="animate-pulse [animation-delay:150ms]">●</span><span className="animate-pulse [animation-delay:300ms]">●</span></span>}
                </div>
              ))}
              <div ref={end} />
            </div>
          )}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t border-border p-3">
          <div className="mx-auto flex max-w-2xl items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              disabled={!enabled}
              placeholder="Posez votre question…"
              className="max-h-40 min-h-6 flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-subtle"
            />
            <Button type="submit" size="icon-sm" variant="primary" disabled={!input.trim() || busy || !enabled} aria-label="Envoyer"><ArrowUp /></Button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-subtle">L&apos;assistant peut se tromper : vérifiez les points importants avec votre expert-comptable.</p>
        </form>
      </section>
    </div>
  );
}

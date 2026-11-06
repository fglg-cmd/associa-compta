"use client";
import { useState } from "react";
import { Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function AgReport({ orgId, fiscalYearId, aiEnabled }: { orgId: string; fiscalYearId: string; aiEnabled: boolean }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function generate() {
    setBusy(true);
    setText("");
    try {
      const res = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId, message: "Exercice sélectionné ci-dessus.", mode: "ag-report", fiscalYearId }) });
      if (!res.ok || !res.body) { toast.error((await res.json().catch(() => ({}))).error ?? "Échec"); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((t) => t + dec.decode(value, { stream: true }));
      }
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      const fd = new FormData();
      fd.set("narrative", text);
      fd.set("exercice", fiscalYearId);
      const res = await fetch(`/api/exports/${orgId}`, { method: "POST", body: fd });
      if (!res.ok) { toast.error((await res.json().catch(() => ({}))).error ?? "Échec"); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "rapport-ag.pdf";
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} placeholder={aiEnabled ? "Cliquez sur « Rédiger avec l'assistant » ou écrivez votre rapport ici…" : "Rédigez ici le rapport du trésorier (facultatif) : il sera inclus en tête du dossier PDF."} className="text-[13.5px] leading-relaxed" />
      <div className="flex flex-wrap justify-end gap-2">
        {aiEnabled && <Button onClick={generate} loading={busy}><Sparkles /> {text ? "Régénérer" : "Rédiger avec l'assistant"}</Button>}
        <Button variant="primary" onClick={download} loading={downloading} disabled={busy}><Download /> Télécharger le dossier d&apos;AG (PDF)</Button>
      </div>
    </div>
  );
}

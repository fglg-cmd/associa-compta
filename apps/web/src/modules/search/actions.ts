"use server";
import { getOrgContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface SearchHit {
  type: "member" | "document" | "transaction" | "entry" | "project";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  amount?: number;
}

/** Recherche globale (⌘K) : adhérents, justificatifs (plein texte OCR), mouvements, écritures, projets. */
export async function globalSearch(slug: string, query: string): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 80);
  if (q.length < 2) return [];
  const { org } = await getOrgContext(slug);
  const supabase = await createClient();
  const term = q.replace(/[%_,().*\\"]/g, " ").replace(/\s+/g, " ").trim();
  if (term.length < 2) return [];
  const like = `%${term}%`;
  const base = `/app/${slug}`;

  const [members, docs, txs, entries, projects] = await Promise.all([
    supabase.from("members").select("id, first_name, last_name, email, member_number").eq("organization_id", org.id)
      .or(`last_name.ilike.${like},first_name.ilike.${like},email.ilike.${like}`).limit(5),
    supabase.rpc("search_documents", { p_org: org.id, p_query: q, p_limit: 5 }),
    supabase.from("bank_transactions").select("id, label, date, amount").eq("organization_id", org.id).ilike("label", like).order("date", { ascending: false }).limit(5),
    supabase.from("journal_entries").select("id, label, date, entry_number").eq("organization_id", org.id).ilike("label", like).order("date", { ascending: false }).limit(5),
    supabase.from("projects").select("id, name, kind").eq("organization_id", org.id).ilike("name", like).limit(3),
  ]);

  const hits: SearchHit[] = [];
  for (const m of members.data ?? []) hits.push({ type: "member", id: m.id, title: `${m.first_name} ${m.last_name}`, subtitle: `Adhérent n° ${m.member_number}${m.email ? ` · ${m.email}` : ""}`, href: `${base}/adherents/${m.id}` });
  for (const d of (docs.data ?? []) as { id: string; name: string; folder: string; extracted_amount: number | null }[])
    hits.push({ type: "document", id: d.id, title: d.name, subtitle: d.folder, href: `${base}/justificatifs?doc=${d.id}`, amount: d.extracted_amount ?? undefined });
  for (const t of txs.data ?? []) hits.push({ type: "transaction", id: t.id, title: t.label, subtitle: `Mouvement du ${t.date}`, href: `${base}/banque?q=${encodeURIComponent(t.label)}`, amount: t.amount });
  for (const e of entries.data ?? []) hits.push({ type: "entry", id: e.id, title: e.label, subtitle: `Écriture${e.entry_number ? ` n° ${e.entry_number}` : ""} du ${e.date}`, href: `${base}/operations?ecriture=${e.id}` });
  for (const p of projects.data ?? []) hits.push({ type: "project", id: p.id, title: p.name, subtitle: p.kind === "event" ? "Événement" : "Projet", href: `${base}/projets/${p.id}` });
  return hits;
}

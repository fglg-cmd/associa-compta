import { Fragment } from "react";

/** Rendu Markdown minimal et sûr (aucun HTML injecté) : titres, listes, gras, italique, code. */
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^(\*[^*]+\*|_[^_]+_)$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="rounded bg-surface-2 px-1 text-[12px]">{p.slice(1, -1)}</code>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const L = list.ordered ? "ol" : "ul";
    blocks.push(<L key={blocks.length} className={list.ordered ? "ml-5 list-decimal space-y-1" : "ml-5 list-disc space-y-1"}>{list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}</L>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const ul = line.match(/^\s*[-*•]\s+(.*)/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (ul || ol) {
      const ordered = Boolean(ol);
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((ul ?? ol)![1]!);
      continue;
    }
    flush();
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) blocks.push(<p key={blocks.length} className="mt-2 font-semibold">{inline(h[2]!)}</p>);
    else if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-2 leading-relaxed">{blocks}</div>;
}

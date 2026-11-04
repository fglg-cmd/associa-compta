export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl font-semibold tracking-[-0.025em]">{title}</h1>
      <p className="mt-2 text-sm text-muted">Dernière mise à jour : {updated}</p>
      <div className="mt-10 grid gap-6 text-[14.5px] leading-relaxed text-foreground/90 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1">{children}</div>
    </main>
  );
}

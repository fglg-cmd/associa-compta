import { cn } from "@/lib/utils";

/*
 * Logo ASSOCIA COMPTA : carré violet en dégradé, « A » blanc ; mot-symbole
 * « Associa » (encre) + « Compta » (couleur de marque).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid size-6 shrink-0 place-items-center rounded-[28%] bg-[linear-gradient(150deg,var(--brand-light),var(--brand-dark))] shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_2px_6px_-2px_color-mix(in_oklch,var(--brand)_60%,transparent)]",
        className,
      )}
    >
      <svg viewBox="0 0 32 32" className="size-[72%]">
        <path d="M9 23.5 15.2 8.8a.9.9 0 0 1 1.6 0L23 23.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M11.8 18h8.4" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[17px] font-bold tracking-[-0.03em]", className)} aria-label="Associa Compta">
      <LogoMark className="size-7" />
      <span aria-hidden>
        <span className="text-foreground">Associa</span> <span className="text-brand">Compta</span>
      </span>
    </span>
  );
}

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path d="M9 22.5 15.2 8.8a.9.9 0 0 1 1.6 0L23 22.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M12 17.5h8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold tracking-[-0.02em]", className)}>
      <LogoMark />
      <span>
        Associa<span className="text-muted font-medium"> Compta</span>
      </span>
    </span>
  );
}

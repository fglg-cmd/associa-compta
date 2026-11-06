import * as React from "react";
import { formatEUR } from "@associa/accounting";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.025em]">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="relative mb-5">
        <div aria-hidden className="absolute -inset-3 rounded-2xl bg-[radial-gradient(circle,color-mix(in_oklch,var(--accent)_14%,transparent),transparent_70%)]" />
        <div className="relative grid size-12 place-items-center rounded-xl border border-border bg-surface shadow-sm">
          <Icon className="size-5 text-accent" />
        </div>
      </div>
      <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Montant formaté, coloré selon le signe si demandé. */
export function Amount({
  cents,
  colored,
  signed,
  className,
  compact,
}: {
  cents: number;
  colored?: boolean;
  signed?: boolean;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "tabular whitespace-nowrap",
        colored && cents > 0 && "text-positive",
        colored && cents < 0 && "text-foreground",
        className,
      )}
    >
      {formatEUR(cents, { signed, compact })}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-2 px-1 font-mono text-[10.5px] text-muted">
      {children}
    </kbd>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("mb-3 text-[13px] font-semibold uppercase tracking-wider text-subtle", className)}>{children}</h2>;
}

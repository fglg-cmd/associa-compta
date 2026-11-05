import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-md border border-border bg-surface px-2.5 text-sm text-foreground shadow-xs transition-colors placeholder:text-subtle hover:border-border-strong focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15 disabled:opacity-60 aria-[invalid=true]:border-negative";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(field, "h-8", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(field, "min-h-20 py-2", className)} {...props} />,
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        field,
        "h-8 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22%2371717a%22 stroke-width=%221.5%22><path d=%22m4 6 4 4 4-4%22/></svg>')] bg-[length:14px] bg-[right_8px_center] bg-no-repeat pr-7",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-[13px] font-medium text-foreground", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const message = error ? <p className="text-xs text-negative">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null;
  // Sans identifiant explicite, l'étiquette englobe le champ : association implicite
  // (clic sur l'intitulé, lecteurs d'écran, accessibilité RGAA).
  if (label && !htmlFor) {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-foreground">{label}</span>
          {children}
        </label>
        {message}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {message}
    </div>
  );
}

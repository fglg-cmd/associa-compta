"use client";
import { CATEGORIES } from "@associa/accounting";
import { Select } from "@/components/ui/input";
import type { Account } from "@/lib/types";

/**
 * Sélecteur de compte « langage humain » : catégories usuelles d'abord,
 * puis le plan comptable complet pour les utilisateurs avancés.
 */
export function AccountSelect({
  accounts,
  direction,
  value,
  onChange,
  name,
  required,
  className,
  placeholder = "Choisir une catégorie…",
  exclude,
  onlyClasses,
  labelFirst,
}: {
  accounts: Pick<Account, "id" | "number" | "label" | "is_active">[];
  direction?: "in" | "out";
  value?: string;
  onChange?: (id: string) => void;
  name?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
  exclude?: string[];
  onlyClasses?: number[];
  /** Intitulé avant le numéro de compte (vocabulaire du trésorier plutôt que du comptable). */
  labelFirst?: boolean;
}) {
  const active = accounts.filter((a) => a.is_active && !exclude?.includes(a.id) && (!onlyClasses || onlyClasses.includes(Number(a.number[0]))));
  const byNumber = new Map(active.map((a) => [a.number, a]));
  const cats = onlyClasses ? [] : CATEGORIES.filter((c) => !direction || c.direction === direction).filter((c) => byNumber.has(c.account));
  const groups: { label: string; test: (n: string) => boolean }[] = [
    { label: "Produits (7)", test: (n) => n.startsWith("7") },
    { label: "Charges (6)", test: (n) => n.startsWith("6") },
    { label: "Tiers (4)", test: (n) => n.startsWith("4") },
    { label: "Trésorerie (5)", test: (n) => n.startsWith("5") },
    { label: "Immobilisations et stocks (2-3)", test: (n) => /^[23]/.test(n) },
    { label: "Fonds propres et dettes financières (1)", test: (n) => n.startsWith("1") },
    { label: "Contributions en nature (8)", test: (n) => n.startsWith("8") },
  ];
  const ordered = direction === "in" ? [groups[0]!, ...groups.slice(1)] : direction === "out" ? [groups[1]!, groups[0]!, ...groups.slice(2)] : groups;

  return (
    <Select
      name={name}
      required={required}
      className={className}
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
    >
      <option value="" disabled>{placeholder}</option>
      {cats.length > 0 && (
        <optgroup label="Catégories courantes">
          {cats.map((c) => (
            <option key={c.key} value={byNumber.get(c.account)!.id}>{c.label}</option>
          ))}
        </optgroup>
      )}
      {ordered.map((g) => {
        const list = active.filter((a) => g.test(a.number));
        if (!list.length) return null;
        return (
          <optgroup key={g.label} label={g.label}>
            {list.map((a) => (
              <option key={a.id} value={a.id}>{labelFirst ? `${a.label} (${a.number})` : `${a.number} · ${a.label}`}</option>
            ))}
          </optgroup>
        );
      })}
    </Select>
  );
}

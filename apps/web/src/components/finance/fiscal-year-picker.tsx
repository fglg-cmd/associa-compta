"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/input";
import type { FiscalYear } from "@/lib/types";

export function FiscalYearPicker({ years, current }: { years: FiscalYear[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  if (years.length < 2) return null;
  return (
    <Select
      value={current}
      className="w-auto min-w-44"
      aria-label="Exercice"
      onChange={(e) => {
        const u = new URLSearchParams(sp.toString());
        u.set("exercice", e.target.value);
        u.delete("page");
        router.push(`${pathname}?${u}`);
      }}
    >
      {years.map((y) => (
        <option key={y.id} value={y.id}>{y.label}{y.status === "closed" ? " (clôturé)" : ""}</option>
      ))}
    </Select>
  );
}

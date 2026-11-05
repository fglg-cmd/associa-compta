import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DATE = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const DATE_SHORT = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", timeZone: "UTC" });
const DATE_NUM = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
const MONTH_LONG = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

const asDate = (d: string | Date) => (typeof d === "string" ? new Date(d.length === 10 ? `${d}T00:00:00Z` : d) : d);

export const fmtDate = (d: string | Date) => DATE.format(asDate(d));
export const fmtDateShort = (d: string | Date) => DATE_SHORT.format(asDate(d));
export const fmtDateNum = (d: string | Date) => DATE_NUM.format(asDate(d));
export const fmtMonth = (d: string | Date) => MONTH.format(asDate(d)).replace(".", "");
export const fmtMonthLong = (d: string | Date) => MONTH_LONG.format(asDate(d));

/** Date du jour à Paris (et non en UTC : à 0 h 30 en France, l'UTC est encore la veille). */
export function todayISO(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(new Date());
}

/** N'accepte qu'un chemin interne au site, pour éviter toute redirection vers un site tiers. */
export function safeNextPath(raw: string | null | undefined, fallback = "/app"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\") || /[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

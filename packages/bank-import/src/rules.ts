/**
 * Moteur de catégorisation automatique.
 * 1. Règles de l'association (créées par l'utilisateur ou apprises).
 * 2. À défaut, mots-clés des catégories standards (plan associatif).
 */
import { CATEGORIES, type Category } from "@associa/accounting";

export interface Rule {
  id: string;
  matchType: "contains" | "starts_with" | "equals" | "regex";
  pattern: string;
  direction: "any" | "in" | "out";
  minAmount?: number | null;
  maxAmount?: number | null;
  accountId: string;
  projectId?: string | null;
  priority: number;
  isActive: boolean;
}

export interface Suggestion {
  accountId?: string;
  accountNumber?: string;
  projectId?: string | null;
  ruleId?: string;
  source: "rule" | "keyword";
  confidence: number;
}

export const normalizeForMatch = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

const regexCache = new Map<string, RegExp | null>();
function safeRegex(pattern: string): RegExp | null {
  if (regexCache.has(pattern)) return regexCache.get(pattern)!;
  let re: RegExp | null = null;
  // Garde-fou anti-ReDoS : longueur bornée, pas de quantificateurs imbriqués
  if (pattern.length <= 200 && !/(\+|\*|\{\d+,?\d*\})\)?(\+|\*|\{)/.test(pattern)) {
    try {
      re = new RegExp(pattern, "i");
    } catch {
      re = null;
    }
  }
  regexCache.set(pattern, re);
  return re;
}

export function ruleMatches(rule: Rule, label: string, amount: number): boolean {
  if (!rule.isActive) return false;
  if (rule.direction === "in" && amount < 0) return false;
  if (rule.direction === "out" && amount > 0) return false;
  const abs = Math.abs(amount);
  if (rule.minAmount != null && abs < rule.minAmount) return false;
  if (rule.maxAmount != null && abs > rule.maxAmount) return false;
  const l = normalizeForMatch(label);
  const p = normalizeForMatch(rule.pattern);
  switch (rule.matchType) {
    case "contains": return l.includes(p);
    case "starts_with": return l.startsWith(p);
    case "equals": return l === p;
    case "regex": return safeRegex(rule.pattern)?.test(label) ?? false;
  }
}

export function categorize(
  tx: { label: string; rawLabel?: string; amount: number },
  rules: Rule[],
  opts: { excludeCategories?: readonly string[] } = {},
): Suggestion | null {
  const text = `${tx.label} ${tx.rawLabel ?? ""}`;
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const r of sorted) {
    if (ruleMatches(r, text, tx.amount)) {
      return { accountId: r.accountId, projectId: r.projectId, ruleId: r.id, source: "rule", confidence: 0.95 };
    }
  }
  const l = ` ${normalizeForMatch(text)} `;
  const dir = tx.amount > 0 ? "in" : "out";
  let best: { cat: Category; len: number } | null = null;
  for (const cat of CATEGORIES) {
    if (cat.direction !== dir || opts.excludeCategories?.includes(cat.key)) continue;
    for (const kw of cat.keywords) {
      const k = normalizeForMatch(kw);
      if (k && l.includes(k.length <= 4 ? ` ${k} ` : k) && (!best || k.length > best.len)) {
        best = { cat, len: k.length };
      }
    }
  }
  return best ? { accountNumber: best.cat.account, source: "keyword", confidence: 0.6 } : null;
}

const STOPWORDS = new Set([
  "carte", "cb", "prelevement", "virement", "recu", "emis", "sepa", "paiement", "achat", "retrait",
  "de", "du", "des", "la", "le", "les", "et", "a", "au", "pour", "par", "en", "sur", "frm", "motif", "ref",
]);

/**
 * Propose un motif de règle à partir d'un libellé que l'utilisateur vient de
 * catégoriser (« Carte Leroy Merlin 12/03 » → « leroy merlin »).
 */
export function suggestRulePattern(label: string): string | null {
  const words = normalizeForMatch(label)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w) && !/\d{2}/.test(w));
  if (!words.length) return null;
  return words.slice(0, 2).join(" ");
}

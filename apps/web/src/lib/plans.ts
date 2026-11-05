/**
 * Offres commerciales et limites. Appliquées côté serveur avant chaque action.
 */
export type PlanTier = "free" | "essential" | "pro";

export interface PlanDef {
  tier: PlanTier;
  name: string;
  tagline: string;
  monthly: number; // centimes HT
  yearly: number; // centimes HT
  limits: {
    bankAccounts: number;
    documents: number;
    members: number;
    aiMessagesPerMonth: number;
    seats: number;
  };
  features: string[];
}

export const PLANS: Record<PlanTier, PlanDef> = {
  free: {
    tier: "free",
    name: "Découverte",
    tagline: "Pour démarrer sereinement",
    monthly: 0,
    yearly: 0,
    limits: { bankAccounts: 1, documents: 100, members: 50, aiMessagesPerMonth: 10, seats: 2 },
    features: ["1 compte bancaire", "Import CSV, OFX, QIF", "Comptabilité en partie double", "Compte de résultat et bilan", "50 adhérents", "100 justificatifs", "10 questions à l'assistant / mois"],
  },
  essential: {
    tier: "essential",
    name: "Essentiel",
    tagline: "Pour les associations actives",
    monthly: 900,
    yearly: 9000,
    limits: { bankAccounts: 3, documents: 2000, members: 500, aiMessagesPerMonth: 50, seats: 5 },
    features: ["3 comptes bancaires", "500 adhérents et relances automatiques", "2 000 justificatifs avec OCR", "Projets et événements", "Exports PDF et Excel", "50 questions à l'assistant / mois", "5 membres du bureau"],
  },
  pro: {
    tier: "pro",
    name: "Pro",
    tagline: "Pour les fédérations et structures employeuses",
    monthly: 1900,
    yearly: 19000,
    limits: { bankAccounts: 50, documents: 100000, members: 100000, aiMessagesPerMonth: 300, seats: 50 },
    features: ["Comptes bancaires illimités", "Adhérents illimités", "Justificatifs illimités", "300 questions à l'assistant / mois", "Accès commissaire aux comptes", "Support prioritaire"],
  },
};

export function planOf(tier: string | null | undefined): PlanDef {
  return PLANS[(tier as PlanTier) ?? "free"] ?? PLANS.free;
}

/** Liste des avantages affichée, sans les mentions de l'assistant si l'IA est coupée. */
export function planFeatures(plan: PlanDef, aiEnabled: boolean): string[] {
  return aiEnabled ? plan.features : plan.features.filter((f) => !/assistant/i.test(f));
}

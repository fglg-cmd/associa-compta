import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { renderPdf } from "./pdf";

describe("export PDF", () => {
  it("génère un PDF valide (compte de résultat + rapport rédigé)", async () => {
    const buf = await renderPdf({
      orgName: "Les Amis du Quartier",
      orgDetails: "RNA W751234567 · Lyon",
      title: "Compte de résultat",
      subtitle: "Exercice 2026",
      kpis: [{ label: "Produits", value: 153000 }, { label: "Charges", value: 17040 }],
      narrative: "Rapport financier.\n\nLe résultat est excédentaire.",
      tables: [{ title: "Compte de résultat", columns: [{ key: "label", label: "Rubrique", width: 60 }, { key: "amount", label: "Montant", type: "money" }],
        rows: [{ label: "Produits d'exploitation", amount: null }, { label: "  Cotisations", amount: 3000 }, { label: "EXCÉDENT DE L'EXERCICE", amount: 135960 }] }],
    });
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1000);
  }, 30000);
});

import { describe, expect, it } from "vitest";
import { extractAmount, extractDate, extractVendor } from "./ocr-extract";

const invoice = `LEROY MERLIN FRANCE SAS
Rue Chanzy 59260 Lezennes
Facture n° F-2026-0042
Date : 12/03/2026
Désignation            Qté   Prix
Peinture blanche 10L    2   45,90
Rouleau                 1    8,50
Total HT                    83,58 €
TVA 20%                     16,72 €
Total TTC                  100,30 €
Échéance : 12/04/2026`;

describe("extraction OCR", () => {
  it("trouve le total TTC", () => expect(extractAmount(invoice)).toBe(10030));
  it("privilégie la date de facture à l'échéance", () => expect(extractDate(invoice)).toBe("2026-03-12"));
  it("trouve le fournisseur", () => expect(extractVendor(invoice)).toBe("LEROY MERLIN FRANCE SAS"));
  it("gère « net à payer » et les milliers", () => {
    expect(extractAmount("Sous-total 1 000,00\nRemise 50,00\nNet à payer : 1 250,00 €")).toBe(125000);
  });
  it("gère les dates en toutes lettres", () => {
    expect(extractDate("Reçu émis le 3 février 2026")).toBe("2026-02-03");
  });
  it("repli sur le plus grand montant en euros", () => {
    expect(extractAmount("Article A 12,00 €\nArticle B 30,50 €")).toBe(3050);
  });
  it("renvoie null sans montant", () => expect(extractAmount("Bonjour")).toBeNull());
});

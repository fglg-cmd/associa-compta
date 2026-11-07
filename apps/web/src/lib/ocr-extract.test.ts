import { describe, expect, it } from "vitest";
import { detectDirection, extractAmount, extractDate, extractFields, extractReference, extractVendor } from "./ocr-extract";

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

  it("lit les montants sans centimes (« 2940€ »)", () => {
    expect(extractAmount("Soustotal: | 2450€\nTVA (20%) : 490€\nTOTAL: — 2940€")).toBe(294000);
  });
  it("ignore le sous-total et la ligne de TVA", () => {
    expect(extractAmount("Sous-total 2 450 €\nTotal TVA 490 €\nTotal 2 940 €")).toBe(294000);
  });
  it("accepte « € 125 » et « 1.250 EUR »", () => {
    expect(extractAmount("Montant à régler : € 125")).toBe(12500);
    expect(extractAmount("Net à payer 1.250 EUR")).toBe(125000);
  });
  it("accepte un entier seul en fin de ligne de total", () => {
    expect(extractAmount("TOTAL TTC : 2940")).toBe(294000);
    expect(extractAmount("Total 3 articles")).toBeNull();
  });
  it("trouve le numéro de facture", () => {
    expect(extractReference(invoice)).toBe("F-2026-0042");
    expect(extractReference("#12345\nCélia Naudin")).toBe("12345");
    expect(extractReference("Facture\nDate : 12/03/2026")).toBeNull();
  });
  it("n'indique pas l'association elle-même comme fournisseur", () => {
    expect(extractVendor("Club de Tennis TTS\nLEROY MERLIN FRANCE SAS", ["Club de tennis TTS"])).toBe("LEROY MERLIN FRANCE SAS");
  });
  it("facture réelle lue par OCR (photo basse résolution)", () => {
    const ocr = `#12345
Célia Naudin

123-456-7600 Date c'émision 0/01/2026
helogrealygreiste com Enreprise Concordia
Description
Création de logo 1000 €
Carte de visite 300 €
Refonte du site web 900 €
Bannière publicitaire 250 €
Soustotal: | 2450€
TVA (20%) : 490€
TOTAL: — 2940€
Paiement sous 30 jours
N° de compte 0123 4567 8901 2345`;
    const f = extractFields(ocr);
    expect(f.amount).toBe(294000);
    expect(f.vendor).toBe("Célia Naudin");
    expect(f.reference).toBe("12345");
  });

  it("facture reçue = dépense, facture émise par l'association = recette", () => {
    const recue = "#12345\nCélia Naudin\n123 rue\nEntreprise Concordia\nTOTAL 2940€";
    expect(detectDirection(recue, ["Entreprise Concordia"])).toBe("out");
    const emise = "Club de Tennis TTS\n12 rue du stade\nFacture n° 2026-004\nClient : Mairie de Rennes\nTotal 500,00 €";
    expect(detectDirection(emise, ["Club de tennis TTS"])).toBe("in");
    const clientEnTete = "Client : Club de Tennis TTS\nLEROY MERLIN\nTotal 50,00 €";
    expect(detectDirection(clientEnTete, ["Club de tennis TTS"])).toBe("out");
    expect(detectDirection("LEROY MERLIN\nTotal 50,00 €", ["TTS"])).toBe("out");
  });
});

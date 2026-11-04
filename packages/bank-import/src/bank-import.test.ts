import { describe, expect, it } from "vitest";
import {
  analyzeCsv,
  categorize,
  cleanLabel,
  decodeBankFile,
  detectFormat,
  fingerprintTransactions,
  parseBankFile,
  parseDate,
  parseOfx,
  parseQif,
  suggestRulePattern,
  type Rule,
} from "./index";

const enc = (s: string) => new TextEncoder().encode(s);

/** Encode en Windows-1252 (cas réel des exports Crédit Agricole / LBP) */
function win1252(s: string): Uint8Array {
  const map: Record<string, number> = { "é": 0xe9, "è": 0xe8, "ê": 0xea, "à": 0xe0, "ç": 0xe7, "€": 0x80, "É": 0xc9 };
  return Uint8Array.from([...s].map((c) => map[c] ?? c.charCodeAt(0)));
}

describe("parseDate", () => {
  it.each([
    ["12/03/2026", "2026-03-12"],
    ["12/03/26", "2026-03-12"],
    ["2026-03-12", "2026-03-12"],
    ["20260312", "2026-03-12"],
    ["12.03.2026", "2026-03-12"],
    ["12 mars 2026", "2026-03-12"],
    ["1 juil. 2026", "2026-07-01"],
    ["3 juin 2026", "2026-06-03"],
  ])("%s", (i, o) => expect(parseDate(i)).toBe(o));
  it("refuse les dates impossibles", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("Solde au")).toBeNull();
  });
});

describe("cleanLabel", () => {
  it("rend les libellés lisibles", () => {
    expect(cleanLabel("CB LEROY MERLIN 12/03 X1234")).toBe("Carte Leroy Merlin");
    expect(cleanLabel("PRLV SEPA EDF CLIENTS PARTICULIERS")).toBe("Prélèvement Edf Clients Particuliers");
    expect(cleanLabel("VIR SEPA RECU /FRM DUPONT JEAN")).toBe("Virement reçu Dupont Jean");
  });
});

describe("CSV Crédit Agricole (préambule, Windows-1252, débit/crédit séparés)", () => {
  const file = win1252(
    [
      "Téléchargement du 04/11/2026;",
      "",
      "Compte courant ASSOCIATION n° 12345678901;",
      "Solde au 03/11/2026 1 234,56 €;",
      "",
      "Date;Libellé;Débit euros;Crédit euros;",
      "02/11/2026;\"CARTE X1234 01/11 LEROY MERLIN\";45,90;;",
      "28/10/2026;\"VIR SEPA RECU /FRM DUPONT JEAN /MOTIF COTISATION 2026\";;30,00;",
      "28/10/2026;\"VIR SEPA RECU /FRM DUPONT JEAN /MOTIF COTISATION 2026\";;30,00;",
      "15/10/2026;\"PRLV SEPA MAIF\";1 245,00;;",
      "Total;;1 290,90;60,00;",
    ].join("\r\n"),
  );
  const r = parseBankFile("CA20261104.csv", file);

  it("lit toutes les opérations et ignore les lignes de total", () => {
    expect(r.transactions).toHaveLength(4);
    expect(r.transactions[0]).toMatchObject({ date: "2026-11-02", amount: -4590, label: "Carte Leroy Merlin" });
    expect(r.transactions[1]!.amount).toBe(3000);
    expect(r.transactions[3]!.amount).toBe(-124500);
    expect(r.skipped.some((s) => s.reason.includes("date"))).toBe(true);
  });

  it("distingue deux opérations identiques par empreinte", () => {
    const fp = fingerprintTransactions(r.transactions);
    expect(new Set(fp).size).toBe(4);
    // Ré-import : mêmes empreintes → idempotent
    expect(fingerprintTransactions(parseBankFile("x.csv", file).transactions)).toEqual(fp);
  });
});

describe("CSV montant signé, séparateur virgule (Qonto / Shine)", () => {
  const csv = [
    "Settlement date,Counterparty name,Amount,Currency,Reference",
    '2026-10-01,Mairie de Lyon,"1500.00",EUR,Subvention 2026',
    "2026-10-03,OVH,-12.99,EUR,Hébergement",
  ].join("\n");
  it("lit les montants signés", () => {
    const r = parseBankFile("qonto.csv", enc(csv));
    expect(r.transactions.map((t) => t.amount)).toEqual([150000, -1299]);
    expect(r.transactions[0]!.label).toContain("Mairie de Lyon");
  });
});

describe("CSV sans en-tête", () => {
  it("infère les colonnes", () => {
    const csv = "01/10/2026;Achat fournitures papeterie;-25,40\n02/10/2026;Don anonyme;100,00\n03/10/2026;Frais bancaires;-3,50\n";
    const a = analyzeCsv(csv);
    expect(a.mapping).toMatchObject({ date: 0, label: 1, amount: 2, headerRow: -1 });
    const r = parseBankFile("x.csv", enc(csv));
    expect(r.transactions.map((t) => t.amount)).toEqual([-2540, 10000, -350]);
  });
});

const OFX_SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:USASCII
CHARSET:1252

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>20261104</SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STMTRS><CURDEF>EUR
<BANKACCTFROM><BANKID>30004<BRANCHID>00001<ACCTID>00012345678<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261001<DTEND>20261031
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005<TRNAMT>-89.90<FITID>A1B2C3<NAME>CB DECATHLON<MEMO>Ballons
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261012120000[+1:CET]<TRNAMT>250.00<FITID>A1B2C4<NAME>VIR MAIRIE &amp; CO
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1520.10<DTASOF>20261031</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

const OFX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220"?>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>EUR</CURDEF>
<BANKACCTFROM><ACCTID>FR76</ACCTID></BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261020</DTPOSTED><TRNAMT>-15.00</TRNAMT><FITID>X9</FITID><NAME>SACEM</NAME></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe("OFX", () => {
  it("lit l'OFX 1.x SGML", () => {
    const r = parseOfx(OFX_SGML);
    expect(r.transactions).toHaveLength(2);
    expect(r.transactions[0]).toMatchObject({ date: "2026-10-05", amount: -8990, rawLabel: "CB DECATHLON Ballons" });
    expect(r.transactions[1]!.rawLabel).toBe("VIR MAIRIE & CO");
    expect(r.transactions[1]!.date).toBe("2026-10-12");
    expect(r.meta).toMatchObject({ accountId: "00012345678", currency: "EUR", balance: 152010, balanceDate: "2026-10-31" });
    expect(r.transactions[0]!.bankId).toBe("00012345678:A1B2C3");
  });
  it("lit l'OFX 2.x XML", () => {
    const r = parseOfx(OFX_XML);
    expect(r.transactions[0]).toMatchObject({ amount: -1500, label: "Sacem" });
  });
  it("utilise le FITID pour l'empreinte", () => {
    const fp = fingerprintTransactions(parseOfx(OFX_SGML).transactions);
    expect(fp[0]).toMatch(/^id:/);
  });
});

describe("QIF", () => {
  it("lit un QIF français jj/mm/aaaa", () => {
    const q = "!Type:Bank\nD25/10/2026\nT-1 234,50\nPLOYER SALLE\nMoctobre\n^\nD03/11/2026\nT80.00\nPHELLOASSO\n^\n";
    const r = parseQif(q);
    expect(r.transactions).toEqual([
      expect.objectContaining({ date: "2026-10-25", amount: -123450, rawLabel: "LOYER SALLE octobre" }),
      expect.objectContaining({ date: "2026-11-03", amount: 8000 }),
    ]);
  });
});

describe("détection de format", () => {
  it("par extension et contenu", () => {
    expect(detectFormat("releve.ofx", "")).toBe("ofx");
    expect(detectFormat("export.dat", OFX_SGML)).toBe("ofx");
    expect(detectFormat("a.qif", "")).toBe("qif");
    expect(detectFormat("a.csv", "")).toBe("csv");
    expect(() => detectFormat("a.pdf", "%PDF")).toThrow();
  });
  it("décode UTF-8 et Windows-1252", () => {
    expect(decodeBankFile(enc("﻿Libellé"))).toBe("Libellé");
    expect(decodeBankFile(win1252("Libellé €"))).toBe("Libellé €");
  });
});

describe("catégorisation", () => {
  const rules: Rule[] = [
    { id: "r1", matchType: "contains", pattern: "Leroy Merlin", direction: "out", accountId: "acc-6063", priority: 10, isActive: true },
    { id: "r2", matchType: "regex", pattern: "^Virement reçu .*cotisation", direction: "in", accountId: "acc-756", priority: 20, isActive: true },
    { id: "r3", matchType: "contains", pattern: "dupont", direction: "any", minAmount: 100000, accountId: "acc-x", priority: 1, isActive: true },
  ];
  it("applique les règles par priorité et conditions", () => {
    expect(categorize({ label: "Carte Leroy Merlin", amount: -4590 }, rules)).toMatchObject({ accountId: "acc-6063", ruleId: "r1" });
    expect(categorize({ label: "Virement reçu Dupont Jean cotisation 2026", amount: 3000 }, rules)).toMatchObject({ ruleId: "r2" });
    expect(categorize({ label: "Virement reçu Dupont", amount: 200000 }, rules)).toMatchObject({ ruleId: "r3" });
  });
  it("se rabat sur les mots-clés standards", () => {
    expect(categorize({ label: "Prélèvement Maif", amount: -12000 }, [])).toMatchObject({ accountNumber: "616", source: "keyword" });
    expect(categorize({ label: "Prélèvement Urssaf", amount: -50000 }, [])).toMatchObject({ accountNumber: "645" });
    expect(categorize({ label: "Opération inconnue", amount: -100 }, [])).toBeNull();
  });
  it("ne plante pas sur une regex invalide ou dangereuse", () => {
    const bad: Rule[] = [{ id: "b", matchType: "regex", pattern: "(a+)+$", direction: "any", accountId: "x", priority: 1, isActive: true }];
    expect(categorize({ label: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!", amount: -1 }, bad)).toBeNull();
  });
  it("propose un motif de règle", () => {
    expect(suggestRulePattern("Carte Leroy Merlin 12/03")).toBe("leroy merlin");
    expect(suggestRulePattern("Prélèvement Edf Clients")).toBe("edf clients");
  });
});

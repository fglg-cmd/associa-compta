import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("exceljs", () => ({ default: class {} }));
import { toCsv } from "./render";

describe("export CSV", () => {
  it("neutralise les formules Excel venant des libellés", () => {
    const csv = toCsv([{ title: "t", columns: [{ key: "l", label: "Libellé" }, { key: "m", label: "Montant", type: "money" }],
      rows: [{ l: '=HYPERLINK("http://x","clic")', m: -1250 }, { l: "@SUM(A1)", m: 100 }, { l: "Achat normal", m: 5 }] }]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""clic"")"`);
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain("-12,50"); // les montants négatifs restent des nombres
    expect(csv).toContain("Achat normal;0,05");
  });
});

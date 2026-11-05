import "server-only";
import ExcelJS from "exceljs";
import type { Table } from "./tabular";

const money = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));
const date = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10).split("-").reverse().join("/") : String(d ?? ""));

/** CSV français : séparateur « ; », décimales « , », BOM UTF-8 pour Excel. */
export function toCsv(tables: Table[]): string {
  // Un libellé comme « =HYPERLINK(...) » serait exécuté par Excel : on le neutralise.
  const defuse = (v: string) => (/^[=+\-@\t\r]/.test(v) && !/^-?\d+([.,]\d+)?$/.test(v) ? `'${v}` : v);
  const esc = (raw: string) => {
    const v = defuse(raw);
    return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const parts: string[] = [];
  for (const t of tables) {
    if (tables.length > 1) parts.push(esc(t.title));
    parts.push(t.columns.map((c) => esc(c.label)).join(";"));
    for (const r of t.rows) parts.push(t.columns.map((c) => esc(c.type === "money" ? money(r[c.key] as number | null) : c.type === "date" ? date(r[c.key]) : String(r[c.key] ?? ""))).join(";"));
    if (t.totals) parts.push(t.columns.map((c) => esc(c.type === "money" ? money(t.totals![c.key] as number) : String(t.totals![c.key] ?? ""))).join(";"));
    parts.push("");
  }
  return "﻿" + parts.join("\r\n");
}

export async function toXlsx(tables: Table[], orgName: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ASSOCIA COMPTA";
  wb.created = new Date();
  for (const t of tables) {
    const ws = wb.addWorksheet(t.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 31), { views: [{ state: "frozen", ySplit: 3 }] });
    ws.addRow([orgName]).font = { bold: true, size: 13 };
    ws.addRow([t.title]).font = { color: { argb: "FF71717A" } };
    const head = ws.addRow(t.columns.map((c) => c.label));
    head.font = { bold: true };
    head.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F4F5" } };
      cell.border = { bottom: { style: "thin", color: { argb: "FFD4D4D8" } } };
    });
    t.columns.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      col.width = c.width ?? (c.type === "money" ? 15 : 18);
      if (c.type === "money") col.numFmt = '#,##0.00 "€";[Red]-#,##0.00 "€"';
      if (c.type === "date") col.numFmt = "dd/mm/yyyy";
    });
    for (const r of t.rows) {
      ws.addRow(t.columns.map((c) => {
        const v = r[c.key];
        if (c.type === "money") return v == null ? null : Number(v) / 100;
        if (c.type === "date" && typeof v === "string") return new Date(`${v.slice(0, 10)}T00:00:00Z`);
        return v ?? null;
      }));
    }
    if (t.totals) {
      const row = ws.addRow(t.columns.map((c) => (c.type === "money" ? (t.totals![c.key] != null ? Number(t.totals![c.key]) / 100 : null) : t.totals![c.key] ?? null)));
      row.font = { bold: true };
      row.eachCell((cell) => (cell.border = { top: { style: "thin" } }));
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

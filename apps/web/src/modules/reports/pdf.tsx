import "server-only";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { Table } from "./tabular";

const s = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 48, paddingHorizontal: 42, fontSize: 9, fontFamily: "Helvetica", color: "#18181b" },
  brand: { fontSize: 8, color: "#71717a", marginBottom: 18, flexDirection: "row", justifyContent: "space-between" },
  org: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  sub: { fontSize: 10, color: "#52525b", marginBottom: 20 },
  h2: { fontSize: 11.5, fontFamily: "Helvetica-Bold", marginTop: 14, marginBottom: 8 },
  para: { fontSize: 9.5, lineHeight: 1.55, marginBottom: 6, color: "#27272a" },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e4e4e7", paddingVertical: 3.5 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#a1a1aa", paddingVertical: 4, fontFamily: "Helvetica-Bold", color: "#52525b", fontSize: 8 },
  total: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#18181b", paddingVertical: 4, fontFamily: "Helvetica-Bold" },
  section: { fontFamily: "Helvetica-Bold", backgroundColor: "#f4f4f5" },
  kpis: { flexDirection: "row", gap: 8, marginBottom: 12 },
  kpi: { flex: 1, borderWidth: 0.5, borderColor: "#d4d4d8", borderRadius: 4, padding: 8 },
  kpiL: { fontSize: 7.5, color: "#71717a" },
  kpiV: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 3 },
  footer: { position: "absolute", bottom: 24, left: 42, right: 42, fontSize: 7, color: "#a1a1aa", flexDirection: "row", justifyContent: "space-between" },
});

const eur = (c: number | null | undefined) =>
  c == null ? "" : new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100).replace(/ | /g, " ") + " €";
const fdate = (d: unknown) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10).split("-").reverse().join("/") : String(d ?? ""));

function TableView({ t }: { t: Table }) {
  const flexOf = (c: Table["columns"][number]) => (c.type === "money" ? 1.3 : (c.width ?? 14) / 10);
  return (
    <View>
      <Text style={s.h2}>{t.title}</Text>
      <View style={s.head} fixed>
        {t.columns.map((c) => <Text key={c.key} style={{ flex: flexOf(c), textAlign: c.type === "money" ? "right" : "left" }}>{c.label}</Text>)}
      </View>
      {t.rows.map((r, i) => {
        const isSection = t.columns.length === 2 && r[t.columns[1]!.key] == null;
        const isTotal = typeof r.label === "string" && /^(total|résultat|excédent|déficit)/i.test(String(r.label).trim());
        return (
          <View key={i} style={[s.row, isSection ? s.section : {}, isTotal ? { fontFamily: "Helvetica-Bold" } : {}]} wrap={false}>
            {t.columns.map((c) => (
              <Text key={c.key} style={{ flex: flexOf(c), textAlign: c.type === "money" ? "right" : "left", paddingRight: 4 }}>
                {c.type === "money" ? eur(r[c.key] as number | null) : c.type === "date" ? fdate(r[c.key]) : String(r[c.key] ?? "")}
              </Text>
            ))}
          </View>
        );
      })}
      {t.totals && (
        <View style={s.total}>
          {t.columns.map((c) => <Text key={c.key} style={{ flex: flexOf(c), textAlign: c.type === "money" ? "right" : "left" }}>{c.type === "money" ? eur(t.totals![c.key] as number) : String(t.totals![c.key] ?? "")}</Text>)}
        </View>
      )}
    </View>
  );
}

export interface PdfInput {
  orgName: string;
  orgDetails?: string;
  title: string;
  subtitle: string;
  tables: Table[];
  narrative?: string;
  kpis?: { label: string; value: number }[];
  landscape?: boolean;
}

export async function renderPdf(input: PdfInput): Promise<Buffer> {
  const generated = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const doc = (
    <Document title={`${input.title} — ${input.orgName}`} author={input.orgName} creator="ASSOCIA COMPTA" producer="ASSOCIA COMPTA">
      <Page size="A4" orientation={input.landscape ? "landscape" : "portrait"} style={s.page}>
        <View style={s.brand}><Text>{input.orgDetails ?? ""}</Text><Text>Document établi le {generated}</Text></View>
        <Text style={s.org}>{input.orgName}</Text>
        <Text style={s.sub}>{input.title} · {input.subtitle}</Text>
        {input.kpis && (
          <View style={s.kpis}>
            {input.kpis.map((k) => <View key={k.label} style={s.kpi}><Text style={s.kpiL}>{k.label}</Text><Text style={s.kpiV}>{eur(k.value)}</Text></View>)}
          </View>
        )}
        {input.narrative && (
          <View>
            <Text style={s.h2}>Rapport financier</Text>
            {input.narrative.split(/\n{2,}/).map((p, i) => <Text key={i} style={s.para}>{p.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim()}</Text>)}
          </View>
        )}
        {input.tables.map((t, i) => <TableView key={i} t={t} />)}
        <View style={s.footer} fixed>
          <Text>Établi avec ASSOCIA COMPTA — plan comptable associatif (règlement ANC 2018-06)</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

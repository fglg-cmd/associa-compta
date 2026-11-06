import { ImageResponse } from "next/og";
import { BRAND, OgMark, ogFonts } from "@/lib/og";
import { publicEnv } from "@/lib/public-env";

export const alt = "ASSOCIA COMPTA — La comptabilité de votre association, enfin simple.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#18181b";
const MUTED = "#71717a";
const ACCENT = "#4f46e5";
const BORDER = "#e7e7ee";

/** Image de partage (Instagram, WhatsApp, LinkedIn, Facebook…) générée au déploiement. */
export default async function OpenGraphImage() {
  const host = new URL(publicEnv.appUrl).host;
  const bars = [
    [52, 32], [40, 37], [72, 44], [46, 52], [60, 34], [80, 50],
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          fontFamily: "Geist",
          color: INK,
          backgroundColor: "#fbfbfd",
          backgroundImage: "radial-gradient(circle at 85% 0%, rgba(79,70,229,0.20), rgba(79,70,229,0) 55%), radial-gradient(circle at 0% 100%, rgba(192,38,211,0.10), rgba(192,38,211,0) 45%)",
          padding: "64px 72px",
        }}
      >
        {/* Colonne texte */}
        <div style={{ display: "flex", flexDirection: "column", width: 640 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, backgroundImage: BRAND.gradient, boxShadow: "0 8px 20px -8px rgba(79,70,229,0.6)" }}>
              <OgMark size={40} />
            </div>
            <div style={{ display: "flex", fontSize: 32, fontWeight: 600, letterSpacing: -1 }}>
              Associa<span style={{ color: BRAND.color, marginLeft: 9 }}>Compta</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 56, fontSize: 66, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2 }}>
            <span>La comptabilité de</span>
            <span>votre association,</span>
            <span style={{ color: ACCENT }}>enfin simple.</span>
          </div>

          <div style={{ display: "flex", marginTop: 26, fontSize: 25, lineHeight: 1.4, color: MUTED }}>
            Relevés bancaires catégorisés, bilan et compte de résultat prêts pour l&apos;AG.
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
            {["Plan comptable associatif", "Export FEC", "Données dans l'UE"].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 999, border: `1.5px solid ${BORDER}`, backgroundColor: "#fff", fontSize: 17, fontWeight: 500, color: "#3f3f46" }}>
                <div style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: "#16a34a" }} />
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Carte « tableau de bord » */}
        <div style={{ display: "flex", flexDirection: "column", marginLeft: "auto", marginTop: 34, width: 380, gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", padding: 26, borderRadius: 24, backgroundColor: "#fff", border: `1.5px solid ${BORDER}`, boxShadow: "0 30px 60px -20px rgba(24,24,27,0.25)" }}>
            <div style={{ display: "flex", fontSize: 18, color: MUTED, fontWeight: 500 }}>Trésorerie disponible</div>
            <div style={{ display: "flex", marginTop: 6, fontSize: 46, fontWeight: 600, letterSpacing: -1.5 }}>12 480 €</div>
            <div style={{ display: "flex", fontSize: 17, color: "#16a34a", fontWeight: 500 }}>+ 8,2 % sur l&apos;exercice</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 120, marginTop: 22, paddingBottom: 2, borderBottom: `1.5px solid ${BORDER}` }}>
              {bars.map(([r, d], i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
                  <div style={{ width: 16, height: r * 1.4, borderRadius: "5px 5px 0 0", backgroundColor: ACCENT }} />
                  <div style={{ width: 16, height: d * 1.4, borderRadius: "5px 5px 0 0", backgroundColor: "#c2671f" }} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "18px 22px", borderRadius: 20, backgroundColor: "#fff", border: `1.5px solid ${BORDER}`, fontSize: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: MUTED, fontWeight: 500 }}>
              <span>Cotisation · M. Martin</span>
              <span style={{ color: "#16a34a" }}>Équilibrée</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, backgroundColor: "#f4f4f7" }}><span>512 Banque</span><span>45,00 D</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, backgroundColor: "#f4f4f7" }}><span>756 Cotisations</span><span>45,00 C</span></div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 19, color: MUTED, fontWeight: 500 }}>{host}</div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}

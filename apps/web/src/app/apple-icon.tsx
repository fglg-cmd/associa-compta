import { ImageResponse } from "next/og";
import { OgMark } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Icône d'écran d'accueil iOS : fond plein, iOS arrondit lui-même les coins. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(135deg, #5b50f0, #4338ca)" }}>
        <OgMark size={150} />
      </div>
    ),
    size,
  );
}

import { ImageResponse } from "next/og";
import { BRAND, OgMark } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Icône d'écran d'accueil iOS : fond plein, iOS arrondit lui-même les coins. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundImage: BRAND.gradient }}>
        <OgMark size={130} />
      </div>
    ),
    size,
  );
}

import { readFile } from "node:fs/promises";
import path from "node:path";

/** Polices Geist (TTF) pour les images générées : la marque garde sa typographie. */
export async function ogFonts() {
  const dir = path.join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans");
  const [regular, medium, bold] = await Promise.all(
    ["Geist-Regular.ttf", "Geist-Medium.ttf", "Geist-SemiBold.ttf"].map((f) => readFile(path.join(dir, f))),
  );
  return [
    { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: medium, weight: 500 as const, style: "normal" as const },
    { name: "Geist", data: bold, weight: 600 as const, style: "normal" as const },
  ];
}

/** Couleur du logo et son dégradé. */
export const BRAND = { color: "#4f46e5", gradient: "linear-gradient(150deg, #7069f7, #4338ca)" };

/** Monogramme « A » de la marque, en SVG (fond géré par l'appelant). */
export function OgMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <path d="M9 23.5 15.2 8.8a.9.9 0 0 1 1.6 0L23 23.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M11.8 18h8.4" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

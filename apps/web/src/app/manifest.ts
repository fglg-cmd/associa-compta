import type { MetadataRoute } from "next";

/** Ajout à l'écran d'accueil (Android, iOS, ordinateur) : nom, couleurs et icônes. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ASSOCIA COMPTA",
    short_name: "Associa Compta",
    description: "La comptabilité de votre association, enfin simple.",
    lang: "fr",
    start_url: "/app",
    display: "standalone",
    background_color: "#fbfbfd",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

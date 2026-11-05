import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/public-env";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/tarifs", "/inscription", "/connexion", "/mentions-legales", "/cgu", "/confidentialite"];
  return pages.map((p) => ({ url: `${publicEnv.appUrl}${p}`, changeFrequency: "monthly", priority: p === "" ? 1 : 0.5 }));
}

import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/public-env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api", "/onboarding", "/invitation", "/auth"] }],
    sitemap: `${publicEnv.appUrl}/sitemap.xml`,
  };
}

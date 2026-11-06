import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const supabase = (() => {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return { origin: u.origin, ws: `${u.protocol === "https:" ? "wss" : "ws"}://${u.host}` };
  } catch {
    return { origin: "", ws: "" };
  }
})();
const isProd = process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://");

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://eu-assets.i.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.googleusercontent.com ${supabase.origin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${supabase.origin} ${supabase.ws} https://eu.i.posthog.com https://eu-assets.i.posthog.com https://*.ingest.de.sentry.io https://*.ingest.sentry.io`,
  `frame-src 'self' blob: https://js.stripe.com ${supabase.origin}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  poweredByHeader: false,
  transpilePackages: ["@associa/accounting", "@associa/bank-import"],
  serverExternalPackages: ["tesseract.js", "exceljs", "@react-pdf/renderer", "mammoth"],
  // Fichiers chargés dynamiquement (non détectés par le traçage) : polices PDF standard
  // de pdfkit. Sans cela, l'export PDF échoue sur Vercel (« Cannot find module Helvetica »).
  outputFileTracingIncludes: {
    "/api/exports/[orgId]": ["../../node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/standard-fonts/**/*", "../../node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/data/**/*"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "26mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
        ],
      },
    ];
  },
};

// L'intégration Sentry (instrumentation injectée dans chaque route) n'est activée
// que si Sentry est configuré : sinon elle alourdit inutilement chaque fonction.
export default process.env.NEXT_PUBLIC_SENTRY_DSN ? withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
}) : nextConfig;

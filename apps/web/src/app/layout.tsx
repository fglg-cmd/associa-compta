import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Providers } from "@/components/providers/providers";
import { publicEnv } from "@/lib/public-env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.appUrl),
  title: { default: "ASSOCIA COMPTA — La comptabilité associative, enfin simple", template: "%s · ASSOCIA COMPTA" },
  description:
    "Le logiciel de gestion financière des associations : banque, justificatifs, adhérents, projets, bilan et compte de résultat conformes. Gratuit pour démarrer.",
  applicationName: "ASSOCIA COMPTA",
  openGraph: { type: "website", locale: "fr_FR", siteName: "ASSOCIA COMPTA" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;if(d)document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

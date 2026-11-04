"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <h1 style={{ fontSize: 18 }}>Une erreur est survenue</h1>
          <p style={{ color: "#71717a", fontSize: 14 }}>Notre équipe a été prévenue. Vos données sont intactes.</p>
          <button onClick={reset} style={{ marginTop: 12, padding: "8px 14px", borderRadius: 8, border: "1px solid #e4e4e7", background: "#fff", cursor: "pointer" }}>
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}

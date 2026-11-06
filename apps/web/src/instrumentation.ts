// Sentry n'est chargé que s'il est configuré : sans DSN, aucune dépendance n'est
// évaluée au démarrage des fonctions (démarrages à froid plus rapides).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Les montants et libellés bancaires ne quittent jamais nos serveurs
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
      }
      return event;
    },
  });
}

type CaptureRequestError = typeof import("@sentry/nextjs").captureRequestError;

export async function onRequestError(...args: Parameters<CaptureRequestError>) {
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}

// Sentry côté navigateur, chargé à la demande et seulement s'il est configuré :
// sans DSN, il n'alourdit plus le JavaScript de chaque page.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

type TransitionHook = (href: string, navigationType: "push" | "replace" | "traverse") => void;
let onTransition: TransitionHook | undefined;

if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({ dsn, tracesSampleRate: 0.1, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0 });
    onTransition = Sentry.captureRouterTransitionStart;
  });
}

export function onRouterTransitionStart(href: string, navigationType: "push" | "replace" | "traverse") {
  onTransition?.(href, navigationType);
}

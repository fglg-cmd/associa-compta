"use client";
import { useEffect } from "react";
import { Toaster } from "sonner";
import posthog from "posthog-js";
import { TooltipProvider } from "@/components/ui/tooltip";
import { publicEnv } from "@/lib/public-env";

let posthogStarted = false;

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (posthogStarted || !publicEnv.posthogKey) return;
    posthogStarted = true;
    posthog.init(publicEnv.posthogKey, {
      api_host: publicEnv.posthogHost,
      person_profiles: "identified_only",
      capture_pageview: "history_change",
      // Aucune donnée financière dans les enregistrements de session
      session_recording: { maskAllInputs: true, maskTextSelector: ".tabular, [data-private]" },
      respect_dnt: true,
    });
  }, []);

  return (
    <TooltipProvider>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: "!rounded-lg !border !border-border !bg-surface !text-foreground !shadow-lg !text-[13px]",
            description: "!text-muted",
          },
        }}
      />
    </TooltipProvider>
  );
}

export function identifyUser(id: string, email?: string | null) {
  if (publicEnv.posthogKey) posthog.identify(id, email ? { email } : undefined);
}

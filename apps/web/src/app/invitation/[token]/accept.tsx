"use client";
import { useState, useTransition } from "react";
import { acceptInvitation } from "@/modules/org/actions";
import { Button } from "@/components/ui/button";

export function AcceptInvitation({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-5">
      {error && <p className="mb-3 rounded-md bg-negative-soft px-3 py-2 text-[13px] text-negative">{error}</p>}
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        loading={pending}
        onClick={() =>
          start(async () => {
            const r = await acceptInvitation(token);
            if (r && !r.ok) setError(r.error);
          })
        }
      >
        Accepter l&apos;invitation
      </Button>
    </div>
  );
}

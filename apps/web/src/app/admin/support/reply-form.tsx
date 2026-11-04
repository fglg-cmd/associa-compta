"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { replyTicket } from "@/modules/admin/actions";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";

export function ReplyForm({ ticketId, defaultReply, status }: { ticketId: string; defaultReply: string; status: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form action={(fd) => start(async () => { const r = await replyTicket(ticketId, fd); if (!r.ok) { toast.error(r.error); return; } toast.success("Réponse envoyée"); router.refresh(); })} className="mt-3 grid gap-2">
      <Textarea name="reply" defaultValue={defaultReply} placeholder="Votre réponse (envoyée par e-mail)…" rows={3} />
      <div className="flex justify-end gap-2">
        <Select name="status" defaultValue={status === "open" ? "resolved" : status} className="w-36"><option value="pending">En cours</option><option value="resolved">Résolue</option><option value="open">Ouverte</option></Select>
        <Button type="submit" variant="primary" size="sm" loading={pending}>Répondre</Button>
      </div>
    </form>
  );
}

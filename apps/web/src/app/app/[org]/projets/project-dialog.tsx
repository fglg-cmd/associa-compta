"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { saveProject } from "@/modules/projects/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLORS = ["#4F46E5", "#0E7490", "#15803D", "#B45309", "#BE123C", "#7C3AED", "#52525B"];

export function ProjectDialog({ orgId, project, defaultOpen }: { orgId: string; project?: Project; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [color, setColor] = useState(project?.color ?? COLORS[0]!);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{project ? <Button size="sm"><Pencil /> Modifier</Button> : <Button variant="primary"><Plus /> Nouveau</Button>}</DialogTrigger>
      <DialogContent title={project ? "Modifier" : "Nouveau projet ou événement"}>
        <form
          action={(fd) =>
            start(async () => {
              fd.set("color", color);
              const r = await saveProject(orgId, project?.id ?? null, fd);
              if (!r.ok) return setError(r.error);
              toast.success("Enregistré");
              setOpen(false);
              if (!project) router.push(`projets/${r.data}`);
              else router.refresh();
            })
          }
          className="grid gap-3"
        >
          <div className="grid grid-cols-[1fr_150px] gap-3">
            <Field label="Nom" htmlFor="p-name"><Input id="p-name" name="name" required defaultValue={project?.name} placeholder="Kermesse de juin" /></Field>
            <Field label="Type">
              <Select name="kind" defaultValue={project?.kind ?? "event"}>
                <option value="event">Événement</option>
                <option value="project">Projet</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Début"><Input name="start_date" type="date" defaultValue={project?.start_date ?? ""} /></Field>
            <Field label="Fin"><Input name="end_date" type="date" defaultValue={project?.end_date ?? ""} /></Field>
            <Field label="Statut">
              <Select name="status" defaultValue={project?.status ?? "active"}>
                <option value="planned">Prévu</option>
                <option value="active">En cours</option>
                <option value="closed">Clôturé</option>
              </Select>
            </Field>
          </div>
          <Field label="Description"><Textarea name="description" defaultValue={project?.description ?? ""} /></Field>
          <div className="grid gap-1.5" role="group" aria-label="Couleur">
            <span className="text-[13px] font-medium">Couleur</span>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} className={cn("size-6 rounded-full ring-offset-2 ring-offset-surface", color === c && "ring-2 ring-foreground")} style={{ background: c }} />
              ))}
            </div>
          </div>
          {error && <p className="text-[13px] text-negative">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button type="submit" variant="primary" loading={pending}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";
import { useActionState, useMemo, useState } from "react";
import { defaultFiscalYear } from "@associa/accounting";
import { createOrganization } from "@/modules/org/actions";
import { Field, Input, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Building2, CalendarRange, Landmark } from "lucide-react";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function Step({ n, icon: Icon, title, children }: { n: number; icon: typeof Building2; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-xs">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-lg bg-accent-soft text-accent"><Icon className="size-4" /></span>
        <h2 className="text-sm font-semibold">
          <span className="text-subtle">{n}.</span> {title}
        </h2>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

export function OnboardingForm() {
  const [state, action] = useActionState(createOrganization, null);
  const [startMonth, setStartMonth] = useState(1);
  const fy = useMemo(() => defaultFiscalYear(new Date(), startMonth), [startMonth]);
  const [fyStart, setFyStart] = useState(fy.start);
  const [fyEnd, setFyEnd] = useState(fy.end);

  function changeMonth(m: number) {
    setStartMonth(m);
    const d = defaultFiscalYear(new Date(), m);
    setFyStart(d.start);
    setFyEnd(d.end);
  }

  return (
    <form action={action} className="mt-8 grid gap-4">
      <Step n={1} icon={Building2} title="Votre association">
        <Field label="Nom de l'association" htmlFor="name">
          <Input id="name" name="name" required minLength={2} maxLength={160} placeholder="Les Amis du Quartier" autoFocus />
        </Field>
      </Step>

      <Step n={2} icon={CalendarRange} title="Votre exercice comptable">
        <Field label="L'exercice commence en" hint="Janvier pour un exercice civil, septembre pour une saison sportive ou scolaire.">
          <Select value={startMonth} onChange={(e) => changeMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début de l'exercice en cours" htmlFor="fyStart">
            <Input id="fyStart" name="fyStart" type="date" required value={fyStart} onChange={(e) => setFyStart(e.target.value)} />
          </Field>
          <Field label="Fin" htmlFor="fyEnd">
            <Input id="fyEnd" name="fyEnd" type="date" required value={fyEnd} onChange={(e) => setFyEnd(e.target.value)} />
          </Field>
        </div>
      </Step>

      <Step n={3} icon={Landmark} title="Votre compte bancaire principal">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nom du compte" htmlFor="bankLabel">
            <Input id="bankLabel" name="bankLabel" defaultValue="Compte courant" />
          </Field>
          <Field label="Banque" htmlFor="bankName">
            <Input id="bankName" name="bankName" placeholder="Crédit Mutuel" />
          </Field>
        </div>
        <Field label="Solde au début de l'exercice" htmlFor="openingBalance" hint="Le solde de votre relevé à la date de début. Vous pourrez le corriger plus tard.">
          <Input id="openingBalance" name="openingBalance" inputMode="decimal" placeholder="0,00 €" />
        </Field>
      </Step>

      {state && !state.ok && <p className="rounded-md bg-negative-soft px-3 py-2 text-[13px] text-negative">{state.error}</p>}
      <SubmitButton size="lg" className="mt-2">Créer mon espace</SubmitButton>
    </form>
  );
}

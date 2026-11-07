"use client";
import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { getOperationDraft, type OperationFormData } from "@/modules/documents/actions";
import { SimpleForm } from "../operations/entry-dialog";

/**
 * Saisie d'une dépense (ou recette) pré-remplie à partir d'un justificatif lu :
 * le trésorier vérifie les valeurs lues, choisit le moyen de paiement et enregistre.
 * L'écriture créée est rattachée au justificatif.
 */
export function DocumentOperation({ orgId, docId, onDone, onCreated }: { orgId: string; docId: string; onDone: () => void; onCreated: () => void }) {
  const [data, setData] = useState<OperationFormData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getOperationDraft(orgId, docId).then((r) => {
      if (!alive) return;
      if (r.ok) setData(r.data);
      else setError(r.error);
    });
    return () => { alive = false; };
  }, [orgId, docId]);

  if (error) return <p className="text-[13px] text-negative">{error}</p>;
  if (!data) return <div className="grid h-40 place-items-center"><Loader2 className="size-5 animate-spin text-subtle" /></div>;

  const { draft } = data;
  const read = [draft.amount ? "le montant" : null, draft.dateFromDocument ? "la date" : null, draft.reference ? "la référence" : null, draft.categoryGuessed ? "la catégorie" : null].filter(Boolean);

  return (
    <div className="grid gap-3">
      <p className="flex items-start gap-2 rounded-lg border border-accent/20 bg-accent-soft px-3 py-2 text-[12.5px] leading-snug">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
        <span>
          {read.length
            ? <>Pré-rempli depuis le document : {read.join(", ")}. Vérifiez avant d&apos;enregistrer.</>
            : <>Les informations n&apos;ont pas pu être lues : complétez le formulaire en regardant le document.</>}
          {!draft.amount && read.length > 0 && <> Le montant n&apos;a pas été trouvé.</>}
        </span>
      </p>
      <SimpleForm
        orgId={orgId}
        accounts={data.accounts}
        treasury={data.treasury}
        projects={data.projects}
        minDate={data.minDate}
        maxDate={data.maxDate}
        initial={draft}
        documentId={docId}
        onDone={onDone}
        onCreated={onCreated}
      />
    </div>
  );
}

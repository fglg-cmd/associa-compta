"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/misc";

/*
 * Graphiques chargés à la demande : la bibliothèque (≈ 130 Ko) n'est plus téléchargée
 * avant l'affichage de la page. Les emplacements gardent la hauteur finale (pas de saut).
 */
export const PairedBars = dynamic(() => import("./charts").then((m) => m.PairedBars), {
  ssr: false,
  loading: () => <Skeleton className="h-[268px] w-full rounded-lg" />,
});

export const TreasuryLine = dynamic(() => import("./charts").then((m) => m.TreasuryLine), {
  ssr: false,
  loading: () => <Skeleton className="h-[248px] w-full rounded-lg" />,
});

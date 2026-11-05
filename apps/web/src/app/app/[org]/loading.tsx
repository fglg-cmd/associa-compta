import { Skeleton } from "@/components/ui/misc";

/** Affiché instantanément au clic dans le menu, pendant que la page se charge. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Chargement" className="grid gap-6">
      <div className="grid gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

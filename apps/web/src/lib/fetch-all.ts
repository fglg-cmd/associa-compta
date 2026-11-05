/**
 * Supabase (PostgREST) renvoie au plus 1 000 lignes par requête : au-delà, les
 * résultats sont tronqués SANS erreur. Cette fonction pagine jusqu'au bout.
 * Indispensable pour les exports légaux (FEC, grand livre, journal).
 */
const PAGE = 1000;

export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  max = 200_000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

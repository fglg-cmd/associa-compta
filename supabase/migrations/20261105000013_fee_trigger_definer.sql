-- =============================================================================
-- ASSOCIA COMPTA — 0013 : Recalcul des cotisations exécuté avec les droits du propriétaire
-- =============================================================================
-- Depuis 0010, refresh_fee_status n'est plus appelable par les utilisateurs. Le trigger
-- qui l'appelle s'exécutait avec les droits de l'utilisateur : la suppression d'une
-- association ayant des cotisations payées échouait (« permission denied »).
create or replace function public.fee_payments_after_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  fee uuid := coalesce(new.member_fee_id, old.member_fee_id);
begin
  -- Suppression en cascade (cotisation ou association supprimée) : rien à recalculer
  if exists (select 1 from public.member_fees where id = fee) then
    perform public.refresh_fee_status(fee);
  end if;
  return null;
end;
$$;
revoke execute on function public.fee_payments_after_change() from public, anon, authenticated;

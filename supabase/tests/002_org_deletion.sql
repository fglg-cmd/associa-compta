-- La suppression d'une association (RGPD, bouton « Supprimer ») doit effacer toutes
-- ses données, y compris les écritures validées, sans contourner l'immutabilité ailleurs.
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'del@test.fr');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', false);
create temp table c (org uuid, ba uuid);
insert into c (org) select public.create_organization('A supprimer', 'a-supprimer', '2026-01-01', '2026-12-31',
  '[{"number":"110","label":"R","kind":"equity"},{"number":"530","label":"Caisse","kind":"financial"},{"number":"756","label":"Cotisations","kind":"income"}]'::jsonb);
update c set ba = public.create_bank_account(org, 'CC', '', '', 10000, '2026-01-01');
insert into public.bank_transactions (organization_id, bank_account_id, date, label, amount, fingerprint)
  select org, ba, '2026-02-01', 'X', 500, 'z' from c;
select public.book_bank_transaction((select id from public.bank_transactions limit 1), (select id from public.accounts where number = '756'));
-- Une écriture validée reste indestructible en dehors de la suppression de l'association
do $$ begin
  begin
    delete from public.journal_entries where status = 'posted';
    raise exception 'ECHEC : écriture validée supprimée';
  exception when insufficient_privilege then null; end;
end $$;
delete from public.organizations where id = (select org from c);
set constraints all immediate;
reset role;
do $$ begin
  if exists (select 1 from public.journal_entries) or exists (select 1 from public.entry_lines)
     or exists (select 1 from public.bank_accounts) or exists (select 1 from public.accounts) then
    raise exception 'ECHEC : données restantes après suppression';
  end if;
end $$;
rollback;
\echo '  → suppression complète d''une association : OK'

-- =============================================================================
-- Tests d'intégrité comptable et d'isolation multi-tenant.
-- Chaque assertion lève une exception en cas d'échec (ON_ERROR_STOP).
-- =============================================================================
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@asso-a.fr'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@asso-b.fr'),
  ('00000000-0000-0000-0000-00000000000c', 'claire@asso-a.fr');

create temp table ctx (k text primary key, v uuid);
grant all on ctx to authenticated;

-- Helpers d'assertion
create function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'ASSERTION ÉCHOUÉE : %', msg; end if; end $$;

create function pg_temp.expect_error(sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    return;
  end;
  raise exception 'ASSERTION ÉCHOUÉE (aucune erreur levée) : %', msg;
end $$;

-- ---------------------------------------------------------------- Alice : asso A
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

insert into ctx select 'orgA', public.create_organization('Les Amis du Quartier', 'amis-quartier', '2026-01-01', '2026-12-31',
  '[{"number":"102","label":"Fonds associatif","kind":"equity"},
    {"number":"110","label":"Report à nouveau","kind":"equity"},
    {"number":"530","label":"Caisse","kind":"financial"},
    {"number":"606","label":"Achats non stockés","kind":"expense"},
    {"number":"706","label":"Prestations de services","kind":"income"},
    {"number":"756","label":"Cotisations","kind":"income"}]'::jsonb);

select pg_temp.assert((select count(*) from public.journals where organization_id = (select v from ctx where k='orgA')) = 5, 'journaux créés');
select pg_temp.assert((select count(*) from public.fiscal_years where organization_id = (select v from ctx where k='orgA')) = 1, 'exercice créé');

insert into ctx select 'baA', public.create_bank_account((select v from ctx where k='orgA'), 'Compte courant', 'Crédit Mutuel', '1234', 100000, '2026-01-01');

select pg_temp.assert(
  public.account_balance((select account_id from public.bank_accounts where id = (select v from ctx where k='baA'))) = 100000,
  'solde d''ouverture 1 000,00 € au 5121');

insert into public.bank_transactions (organization_id, bank_account_id, date, label, amount, fingerprint)
select (select v from ctx where k='orgA'), (select v from ctx where k='baA'), d, l, a, f
from (values ('2026-03-02'::date, 'VIR COTISATION DUPONT', 5000::bigint, 'fp1'),
             ('2026-03-05'::date, 'CB LEROY MERLIN',      -2000::bigint, 'fp2'),
             ('2026-03-09'::date, 'CHQ 0001',              -1500::bigint, 'fp3')) v(d, l, a, f);

-- Doublon refusé (réimport idempotent)
select pg_temp.expect_error($q$
  insert into public.bank_transactions (organization_id, bank_account_id, date, label, amount, fingerprint)
  values ((select v from ctx where k='orgA'), (select v from ctx where k='baA'), '2026-03-02', 'X', 5000, 'fp1')
$q$, 'empreinte unique par compte');

-- Comptabilisation
select public.book_bank_transaction(
  (select id from public.bank_transactions where fingerprint = 'fp1'),
  (select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '756'));
select public.book_bank_transactions(jsonb_build_array(jsonb_build_object(
  'tx_id', (select id from public.bank_transactions where fingerprint = 'fp2'),
  'account_id', (select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '606'))));

-- Interdit de modifier directement statut/écriture
select pg_temp.expect_error($q$
  update public.bank_transactions set status = 'booked' where fingerprint = 'fp3'
$q$, 'statut booked réservé aux fonctions');

-- Montant figé
select pg_temp.expect_error($q$
  update public.bank_transactions set amount = 1 where fingerprint = 'fp3'
$q$, 'montant immuable');

-- Rapprochement d'un chèque saisi manuellement
insert into ctx select 'chq', public.create_journal_entry(
  (select v from ctx where k='orgA'),
  (select journal_id from public.bank_accounts where id = (select v from ctx where k='baA')),
  '2026-03-08', 'Chèque fournitures',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '606'), 'debit', 1500),
    jsonb_build_object('account_id', (select account_id from public.bank_accounts where id = (select v from ctx where k='baA')), 'credit', 1500)));
select public.match_bank_transaction((select id from public.bank_transactions where fingerprint = 'fp3'), (select v from ctx where k='chq'));

select pg_temp.assert(
  (select statement_balance = ledger_balance and pending_count = 0 and unmatched_ledger_count = 0
   from public.bank_reconciliation((select v from ctx where k='baA'), '2026-12-31')),
  'rapprochement parfait : relevé = comptabilité');

select pg_temp.assert(
  (select sum(debit) = sum(credit) from public.trial_balance((select v from ctx where k='orgA'), '2026-01-01', '2026-12-31')),
  'balance équilibrée');

-- Écriture déséquilibrée refusée (vérification en fin de transaction : savepoint)
savepoint s1;
do $$ begin
  begin
    perform public.create_journal_entry(
      (select v from ctx where k='orgA'), (select id from public.journals where organization_id = (select v from ctx where k='orgA') and code='OD'),
      '2026-04-01', 'Déséquilibrée',
      jsonb_build_array(
        jsonb_build_object('account_id', (select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '606'), 'debit', 1000),
        jsonb_build_object('account_id', (select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '530'), 'credit', 999)));
    set constraints all immediate;
    raise exception 'ASSERTION ÉCHOUÉE : écriture déséquilibrée acceptée';
  exception when check_violation then null;
  end;
end $$;
rollback to savepoint s1;

-- Ligne débit ET crédit refusée
select pg_temp.expect_error($q$
  select public.create_journal_entry(
    (select v from ctx where k='orgA'), (select id from public.journals where organization_id = (select v from ctx where k='orgA') and code='OD'),
    '2026-04-01', 'XOR',
    jsonb_build_array(
      jsonb_build_object('account_id', (select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '606'), 'debit', 10, 'credit', 10),
      jsonb_build_object('account_id', (select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '530'), 'credit', 0)))
$q$, 'débit XOR crédit');

-- Date hors exercice refusée
select pg_temp.expect_error($q$
  select public.create_journal_entry(
    (select v from ctx where k='orgA'), (select id from public.journals where organization_id = (select v from ctx where k='orgA') and code='OD'),
    '2027-04-01', 'Hors exercice',
    jsonb_build_array(
      jsonb_build_object('account_id', (select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '606'), 'debit', 10),
      jsonb_build_object('account_id', (select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '530'), 'credit', 10)))
$q$, 'date hors exercice');

-- Annulation d'une comptabilisation = contre-passation
select public.unbook_bank_transaction((select id from public.bank_transactions where fingerprint = 'fp2'));
select pg_temp.assert((select status = 'pending' from public.bank_transactions where fingerprint = 'fp2'), 'mouvement remis en attente');
select pg_temp.assert(
  (select count(*) = 1 from public.journal_entries where source = 'reversal' and organization_id = (select v from ctx where k='orgA')),
  'contre-passation créée');
select public.book_bank_transaction(
  (select id from public.bank_transactions where fingerprint = 'fp2'),
  (select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '606'));

-- Adhérent + cotisation payée en espèces
insert into public.members (organization_id, first_name, last_name, email)
values ((select v from ctx where k='orgA'), 'Jean', 'Dupont', 'jean@exemple.fr');
select pg_temp.assert((select member_number = 1 from public.members where last_name = 'Dupont'), 'numéro adhérent auto');
insert into public.member_fees (organization_id, member_id, label, period_start, period_end, amount_due, due_date)
select (select v from ctx where k='orgA'), id, '2026', '2026-01-01', '2026-12-31', 3000, '2026-02-01' from public.members where last_name = 'Dupont';
select pg_temp.expect_error($q$ update public.member_fees set amount_paid = 3000 $q$, 'amount_paid protégé');
select public.record_fee_payment((select id from public.member_fees limit 1), '2026-02-10', 3000, 'cash');
select pg_temp.assert((select status = 'paid' and amount_paid = 3000 from public.member_fees limit 1), 'cotisation soldée');
select pg_temp.assert(
  public.account_balance((select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '530')) = 3000,
  'caisse débitée de 30 €');

-- Projet : réalisé
insert into public.projects (organization_id, name, kind) values ((select v from ctx where k='orgA'), 'Kermesse', 'event');
insert into public.project_budget_lines (organization_id, project_id, label, direction, amount)
select organization_id, id, 'Buvette', 'income', 50000 from public.projects where name = 'Kermesse';
select public.create_journal_entry(
  (select v from ctx where k='orgA'), (select id from public.journals where organization_id = (select v from ctx where k='orgA') and code='CA'),
  '2026-06-20', 'Recette buvette',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '530'), 'debit', 42000),
    jsonb_build_object('account_id', (select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '706'), 'credit', 42000)),
  null, true, 'manual', (select id from public.projects where name = 'Kermesse'));
select pg_temp.assert(
  (select actual_income = 42000 and budget_income = 50000 from public.project_financials((select v from ctx where k='orgA'))),
  'réalisé projet');

-- Suppression du projet : détache les lignes validées sans casser l'immutabilité
delete from public.projects where name = 'Kermesse';
select pg_temp.assert((select count(*) = 0 from public.entry_lines where project_id is not null), 'lignes détachées');

-- Invitation d'un lecteur (Claire, viewer)
insert into public.invitations (organization_id, email, role) values ((select v from ctx where k='orgA'), 'claire@asso-a.fr', 'viewer');
insert into ctx select 'tok', null;
create temp table tok as select token from public.invitations;
grant select on tok to authenticated;

-- ---------------------------------------------------------------- Bob : asso B (isolation)
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.assert((select count(*) = 0 from public.organizations), 'Bob ne voit pas l''asso A');
select pg_temp.assert((select count(*) = 0 from public.bank_transactions), 'Bob ne voit aucun mouvement');
select pg_temp.assert((select count(*) = 0 from public.journal_entries), 'Bob ne voit aucune écriture');
select pg_temp.assert((select count(*) = 0 from public.members), 'Bob ne voit aucun adhérent');
select pg_temp.assert((select count(*) = 0 from public.trial_balance((select v from ctx where k='orgA'), '2026-01-01', '2026-12-31')), 'balance A invisible');
select pg_temp.expect_error($q$
  select public.create_journal_entry(
    (select v from ctx where k='orgA'), (select id from public.journals limit 1), '2026-04-01', 'Intrusion', '[{},{}]'::jsonb)
$q$, 'Bob ne peut pas écrire chez A');
select pg_temp.expect_error($q$
  insert into public.members (organization_id, first_name, last_name) values ((select v from ctx where k='orgA'), 'X', 'Y')
$q$, 'Bob ne peut pas créer d''adhérent chez A');
select pg_temp.expect_error($q$ select public.accept_invitation((select token from tok)) $q$, 'invitation liée à l''e-mail');
select pg_temp.expect_error($q$ select public.admin_platform_stats() $q$, 'stats admin réservées');

-- ---------------------------------------------------------------- Claire : lecteur
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select public.accept_invitation((select token from tok));
select pg_temp.assert((select count(*) = 1 from public.organizations), 'Claire voit l''asso A');
select pg_temp.assert((select count(*) > 0 from public.journal_entries), 'Claire lit les écritures');
select pg_temp.expect_error($q$
  select public.book_bank_transaction((select id from public.bank_transactions limit 1), (select id from public.accounts limit 1))
$q$, 'lecteur ne peut pas comptabiliser');
update public.organizations set name = 'Piratée';
select pg_temp.assert((select name <> 'Piratée' from public.organizations), 'lecteur ne peut pas modifier l''association');

-- ---------------------------------------------------------------- Clôture
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.expect_error($q$ update public.organizations set plan = 'pro' $q$, 'plan non modifiable même par le propriétaire');
select pg_temp.expect_error($q$ delete from public.memberships where role = 'owner'; set constraints all immediate $q$, 'au moins un propriétaire');
select public.close_fiscal_year((select id from public.fiscal_years limit 1));
select pg_temp.expect_error($q$
  select public.create_journal_entry(
    (select v from ctx where k='orgA'), (select id from public.journals where organization_id = (select v from ctx where k='orgA') and code='OD'),
    '2026-05-01', 'Après clôture',
    jsonb_build_array(
      jsonb_build_object('account_id', (select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '606'), 'debit', 10),
      jsonb_build_object('account_id', (select id from public.accounts where organization_id = (select v from ctx where k='orgA') and number = '530'), 'credit', 10)))
$q$, 'exercice clôturé verrouillé');
update public.fiscal_years set status = 'open';
select pg_temp.assert((select status = 'closed' from public.fiscal_years limit 1), 'pas de réouverture');
select public.open_next_fiscal_year((select v from ctx where k='orgA'));
select pg_temp.assert((select count(*) = 2 from public.fiscal_years), 'exercice suivant ouvert');

select pg_temp.assert((select count(*) > 5 from public.audit_log), 'piste d''audit alimentée');

reset role;
rollback;
\echo '  → toutes les assertions d''intégrité et d''isolation sont passées'

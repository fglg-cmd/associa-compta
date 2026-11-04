-- =============================================================================
-- ASSOCIA COMPTA — 0003 : Banque, import de relevés, catégorisation, rapprochement
-- =============================================================================

create type public.bank_import_format as enum ('csv', 'ofx', 'qif');
create type public.bank_tx_status as enum ('pending', 'booked', 'matched', 'ignored');
create type public.rule_match_type as enum ('contains', 'starts_with', 'equals', 'regex');
create type public.rule_direction as enum ('any', 'in', 'out');

create table public.bank_accounts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  bank_name        text,
  iban_last4       text check (iban_last4 is null or iban_last4 ~ '^[0-9A-Z]{4}$'),
  account_id       uuid not null references public.accounts (id) on delete restrict,
  journal_id       uuid not null references public.journals (id) on delete restrict,
  opening_balance  bigint not null default 0,
  opening_date     date not null,
  is_archived      boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (organization_id, account_id)
);

create table public.bank_imports (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  bank_account_id  uuid not null references public.bank_accounts (id) on delete cascade,
  filename         text not null,
  format           public.bank_import_format not null,
  row_count        integer not null default 0,
  imported_count   integer not null default 0,
  duplicate_count  integer not null default 0,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);

create table public.categorization_rules (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  match_type       public.rule_match_type not null default 'contains',
  pattern          text not null check (length(pattern) between 1 and 200),
  direction        public.rule_direction not null default 'any',
  min_amount       bigint,
  max_amount       bigint,
  account_id       uuid not null references public.accounts (id) on delete cascade,
  project_id       uuid,
  priority         integer not null default 100,
  hits             integer not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);
create index categorization_rules_org_idx on public.categorization_rules (organization_id, priority);

create table public.bank_transactions (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  bank_account_id      uuid not null references public.bank_accounts (id) on delete cascade,
  import_id            uuid references public.bank_imports (id) on delete set null,
  date                 date not null,
  value_date           date,
  label                text not null,
  raw_label            text,
  counterparty         text,
  amount               bigint not null check (amount <> 0), -- signé : + encaissement, − décaissement
  fingerprint          text not null,
  status               public.bank_tx_status not null default 'pending',
  suggested_account_id uuid references public.accounts (id) on delete set null,
  suggested_rule_id    uuid references public.categorization_rules (id) on delete set null,
  suggested_project_id uuid,
  entry_id             uuid references public.journal_entries (id) on delete set null,
  created_at           timestamptz not null default now(),
  unique (bank_account_id, fingerprint)
);
create index bank_tx_org_date_idx on public.bank_transactions (organization_id, date desc);
create index bank_tx_status_idx on public.bank_transactions (organization_id, status);
create unique index bank_tx_entry_unique on public.bank_transactions (entry_id) where entry_id is not null;

-- Le montant et la date d'un mouvement bancaire sont la vérité du relevé : figés.
create or replace function public.guard_bank_transaction()
returns trigger
language plpgsql
as $$
begin
  if new.amount <> old.amount or new.date <> old.date or new.bank_account_id <> old.bank_account_id then
    raise exception 'Le montant, la date et le compte d''un mouvement importé sont immuables';
  end if;
  if current_user = 'authenticated' and (new.entry_id is distinct from old.entry_id or (new.status in ('booked', 'matched') and new.status is distinct from old.status)) then
    raise exception 'Utilisez les fonctions de comptabilisation' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger bank_transactions_guard before update on public.bank_transactions
  for each row execute function public.guard_bank_transaction();

-- -----------------------------------------------------------------------------
-- Création d'un compte bancaire : compte 512x, journal dédié, à-nouveau.
-- -----------------------------------------------------------------------------
create or replace function public.create_bank_account(
  p_org uuid,
  p_name text,
  p_bank_name text,
  p_iban_last4 text,
  p_opening_balance bigint,
  p_opening_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
  acc_number text;
  acc_id uuid;
  jrn_id uuid;
  jrn_code text;
  ba_id uuid;
  equity_acc uuid;
begin
  perform public.assert_finance_writer(p_org);

  select count(*) into n from public.bank_accounts where organization_id = p_org;
  acc_number := '512' || (n + 1)::text;
  jrn_code := case when n = 0 then 'BQ' else 'BQ' || (n + 1)::text end;

  insert into public.accounts (organization_id, number, label, kind, is_system)
  values (p_org, acc_number, 'Banque — ' || p_name, 'financial', true)
  on conflict (organization_id, number) do update set label = excluded.label
  returning id into acc_id;

  insert into public.journals (organization_id, code, label, type)
  values (p_org, jrn_code, 'Banque — ' || p_name, 'bank')
  on conflict (organization_id, code) do update set label = excluded.label
  returning id into jrn_id;

  insert into public.bank_accounts (
    organization_id, name, bank_name, iban_last4, account_id, journal_id, opening_balance, opening_date
  ) values (
    p_org, p_name, nullif(p_bank_name, ''), nullif(upper(p_iban_last4), ''), acc_id, jrn_id,
    coalesce(p_opening_balance, 0), p_opening_date
  ) returning id into ba_id;

  if coalesce(p_opening_balance, 0) <> 0 then
    select id into equity_acc from public.accounts where organization_id = p_org and number = '110';
    if equity_acc is null then
      insert into public.accounts (organization_id, number, label, kind, is_system)
      values (p_org, '110', 'Report à nouveau (solde créditeur)', 'equity', true)
      returning id into equity_acc;
    end if;
    perform public.create_journal_entry(
      p_org,
      (select id from public.journals where organization_id = p_org and code = 'AN'),
      p_opening_date,
      'Solde d''ouverture — ' || p_name,
      jsonb_build_array(
        jsonb_build_object('account_id', acc_id,
          'debit', greatest(p_opening_balance, 0), 'credit', greatest(-p_opening_balance, 0)),
        jsonb_build_object('account_id', equity_acc,
          'debit', greatest(-p_opening_balance, 0), 'credit', greatest(p_opening_balance, 0))
      ),
      null, true, 'opening', null
    );
  end if;

  return ba_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Comptabilisation d'un mouvement : génère l'écriture banque ↔ contrepartie.
-- -----------------------------------------------------------------------------
create or replace function public.book_bank_transaction(
  p_tx uuid,
  p_account uuid,
  p_label text default null,
  p_project uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tx public.bank_transactions;
  ba public.bank_accounts;
  eid uuid;
  amt bigint;
  lbl text;
begin
  select * into tx from public.bank_transactions where id = p_tx for update;
  if tx.id is null then raise exception 'Mouvement introuvable'; end if;
  perform public.assert_finance_writer(tx.organization_id);
  if tx.status in ('booked', 'matched') then
    raise exception 'Ce mouvement est déjà comptabilisé';
  end if;

  select * into ba from public.bank_accounts where id = tx.bank_account_id;
  if p_account = ba.account_id then
    raise exception 'La contrepartie ne peut pas être le compte bancaire lui-même';
  end if;
  if not exists (select 1 from public.accounts where id = p_account and organization_id = tx.organization_id) then
    raise exception 'Compte inconnu';
  end if;

  amt := abs(tx.amount);
  lbl := coalesce(nullif(trim(p_label), ''), tx.label);

  eid := public.create_journal_entry(
    tx.organization_id, ba.journal_id, tx.date, lbl,
    case when tx.amount > 0 then
      jsonb_build_array(
        jsonb_build_object('account_id', ba.account_id, 'debit', amt, 'credit', 0),
        jsonb_build_object('account_id', p_account, 'debit', 0, 'credit', amt, 'project_id', p_project))
    else
      jsonb_build_array(
        jsonb_build_object('account_id', p_account, 'debit', amt, 'credit', 0, 'project_id', p_project),
        jsonb_build_object('account_id', ba.account_id, 'debit', 0, 'credit', amt))
    end,
    null, true, 'bank', p_project
  );

  update public.bank_transactions
    set status = 'booked', entry_id = eid
    where id = p_tx;

  if tx.suggested_rule_id is not null and tx.suggested_account_id = p_account then
    update public.categorization_rules set hits = hits + 1 where id = tx.suggested_rule_id;
  end if;

  return eid;
end;
$$;

-- Comptabilisation groupée : [{ "tx_id": uuid, "account_id": uuid, "label"?: text, "project_id"?: uuid }]
create or replace function public.book_bank_transactions(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  n integer := 0;
begin
  for item in select * from jsonb_array_elements(p_items) loop
    perform public.book_bank_transaction(
      (item ->> 'tx_id')::uuid,
      (item ->> 'account_id')::uuid,
      item ->> 'label',
      nullif(item ->> 'project_id', '')::uuid
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Rapprochement : relie un mouvement à une écriture existante (chèque saisi, cotisation…)
create or replace function public.match_bank_transaction(p_tx uuid, p_entry uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tx public.bank_transactions;
  ba public.bank_accounts;
  net bigint;
begin
  select * into tx from public.bank_transactions where id = p_tx for update;
  if tx.id is null then raise exception 'Mouvement introuvable'; end if;
  perform public.assert_finance_writer(tx.organization_id);
  if tx.status in ('booked', 'matched') then raise exception 'Mouvement déjà rapproché'; end if;
  select * into ba from public.bank_accounts where id = tx.bank_account_id;

  select coalesce(sum(l.debit - l.credit), 0) into net
  from public.entry_lines l
  join public.journal_entries e on e.id = l.entry_id
  where l.entry_id = p_entry and l.account_id = ba.account_id
    and e.status = 'posted' and e.organization_id = tx.organization_id;

  if net <> tx.amount then
    raise exception 'Le montant de l''écriture sur le compte bancaire (%) ne correspond pas au mouvement (%)', net, tx.amount;
  end if;
  if exists (select 1 from public.bank_transactions where entry_id = p_entry) then
    raise exception 'Cette écriture est déjà rapprochée d''un autre mouvement';
  end if;

  update public.bank_transactions set status = 'matched', entry_id = p_entry where id = p_tx;
end;
$$;

-- Annule une comptabilisation : contre-passe (si générée) et remet en attente.
create or replace function public.unbook_bank_transaction(p_tx uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tx public.bank_transactions;
  old_entry uuid;
begin
  select * into tx from public.bank_transactions where id = p_tx for update;
  if tx.id is null then raise exception 'Mouvement introuvable'; end if;
  perform public.assert_finance_writer(tx.organization_id);
  old_entry := tx.entry_id;
  update public.bank_transactions set status = 'pending', entry_id = null where id = p_tx;
  if tx.status = 'booked' and old_entry is not null then
    perform public.reverse_journal_entry(old_entry, null);
  end if;
end;
$$;

-- État de rapprochement d'un compte bancaire à une date.
create or replace function public.bank_reconciliation(p_bank_account uuid, p_at date default current_date)
returns table (
  statement_balance bigint,
  ledger_balance bigint,
  pending_count integer,
  pending_amount bigint,
  unmatched_ledger_count integer,
  unmatched_ledger_amount bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with ba as (select * from public.bank_accounts where id = p_bank_account)
  select
    (select ba.opening_balance from ba)
      + coalesce((select sum(amount) from public.bank_transactions t
                  where t.bank_account_id = p_bank_account and t.status <> 'ignored' and t.date <= p_at), 0)::bigint,
    public.account_balance((select account_id from ba), p_at),
    (select count(*)::int from public.bank_transactions t
      where t.bank_account_id = p_bank_account and t.status = 'pending' and t.date <= p_at),
    coalesce((select sum(amount) from public.bank_transactions t
      where t.bank_account_id = p_bank_account and t.status = 'pending' and t.date <= p_at), 0)::bigint,
    (select count(*)::int from public.entry_lines l
      join public.journal_entries e on e.id = l.entry_id
      where l.account_id = (select account_id from ba) and e.status = 'posted' and e.date <= p_at
        and e.source <> 'opening'
        and not exists (select 1 from public.bank_transactions t where t.entry_id = e.id)),
    coalesce((select sum(l.debit - l.credit) from public.entry_lines l
      join public.journal_entries e on e.id = l.entry_id
      where l.account_id = (select account_id from ba) and e.status = 'posted' and e.date <= p_at
        and e.source <> 'opening'
        and not exists (select 1 from public.bank_transactions t where t.entry_id = e.id)), 0)::bigint;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.bank_accounts enable row level security;
alter table public.bank_imports enable row level security;
alter table public.categorization_rules enable row level security;
alter table public.bank_transactions enable row level security;

create policy ba_select on public.bank_accounts for select to authenticated using (public.is_org_member(organization_id));
create policy ba_update on public.bank_accounts for update to authenticated
  using (public.can_write_finance(organization_id)) with check (public.can_write_finance(organization_id));

create policy bi_select on public.bank_imports for select to authenticated using (public.is_org_member(organization_id));
create policy bi_insert on public.bank_imports for insert to authenticated with check (public.can_write_finance(organization_id));
create policy bi_update on public.bank_imports for update to authenticated
  using (public.can_write_finance(organization_id)) with check (public.can_write_finance(organization_id));

create policy rules_select on public.categorization_rules for select to authenticated using (public.is_org_member(organization_id));
create policy rules_write on public.categorization_rules for all to authenticated
  using (public.can_write_finance(organization_id)) with check (public.can_write_finance(organization_id));

create policy btx_select on public.bank_transactions for select to authenticated using (public.is_org_member(organization_id));
create policy btx_insert on public.bank_transactions for insert to authenticated
  with check (public.can_write_finance(organization_id) and status in ('pending', 'ignored') and entry_id is null
    and exists (select 1 from public.bank_accounts b where b.id = bank_account_id and b.organization_id = bank_transactions.organization_id));
create policy btx_update on public.bank_transactions for update to authenticated
  using (public.can_write_finance(organization_id)) with check (public.can_write_finance(organization_id));
create policy btx_delete on public.bank_transactions for delete to authenticated
  using (public.can_write_finance(organization_id) and status in ('pending', 'ignored'));

grant select, update on public.bank_accounts to authenticated;
grant select, insert, update on public.bank_imports to authenticated;
grant select, insert, update, delete on public.categorization_rules to authenticated;
grant select, insert, update, delete on public.bank_transactions to authenticated;

grant execute on function public.create_bank_account(uuid, text, text, text, bigint, date) to authenticated;
grant execute on function public.book_bank_transaction(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.book_bank_transactions(jsonb) to authenticated;
grant execute on function public.match_bank_transaction(uuid, uuid) to authenticated;
grant execute on function public.unbook_bank_transaction(uuid) to authenticated;
grant execute on function public.bank_reconciliation(uuid, date) to authenticated;

-- =============================================================================
-- ASSOCIA COMPTA — 0005 : Adhérents, cotisations, paiements, relances
-- =============================================================================

create type public.member_status as enum ('active', 'inactive', 'pending');
create type public.fee_status as enum ('due', 'partial', 'paid', 'cancelled');
create type public.payment_method as enum ('cash', 'cheque', 'transfer', 'card', 'other');

create table public.members (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  member_number    integer not null,
  first_name       text not null,
  last_name        text not null,
  email            text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone            text,
  address_line     text,
  postal_code      text,
  city             text,
  birth_date       date,
  status           public.member_status not null default 'active',
  joined_at        date not null default current_date,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, member_number)
);
create index members_org_name_idx on public.members (organization_id, last_name, first_name);
create unique index members_org_email_idx on public.members (organization_id, lower(email)) where email is not null;

create trigger members_touch before update on public.members
  for each row execute function public.touch_updated_at();

-- Numéro d'adhérent séquentiel par association
create or replace function public.assign_member_number()
returns trigger
language plpgsql
as $$
begin
  if new.member_number is null then
    perform pg_advisory_xact_lock(hashtext('member_number:' || new.organization_id::text));
    select coalesce(max(member_number), 0) + 1 into new.member_number
    from public.members where organization_id = new.organization_id;
  end if;
  return new;
end;
$$;
create trigger members_number before insert on public.members
  for each row execute function public.assign_member_number();

create table public.fee_types (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  label            text not null,
  amount           bigint not null check (amount >= 0),
  account_id       uuid not null references public.accounts (id) on delete restrict,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create table public.member_fees (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  member_id        uuid not null references public.members (id) on delete cascade,
  fee_type_id      uuid references public.fee_types (id) on delete set null,
  label            text not null,
  period_start     date not null,
  period_end       date not null,
  amount_due       bigint not null check (amount_due >= 0),
  amount_paid      bigint not null default 0,
  status           public.fee_status not null default 'due',
  due_date         date not null,
  created_at       timestamptz not null default now(),
  check (period_end >= period_start)
);
create index member_fees_org_status_idx on public.member_fees (organization_id, status, due_date);
create index member_fees_member_idx on public.member_fees (member_id);

create table public.fee_payments (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  member_fee_id        uuid not null references public.member_fees (id) on delete cascade,
  date                 date not null,
  amount               bigint not null check (amount > 0),
  method               public.payment_method not null,
  entry_id             uuid references public.journal_entries (id) on delete set null,
  bank_transaction_id  uuid references public.bank_transactions (id) on delete set null,
  created_by           uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now()
);
create index fee_payments_fee_idx on public.fee_payments (member_fee_id);

create table public.fee_reminders (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  member_fee_id    uuid not null references public.member_fees (id) on delete cascade,
  channel          text not null default 'email',
  status           text not null check (status in ('sent', 'failed')),
  provider_id      text,
  error            text,
  sent_by          uuid references auth.users (id) on delete set null,
  sent_at          timestamptz not null default now()
);
create index fee_reminders_fee_idx on public.fee_reminders (member_fee_id, sent_at desc);

-- Statut de cotisation recalculé à partir des paiements
create or replace function public.refresh_fee_status(p_fee uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  paid bigint;
begin
  select coalesce(sum(amount), 0) into paid from public.fee_payments where member_fee_id = p_fee;
  update public.member_fees
    set amount_paid = paid,
        status = case
          when status = 'cancelled' then 'cancelled'
          when paid >= amount_due then 'paid'
          when paid > 0 then 'partial'
          else 'due' end::public.fee_status
    where id = p_fee;
end;
$$;

create or replace function public.fee_payments_after_change()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_fee_status(coalesce(new.member_fee_id, old.member_fee_id));
  return null;
end;
$$;
create trigger fee_payments_refresh after insert or update or delete on public.fee_payments
  for each row execute function public.fee_payments_after_change();

/*
  Enregistre le paiement d'une cotisation ET l'écriture comptable associée.
  - p_bank_tx fourni : le mouvement bancaire est comptabilisé sur le compte de cotisation.
  - espèces : 530 Caisse / 756 Cotisations (journal CA).
  - chèque, virement, carte : 512x / 756 sur le compte bancaire choisi.
*/
create or replace function public.record_fee_payment(
  p_fee uuid,
  p_date date,
  p_amount bigint,
  p_method public.payment_method,
  p_bank_account uuid default null,
  p_bank_tx uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.member_fees;
  m public.members;
  income_acc uuid;
  debit_acc uuid;
  jrn uuid;
  eid uuid;
  pid uuid;
  tx public.bank_transactions;
begin
  select * into f from public.member_fees where id = p_fee for update;
  if f.id is null then raise exception 'Cotisation introuvable'; end if;
  perform public.assert_finance_writer(f.organization_id);
  if f.status = 'cancelled' then raise exception 'Cotisation annulée'; end if;
  if p_amount <= 0 then raise exception 'Montant invalide'; end if;

  select * into m from public.members where id = f.member_id;
  select coalesce(
    (select account_id from public.fee_types where id = f.fee_type_id),
    (select id from public.accounts where organization_id = f.organization_id and number = '756')
  ) into income_acc;
  if income_acc is null then raise exception 'Compte 756 « Cotisations » absent du plan comptable'; end if;

  if p_bank_tx is not null then
    select * into tx from public.bank_transactions where id = p_bank_tx and organization_id = f.organization_id;
    if tx.id is null then raise exception 'Mouvement bancaire introuvable'; end if;
    if tx.amount <> p_amount then raise exception 'Le montant ne correspond pas au mouvement bancaire'; end if;
    eid := public.book_bank_transaction(p_bank_tx, income_acc,
      'Cotisation ' || f.label || ' — ' || m.first_name || ' ' || m.last_name, null);
  else
    if p_method = 'cash' then
      select id into jrn from public.journals where organization_id = f.organization_id and code = 'CA';
      select id into debit_acc from public.accounts where organization_id = f.organization_id and number = '530';
      if jrn is null or debit_acc is null then raise exception 'Journal de caisse non configuré'; end if;
    else
      if p_bank_account is null then
        select id into p_bank_account from public.bank_accounts
          where organization_id = f.organization_id and not is_archived order by created_at limit 1;
      end if;
      select journal_id, account_id into jrn, debit_acc from public.bank_accounts
        where id = p_bank_account and organization_id = f.organization_id;
      if jrn is null then raise exception 'Aucun compte bancaire : créez-en un ou choisissez « espèces »'; end if;
    end if;

    eid := public.create_journal_entry(
      f.organization_id, jrn, p_date,
      'Cotisation ' || f.label || ' — ' || m.first_name || ' ' || m.last_name,
      jsonb_build_array(
        jsonb_build_object('account_id', debit_acc, 'debit', p_amount, 'credit', 0),
        jsonb_build_object('account_id', income_acc, 'debit', 0, 'credit', p_amount)
      ),
      'ADH-' || m.member_number, true, 'member_fee', null
    );
  end if;

  insert into public.fee_payments (organization_id, member_fee_id, date, amount, method, entry_id, bank_transaction_id, created_by)
  values (f.organization_id, p_fee, p_date, p_amount, p_method, eid, p_bank_tx, auth.uid())
  returning id into pid;

  return pid;
end;
$$;

-- Appel de cotisation en masse pour tous les adhérents actifs
create or replace function public.issue_fees(
  p_org uuid,
  p_fee_type uuid,
  p_label text,
  p_period_start date,
  p_period_end date,
  p_due_date date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  ft public.fee_types;
  n integer;
begin
  perform public.assert_finance_writer(p_org);
  select * into ft from public.fee_types where id = p_fee_type and organization_id = p_org;
  if ft.id is null then raise exception 'Type de cotisation introuvable'; end if;

  insert into public.member_fees (organization_id, member_id, fee_type_id, label, period_start, period_end, amount_due, due_date)
  select p_org, m.id, ft.id, p_label, p_period_start, p_period_end, ft.amount, p_due_date
  from public.members m
  where m.organization_id = p_org and m.status = 'active'
    and not exists (
      select 1 from public.member_fees x
      where x.member_id = m.id and x.fee_type_id = ft.id and x.period_start = p_period_start and x.status <> 'cancelled'
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

alter table public.members enable row level security;
alter table public.fee_types enable row level security;
alter table public.member_fees enable row level security;
alter table public.fee_payments enable row level security;
alter table public.fee_reminders enable row level security;

create policy members_select on public.members for select to authenticated using (public.is_org_member(organization_id));
create policy members_write on public.members for all to authenticated
  using (public.can_write_finance(organization_id)) with check (public.can_write_finance(organization_id));

create policy fee_types_select on public.fee_types for select to authenticated using (public.is_org_member(organization_id));
create policy fee_types_write on public.fee_types for all to authenticated
  using (public.can_write_finance(organization_id)) with check (public.can_write_finance(organization_id));

create policy member_fees_select on public.member_fees for select to authenticated using (public.is_org_member(organization_id));
create policy member_fees_insert on public.member_fees for insert to authenticated
  with check (public.can_write_finance(organization_id) and amount_paid = 0);
create policy member_fees_update on public.member_fees for update to authenticated
  using (public.can_write_finance(organization_id)) with check (public.can_write_finance(organization_id));
create policy member_fees_delete on public.member_fees for delete to authenticated
  using (public.can_write_finance(organization_id) and amount_paid = 0);

create policy fee_payments_select on public.fee_payments for select to authenticated using (public.is_org_member(organization_id));
create policy fee_reminders_select on public.fee_reminders for select to authenticated using (public.is_org_member(organization_id));
create policy fee_reminders_insert on public.fee_reminders for insert to authenticated with check (public.can_write_finance(organization_id));

grant select, insert, update, delete on public.members, public.fee_types to authenticated;
grant select, insert, update, delete on public.member_fees to authenticated;
grant select on public.fee_payments to authenticated;
grant select, insert on public.fee_reminders to authenticated;
grant execute on function public.record_fee_payment(uuid, date, bigint, public.payment_method, uuid, uuid) to authenticated;
grant execute on function public.issue_fees(uuid, uuid, text, date, date, date) to authenticated;

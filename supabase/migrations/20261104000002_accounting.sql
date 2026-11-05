-- =============================================================================
-- ASSOCIA COMPTA — 0002 : Moteur comptable (partie double)
-- =============================================================================
-- Référentiel : règlement ANC n° 2018-06 (comptes annuels des personnes morales
-- de droit privé à but non lucratif).
--
-- Invariants garantis ici, et non dans l'application :
--   I1. Écriture validée ⇒ Σ débit = Σ crédit, au moins 2 lignes.
--   I2. Écriture validée ⇒ immuable (correction par contre-passation).
--   I3. Aucune écriture dans un exercice clôturé.
--   I4. Une ligne = débit XOR crédit, montant strictement positif.
--   I5. La date de l'écriture appartient à son exercice.
-- Tous les montants sont en CENTIMES (bigint).
-- =============================================================================

create type public.fiscal_year_status as enum ('open', 'closed');
create type public.account_kind as enum ('equity', 'fixed_asset', 'stock', 'third_party', 'financial', 'expense', 'income', 'special');
create type public.journal_type as enum ('bank', 'cash', 'sales', 'purchases', 'misc', 'opening');
create type public.entry_status as enum ('draft', 'posted');
create type public.entry_source as enum ('manual', 'bank', 'member_fee', 'opening', 'closing', 'reversal', 'import');

-- -----------------------------------------------------------------------------
create table public.fiscal_years (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  label            text not null,
  start_date       date not null,
  end_date         date not null,
  status           public.fiscal_year_status not null default 'open',
  closed_at        timestamptz,
  closed_by        uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  check (end_date > start_date),
  check (end_date - start_date <= 731), -- 24 mois maximum (premier exercice)
  exclude using gist (
    organization_id extensions.gist_uuid_ops with =,
    daterange(start_date, end_date, '[]') with &&
  )
);
create index fiscal_years_org_idx on public.fiscal_years (organization_id, start_date);

-- -----------------------------------------------------------------------------
create table public.accounts (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  number           text not null check (number ~ '^[1-8][0-9]{1,9}$'),
  label            text not null,
  class            smallint generated always as ((substr(number, 1, 1))::smallint) stored,
  kind             public.account_kind not null,
  is_active        boolean not null default true,
  is_system        boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (organization_id, number)
);
create index accounts_org_number_idx on public.accounts (organization_id, number);

-- -----------------------------------------------------------------------------
create table public.journals (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  code             text not null check (code ~ '^[A-Z0-9]{1,6}$'),
  label            text not null,
  type             public.journal_type not null,
  created_at       timestamptz not null default now(),
  unique (organization_id, code)
);

-- -----------------------------------------------------------------------------
create table public.journal_entries (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  fiscal_year_id   uuid not null references public.fiscal_years (id) on delete restrict,
  journal_id       uuid not null references public.journals (id) on delete restrict,
  entry_number     integer,
  date             date not null,
  label            text not null check (length(trim(label)) > 0),
  reference        text,
  status           public.entry_status not null default 'draft',
  source           public.entry_source not null default 'manual',
  reversal_of      uuid references public.journal_entries (id) on delete restrict,
  project_id       uuid, -- FK ajoutée dans 0006
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  posted_at        timestamptz,
  unique (journal_id, fiscal_year_id, entry_number)
);
create index journal_entries_org_date_idx on public.journal_entries (organization_id, date desc);
create index journal_entries_fy_idx on public.journal_entries (fiscal_year_id);
create unique index journal_entries_single_reversal on public.journal_entries (reversal_of) where reversal_of is not null;

create table public.entry_lines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  entry_id         uuid not null references public.journal_entries (id) on delete cascade,
  line_no          smallint not null,
  account_id       uuid not null references public.accounts (id) on delete restrict,
  label            text,
  debit            bigint not null default 0,
  credit           bigint not null default 0,
  project_id       uuid, -- FK ajoutée dans 0006
  check (debit >= 0 and credit >= 0),
  check ((debit = 0) <> (credit = 0)),
  unique (entry_id, line_no)
);
create index entry_lines_entry_idx on public.entry_lines (entry_id);
create index entry_lines_account_idx on public.entry_lines (organization_id, account_id);
create index entry_lines_project_idx on public.entry_lines (project_id) where project_id is not null;

-- Séquences de numérotation par journal et exercice (sans trou)
create table public.entry_sequences (
  journal_id      uuid not null references public.journals (id) on delete cascade,
  fiscal_year_id  uuid not null references public.fiscal_years (id) on delete cascade,
  last_number     integer not null default 0,
  primary key (journal_id, fiscal_year_id)
);

-- -----------------------------------------------------------------------------
-- I1 : équilibre vérifié en fin de transaction
-- -----------------------------------------------------------------------------
create or replace function public.check_entry_balanced()
returns trigger
language plpgsql
as $$
declare
  eid uuid;
  st public.entry_status;
  d bigint;
  c bigint;
  n integer;
begin
  if tg_table_name = 'journal_entries' then
    eid := coalesce(new.id, old.id);
  else
    eid := coalesce(new.entry_id, old.entry_id);
  end if;

  select status into st from public.journal_entries where id = eid;
  if st is distinct from 'posted' then
    return null;
  end if;

  select coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*)
    into d, c, n
  from public.entry_lines where entry_id = eid;

  if n < 2 then
    raise exception 'Écriture % : au moins deux lignes sont requises', eid using errcode = '23514';
  end if;
  if d <> c then
    raise exception 'Écriture % déséquilibrée : débit % ≠ crédit %', eid, d, c using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger entry_balanced_on_entry
  after insert or update on public.journal_entries
  deferrable initially deferred
  for each row execute function public.check_entry_balanced();

create constraint trigger entry_balanced_on_lines
  after insert or update or delete on public.entry_lines
  deferrable initially deferred
  for each row execute function public.check_entry_balanced();

-- -----------------------------------------------------------------------------
-- I2, I3, I5 : immutabilité, exercice ouvert, cohérence des dates
-- -----------------------------------------------------------------------------
create or replace function public.guard_journal_entry()
returns trigger
language plpgsql
as $$
declare
  fy public.fiscal_years;
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception 'Une écriture validée ne peut pas être supprimée (utilisez la contre-passation)'
        using errcode = '42501';
    end if;
    select * into fy from public.fiscal_years where id = old.fiscal_year_id;
    if fy.status = 'closed' then
      raise exception 'Exercice clôturé' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.status = 'posted' then
    -- Seule mutation tolérée : aucune. Les écritures validées sont figées.
    raise exception 'Une écriture validée est immuable (utilisez la contre-passation)'
      using errcode = '42501';
  end if;

  select * into fy from public.fiscal_years where id = new.fiscal_year_id;
  if fy.organization_id <> new.organization_id then
    raise exception 'Exercice d''une autre organisation';
  end if;
  if fy.status = 'closed' then
    raise exception 'L''exercice « % » est clôturé', fy.label using errcode = '42501';
  end if;
  if new.date < fy.start_date or new.date > fy.end_date then
    raise exception 'La date % est hors de l''exercice « % »', new.date, fy.label using errcode = '23514';
  end if;
  if not exists (select 1 from public.journals j where j.id = new.journal_id and j.organization_id = new.organization_id) then
    raise exception 'Journal d''une autre organisation';
  end if;
  if new.status = 'posted' and new.posted_at is null then
    new.posted_at := now();
  end if;
  return new;
end;
$$;

create trigger journal_entries_guard
  before insert or update or delete on public.journal_entries
  for each row execute function public.guard_journal_entry();

create or replace function public.guard_entry_line()
returns trigger
language plpgsql
as $$
declare
  e public.journal_entries;
  acc_org uuid;
begin
  select * into e from public.journal_entries where id = coalesce(new.entry_id, old.entry_id);
  if e.id is null then
    return coalesce(new, old); -- cascade depuis une suppression d'écriture brouillon
  end if;
  if e.status = 'posted' then
    raise exception 'Les lignes d''une écriture validée sont immuables' using errcode = '42501';
  end if;
  if tg_op <> 'DELETE' then
    if new.organization_id <> e.organization_id then
      raise exception 'Organisation incohérente';
    end if;
    select organization_id into acc_org from public.accounts where id = new.account_id;
    if acc_org is distinct from new.organization_id then
      raise exception 'Compte d''une autre organisation';
    end if;
    return new;
  end if;
  return old;
end;
$$;

create trigger entry_lines_guard
  before insert or update or delete on public.entry_lines
  for each row execute function public.guard_entry_line();

-- Un exercice clôturé ne se rouvre pas, et ne se supprime pas s'il contient des écritures.
create or replace function public.guard_fiscal_year()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'closed' and new.status = 'open' then
      raise exception 'Un exercice clôturé ne peut pas être rouvert' using errcode = '42501';
    end if;
    if old.status = 'closed' and (new.start_date <> old.start_date or new.end_date <> old.end_date) then
      raise exception 'Exercice clôturé' using errcode = '42501';
    end if;
    if (new.start_date <> old.start_date or new.end_date <> old.end_date)
       and exists (
         select 1 from public.journal_entries
         where fiscal_year_id = old.id and (date < new.start_date or date > new.end_date)
       ) then
      raise exception 'Des écritures existent hors des nouvelles dates';
    end if;
  end if;
  return new;
end;
$$;

create trigger fiscal_years_guard before update on public.fiscal_years
  for each row execute function public.guard_fiscal_year();

-- -----------------------------------------------------------------------------
-- API comptable (SECURITY DEFINER + contrôle de rôle explicite)
-- -----------------------------------------------------------------------------

-- Trouve l'exercice ouvert contenant une date
create or replace function public.fiscal_year_for(org uuid, d date)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.fiscal_years
  where organization_id = org and d between start_date and end_date
  limit 1;
$$;

create or replace function public.next_entry_number(p_journal uuid, p_fy uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.entry_sequences (journal_id, fiscal_year_id, last_number)
  values (p_journal, p_fy, 1)
  on conflict (journal_id, fiscal_year_id)
  do update set last_number = public.entry_sequences.last_number + 1
  returning last_number into n;
  return n;
end;
$$;

/*
  Crée une écriture complète de façon atomique.
  p_lines : [{ "account_id": uuid, "debit": int, "credit": int, "label": text?, "project_id": uuid? }, ...]
*/
create or replace function public.create_journal_entry(
  p_org uuid,
  p_journal uuid,
  p_date date,
  p_label text,
  p_lines jsonb,
  p_reference text default null,
  p_post boolean default true,
  p_source public.entry_source default 'manual',
  p_project uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  fy uuid;
  eid uuid;
  line jsonb;
  i smallint := 0;
begin
  perform public.assert_finance_writer(p_org);

  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 then
    raise exception 'Une écriture comporte au moins deux lignes' using errcode = '22023';
  end if;

  fy := public.fiscal_year_for(p_org, p_date);
  if fy is null then
    raise exception 'Aucun exercice ne couvre la date %', p_date using errcode = '23514';
  end if;

  insert into public.journal_entries (
    organization_id, fiscal_year_id, journal_id, date, label, reference,
    status, source, project_id, created_by
  ) values (
    p_org, fy, p_journal, p_date, p_label, p_reference,
    'draft', p_source, p_project, auth.uid()
  ) returning id into eid;

  for line in select * from jsonb_array_elements(p_lines) loop
    i := i + 1;
    insert into public.entry_lines (
      organization_id, entry_id, line_no, account_id, label, debit, credit, project_id
    ) values (
      p_org, eid, i,
      (line ->> 'account_id')::uuid,
      nullif(line ->> 'label', ''),
      coalesce((line ->> 'debit')::bigint, 0),
      coalesce((line ->> 'credit')::bigint, 0),
      coalesce(nullif(line ->> 'project_id', '')::uuid, p_project)
    );
  end loop;

  if p_post then
    update public.journal_entries
      set status = 'posted',
          entry_number = public.next_entry_number(p_journal, fy),
          posted_at = now()
      where id = eid;
  end if;

  return eid;
end;
$$;

create or replace function public.post_journal_entry(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.journal_entries;
begin
  select * into e from public.journal_entries where id = p_entry for update;
  if e.id is null then raise exception 'Écriture introuvable'; end if;
  perform public.assert_finance_writer(e.organization_id);
  if e.status = 'posted' then return; end if;
  update public.journal_entries
    set status = 'posted',
        entry_number = public.next_entry_number(e.journal_id, e.fiscal_year_id),
        posted_at = now()
    where id = p_entry;
end;
$$;

create or replace function public.delete_draft_entry(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.journal_entries;
begin
  select * into e from public.journal_entries where id = p_entry;
  if e.id is null then raise exception 'Écriture introuvable'; end if;
  perform public.assert_finance_writer(e.organization_id);
  delete from public.journal_entries where id = p_entry; -- le trigger refuse si validée
end;
$$;

-- Contre-passation : crée l'écriture inverse, datée p_date (défaut : aujourd'hui
-- si dans un exercice ouvert, sinon date d'origine).
create or replace function public.reverse_journal_entry(p_entry uuid, p_date date default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.journal_entries;
  lines jsonb;
  new_id uuid;
  d date;
begin
  select * into e from public.journal_entries where id = p_entry;
  if e.id is null then raise exception 'Écriture introuvable'; end if;
  perform public.assert_finance_writer(e.organization_id);
  if e.status <> 'posted' then
    raise exception 'Seule une écriture validée peut être contre-passée';
  end if;

  d := coalesce(p_date, e.date);

  select jsonb_agg(jsonb_build_object(
           'account_id', account_id,
           'debit', credit,
           'credit', debit,
           'label', label,
           'project_id', project_id
         ) order by line_no)
    into lines
  from public.entry_lines where entry_id = p_entry;

  new_id := public.create_journal_entry(
    e.organization_id, e.journal_id, d,
    'Contre-passation : ' || e.label, lines, e.reference, false, 'reversal', e.project_id
  );
  update public.journal_entries set reversal_of = p_entry where id = new_id;
  perform public.post_journal_entry(new_id);
  return new_id;
end;
$$;

-- Clôture d'exercice : vérifie qu'aucun brouillon ne subsiste, puis verrouille.
create or replace function public.close_fiscal_year(p_fy uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fy public.fiscal_years;
begin
  select * into fy from public.fiscal_years where id = p_fy for update;
  if fy.id is null then raise exception 'Exercice introuvable'; end if;
  if not public.can_admin_org(fy.organization_id) and not public.has_org_role(fy.organization_id, array['treasurer']::public.org_role[]) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if fy.status = 'closed' then return; end if;
  if exists (select 1 from public.journal_entries where fiscal_year_id = p_fy and status = 'draft') then
    raise exception 'Des écritures en brouillon subsistent : validez-les ou supprimez-les avant la clôture';
  end if;
  update public.fiscal_years
    set status = 'closed', closed_at = now(), closed_by = auth.uid()
    where id = p_fy;
end;
$$;

-- -----------------------------------------------------------------------------
-- Balance générale (base de tous les états financiers)
-- -----------------------------------------------------------------------------
create or replace function public.trial_balance(p_org uuid, p_from date, p_to date)
returns table (
  account_id uuid,
  number text,
  label text,
  kind public.account_kind,
  debit bigint,
  credit bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select a.id, a.number, a.label, a.kind,
         coalesce(sum(l.debit), 0)::bigint,
         coalesce(sum(l.credit), 0)::bigint
  from public.entry_lines l
  join public.journal_entries e on e.id = l.entry_id
  join public.accounts a on a.id = l.account_id
  where l.organization_id = p_org
    and e.status = 'posted'
    and e.date between p_from and p_to
  group by a.id, a.number, a.label, a.kind
  order by a.number;
$$;

-- Solde d'un compte à une date
create or replace function public.account_balance(p_account uuid, p_at date default current_date)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(sum(l.debit - l.credit), 0)::bigint
  from public.entry_lines l
  join public.journal_entries e on e.id = l.entry_id
  where l.account_id = p_account and e.status = 'posted' and e.date <= p_at;
$$;

-- Vue grand livre (RLS héritée grâce à security_invoker)
create view public.v_ledger_lines
with (security_invoker = true)
as
select
  l.id,
  l.organization_id,
  l.entry_id,
  l.line_no,
  l.account_id,
  a.number as account_number,
  a.label  as account_label,
  e.journal_id,
  j.code   as journal_code,
  e.fiscal_year_id,
  e.entry_number,
  e.date,
  coalesce(l.label, e.label) as label,
  e.reference,
  e.status,
  e.source,
  l.debit,
  l.credit,
  l.project_id
from public.entry_lines l
join public.journal_entries e on e.id = l.entry_id
join public.accounts a on a.id = l.account_id
join public.journals j on j.id = e.journal_id;

-- -----------------------------------------------------------------------------
-- RLS : lecture pour les membres ; écritures exclusivement via les fonctions.
-- -----------------------------------------------------------------------------
alter table public.fiscal_years enable row level security;
alter table public.accounts enable row level security;
alter table public.journals enable row level security;
alter table public.journal_entries enable row level security;
alter table public.entry_lines enable row level security;
alter table public.entry_sequences enable row level security;

create policy fy_select on public.fiscal_years for select to authenticated using (public.is_org_member(organization_id));
create policy fy_insert on public.fiscal_years for insert to authenticated with check (public.can_write_finance(organization_id) and status = 'open');
create policy fy_update on public.fiscal_years for update to authenticated
  using (public.can_write_finance(organization_id) and status = 'open')
  with check (public.can_write_finance(organization_id) and status = 'open');

create policy accounts_select on public.accounts for select to authenticated using (public.is_org_member(organization_id));
create policy accounts_insert on public.accounts for insert to authenticated with check (public.can_write_finance(organization_id));
create policy accounts_update on public.accounts for update to authenticated
  using (public.can_write_finance(organization_id) and not is_system)
  with check (public.can_write_finance(organization_id));

create policy journals_select on public.journals for select to authenticated using (public.is_org_member(organization_id));
create policy journals_insert on public.journals for insert to authenticated with check (public.can_write_finance(organization_id));

create policy entries_select on public.journal_entries for select to authenticated using (public.is_org_member(organization_id));
create policy lines_select on public.entry_lines for select to authenticated using (public.is_org_member(organization_id));

grant select, insert, update on public.fiscal_years to authenticated;
grant select, insert, update on public.accounts to authenticated;
grant select, insert on public.journals to authenticated;
grant select on public.journal_entries, public.entry_lines to authenticated;
grant select on public.v_ledger_lines to authenticated;

revoke all on function public.create_journal_entry(uuid, uuid, date, text, jsonb, text, boolean, public.entry_source, uuid) from public;
revoke all on function public.next_entry_number(uuid, uuid) from public;
grant execute on function public.create_journal_entry(uuid, uuid, date, text, jsonb, text, boolean, public.entry_source, uuid) to authenticated;
grant execute on function public.post_journal_entry(uuid) to authenticated;
grant execute on function public.delete_draft_entry(uuid) to authenticated;
grant execute on function public.reverse_journal_entry(uuid, date) to authenticated;
grant execute on function public.close_fiscal_year(uuid) to authenticated;
grant execute on function public.trial_balance(uuid, date, date) to authenticated;
grant execute on function public.account_balance(uuid, date) to authenticated;

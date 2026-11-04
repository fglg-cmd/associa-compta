-- =============================================================================
-- ASSOCIA COMPTA — 0006 : Projets & événements (budget, réalisé, rentabilité)
-- =============================================================================

create type public.project_kind as enum ('project', 'event');
create type public.project_status as enum ('planned', 'active', 'closed');
create type public.budget_direction as enum ('income', 'expense');

create table public.projects (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  kind             public.project_kind not null default 'project',
  description      text,
  start_date       date,
  end_date         date,
  status           public.project_status not null default 'active',
  color            text not null default '#4F46E5' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at       timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index projects_org_idx on public.projects (organization_id, status);

create table public.project_budget_lines (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  project_id       uuid not null references public.projects (id) on delete cascade,
  label            text not null,
  direction        public.budget_direction not null,
  account_id       uuid references public.accounts (id) on delete set null,
  amount           bigint not null check (amount >= 0),
  created_at       timestamptz not null default now()
);
create index project_budget_lines_project_idx on public.project_budget_lines (project_id);

alter table public.journal_entries
  add constraint journal_entries_project_fk foreign key (project_id) references public.projects (id) on delete set null;
alter table public.entry_lines
  add constraint entry_lines_project_fk foreign key (project_id) references public.projects (id) on delete set null;
alter table public.categorization_rules
  add constraint categorization_rules_project_fk foreign key (project_id) references public.projects (id) on delete set null;
alter table public.bank_transactions
  add constraint bank_tx_suggested_project_fk foreign key (suggested_project_id) references public.projects (id) on delete set null;

-- Les lignes d'écriture validées sont immuables ; la suppression d'un projet
-- doit pourtant pouvoir détacher ses lignes. On l'autorise explicitement.
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
    return coalesce(new, old);
  end if;
  if e.status = 'posted' then
    if tg_op = 'UPDATE'
       and new.project_id is null and old.project_id is not null
       and (new.account_id, new.debit, new.credit, new.entry_id, new.line_no) = (old.account_id, old.debit, old.credit, old.entry_id, old.line_no)
       and not exists (select 1 from public.projects p where p.id = old.project_id) then
      return new; -- détachement suite à suppression du projet
    end if;
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
    if new.project_id is not null and not exists (
      select 1 from public.projects p where p.id = new.project_id and p.organization_id = new.organization_id
    ) then
      raise exception 'Projet d''une autre organisation';
    end if;
    return new;
  end if;
  return old;
end;
$$;

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
    if new.project_id is null and old.project_id is not null
       and not exists (select 1 from public.projects p where p.id = old.project_id)
       and (new.date, new.label, new.journal_id, new.fiscal_year_id, new.status, new.entry_number)
           = (old.date, old.label, old.journal_id, old.fiscal_year_id, old.status, old.entry_number) then
      return new;
    end if;
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

-- Budget vs réalisé par projet (réalisé = comptes de classe 6 et 7 imputés au projet)
create or replace function public.project_financials(p_org uuid)
returns table (
  project_id uuid,
  budget_income bigint,
  budget_expense bigint,
  actual_income bigint,
  actual_expense bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id,
    coalesce((select sum(amount) from public.project_budget_lines b where b.project_id = p.id and b.direction = 'income'), 0)::bigint,
    coalesce((select sum(amount) from public.project_budget_lines b where b.project_id = p.id and b.direction = 'expense'), 0)::bigint,
    coalesce((select sum(l.credit - l.debit) from public.entry_lines l
              join public.journal_entries e on e.id = l.entry_id
              join public.accounts a on a.id = l.account_id
              where l.project_id = p.id and e.status = 'posted' and a.class = 7), 0)::bigint,
    coalesce((select sum(l.debit - l.credit) from public.entry_lines l
              join public.journal_entries e on e.id = l.entry_id
              join public.accounts a on a.id = l.account_id
              where l.project_id = p.id and e.status = 'posted' and a.class = 6), 0)::bigint
  from public.projects p
  where p.organization_id = p_org;
$$;

alter table public.projects enable row level security;
alter table public.project_budget_lines enable row level security;

create policy projects_select on public.projects for select to authenticated using (public.is_org_member(organization_id));
create policy projects_write on public.projects for all to authenticated
  using (public.can_write_finance(organization_id)) with check (public.can_write_finance(organization_id));
create policy pbl_select on public.project_budget_lines for select to authenticated using (public.is_org_member(organization_id));
create policy pbl_write on public.project_budget_lines for all to authenticated
  using (public.can_write_finance(organization_id)) with check (
    public.can_write_finance(organization_id)
    and exists (select 1 from public.projects p where p.id = project_id and p.organization_id = project_budget_lines.organization_id)
  );

grant select, insert, update, delete on public.projects, public.project_budget_lines to authenticated;
grant execute on function public.project_financials(uuid) to authenticated;

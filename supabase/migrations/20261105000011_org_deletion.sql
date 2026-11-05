-- =============================================================================
-- ASSOCIA COMPTA — 0011 : Suppression complète d'une association
-- =============================================================================
-- Les écritures validées restent immuables, SAUF lorsque l'association entière
-- est supprimée (droit à l'effacement RGPD) : la suppression en cascade passe.

-- 1. Les clés « restrict » bloquent la cascade : on passe en « no action »
--    (même protection pour une suppression isolée, vérifiée en fin d'instruction).
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, pg_get_constraintdef(c.oid) as def
    from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.contype = 'f' and c.confdeltype = 'r'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s', r.tbl, r.conname, replace(r.def, 'ON DELETE RESTRICT', ''));
  end loop;
end $$;

-- 2. Les gardes laissent passer la cascade quand l'association n'existe plus.
create or replace function public.guard_journal_entry()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  fy public.fiscal_years;
begin
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.organizations o where o.id = old.organization_id) then
      return old; -- suppression de l'association entière
    end if;
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

create or replace function public.guard_entry_line()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
declare
  e public.journal_entries;
  acc_org uuid;
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.organizations o where o.id = old.organization_id) then
    return old; -- suppression de l'association entière
  end if;
  select * into e from public.journal_entries where id = coalesce(new.entry_id, old.entry_id);
  if e.id is null then
    return coalesce(new, old);
  end if;
  if e.status = 'posted' then
    if tg_op = 'UPDATE'
       and new.project_id is null and old.project_id is not null
       and (new.account_id, new.debit, new.credit, new.entry_id, new.line_no) = (old.account_id, old.debit, old.credit, old.entry_id, old.line_no)
       and not exists (select 1 from public.projects p where p.id = old.project_id) then
      return new;
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

-- 3. Le journal d'audit ne trace pas les lignes effacées avec leur association.
create or replace function public.audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec jsonb;
  org uuid;
begin
  rec := to_jsonb(coalesce(new, old));
  org := (rec ->> 'organization_id')::uuid;
  if tg_table_name = 'organizations' then org := (rec ->> 'id')::uuid; end if;
  if tg_op = 'DELETE' and tg_table_name = 'organizations' then return old; end if;
  if org is not null and not exists (select 1 from public.organizations o where o.id = org) then
    return coalesce(new, old); -- suppression de l'association entière
  end if;
  rec := rec - 'ocr_text' - 'search';
  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, data)
  values (org, auth.uid(), lower(tg_op), tg_table_name, (rec ->> 'id')::uuid, rec);
  return coalesce(new, old);
end;
$$;
revoke execute on function public.audit_trigger() from public, anon, authenticated;

revoke execute on function public.guard_journal_entry(), public.guard_entry_line() from public, anon, authenticated;

-- =============================================================================
-- ASSOCIA COMPTA — 0007 : Plateforme (onboarding, abonnements, IA, audit, admin)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Onboarding : création atomique d'une association prête à l'emploi.
-- p_chart : [{ "number": "606", "label": "...", "kind": "expense" }, ...]
-- Le plan comptable provient du package @associa/accounting (source unique).
-- -----------------------------------------------------------------------------
create or replace function public.create_organization(
  p_name text,
  p_slug text,
  p_fy_start date,
  p_fy_end date,
  p_chart jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if (select count(*) from public.memberships where user_id = uid and role = 'owner') >= 20 then
    raise exception 'Nombre maximal d''associations atteint pour ce compte';
  end if;

  insert into public.organizations (name, slug, fiscal_year_start_month, created_by)
  values (trim(p_name), lower(p_slug), extract(month from p_fy_start)::smallint, uid)
  returning id into org;

  insert into public.memberships (organization_id, user_id, role) values (org, uid, 'owner');

  insert into public.fiscal_years (organization_id, label, start_date, end_date)
  values (
    org,
    case when extract(year from p_fy_start) = extract(year from p_fy_end)
      then 'Exercice ' || extract(year from p_fy_start)::text
      else 'Exercice ' || extract(year from p_fy_start)::text || '-' || extract(year from p_fy_end)::text end,
    p_fy_start, p_fy_end
  );

  insert into public.accounts (organization_id, number, label, kind, is_system)
  select org, c ->> 'number', c ->> 'label', (c ->> 'kind')::public.account_kind, true
  from jsonb_array_elements(p_chart) c;

  insert into public.journals (organization_id, code, label, type) values
    (org, 'CA', 'Caisse', 'cash'),
    (org, 'VT', 'Ventes et recettes', 'sales'),
    (org, 'AC', 'Achats', 'purchases'),
    (org, 'OD', 'Opérations diverses', 'misc'),
    (org, 'AN', 'À-nouveaux', 'opening');

  insert into public.fee_types (organization_id, label, amount, account_id)
  select org, 'Cotisation annuelle', 0, id from public.accounts where organization_id = org and number = '756';

  return org;
end;
$$;
grant execute on function public.create_organization(text, text, date, date, jsonb) to authenticated;

-- Nouvel exercice à la suite du dernier
create or replace function public.open_next_fiscal_year(p_org uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  last public.fiscal_years;
  fy uuid;
  s date;
  e date;
begin
  perform public.assert_finance_writer(p_org);
  select * into last from public.fiscal_years where organization_id = p_org order by end_date desc limit 1;
  s := last.end_date + 1;
  e := (s + interval '1 year' - interval '1 day')::date;
  insert into public.fiscal_years (organization_id, label, start_date, end_date)
  values (p_org,
    case when extract(year from s) = extract(year from e) then 'Exercice ' || extract(year from s)::text
      else 'Exercice ' || extract(year from s)::text || '-' || extract(year from e)::text end,
    s, e)
  returning id into fy;
  return fy;
end;
$$;
grant execute on function public.open_next_fiscal_year(uuid) to authenticated;

-- Les montants payés d'une cotisation ne se modifient que via les paiements.
create or replace function public.guard_member_fee()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'authenticated' and (new.amount_paid <> old.amount_paid
     or (new.status in ('paid', 'partial') and new.status <> old.status)) then
    raise exception 'Utilisez l''enregistrement de paiement' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger member_fees_guard before update on public.member_fees
  for each row execute function public.guard_member_fee();

-- -----------------------------------------------------------------------------
-- Abonnements Stripe (écriture exclusivement par le webhook, clé service)
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  organization_id        uuid primary key references public.organizations (id) on delete cascade,
  stripe_customer_id     text not null,
  stripe_subscription_id text unique,
  stripe_price_id        text,
  plan                   public.plan_tier not null default 'free',
  status                 text not null,
  interval               text,
  amount                 bigint,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.is_org_member(organization_id));
grant select on public.subscriptions to authenticated;

-- Événements Stripe traités (idempotence du webhook)
create table public.stripe_events (
  id           text primary key,
  type         text not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- -----------------------------------------------------------------------------
-- Assistant IA
-- -----------------------------------------------------------------------------
create table public.ai_conversations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  title            text not null default 'Nouvelle conversation',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations (organization_id, user_id, updated_at desc);

create table public.ai_messages (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  conversation_id  uuid not null references public.ai_conversations (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  provider         text,
  model            text,
  input_tokens     integer,
  output_tokens    integer,
  created_at       timestamptz not null default now()
);
create index ai_messages_conv_idx on public.ai_messages (conversation_id, created_at);
create index ai_messages_org_month_idx on public.ai_messages (organization_id, created_at) where role = 'user';

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

create policy ai_conv_own on public.ai_conversations for all to authenticated
  using (user_id = auth.uid() and public.is_org_member(organization_id))
  with check (user_id = auth.uid() and public.is_org_member(organization_id));
create policy ai_msg_own on public.ai_messages for all to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (
    public.is_org_member(organization_id)
    and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid() and c.organization_id = ai_messages.organization_id)
  );
grant select, insert, update, delete on public.ai_conversations, public.ai_messages to authenticated;

-- -----------------------------------------------------------------------------
-- Journal d'audit (piste d'audit inaltérable)
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id               bigint generated always as identity primary key,
  organization_id  uuid references public.organizations (id) on delete cascade,
  actor_id         uuid,
  action           text not null,
  entity           text not null,
  entity_id        uuid,
  data             jsonb,
  created_at       timestamptz not null default now()
);
create index audit_log_org_idx on public.audit_log (organization_id, created_at desc);
alter table public.audit_log enable row level security;
create policy audit_select on public.audit_log for select to authenticated
  using (public.can_admin_org(organization_id) or public.has_org_role(organization_id, array['treasurer', 'viewer']::public.org_role[]));
grant select on public.audit_log to authenticated;

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
  -- On ne journalise pas le contenu des documents OCR (volumineux)
  rec := rec - 'ocr_text' - 'search';
  insert into public.audit_log (organization_id, actor_id, action, entity, entity_id, data)
  values (org, auth.uid(), lower(tg_op), tg_table_name, (rec ->> 'id')::uuid, rec);
  return coalesce(new, old);
end;
$$;

create trigger audit_journal_entries after insert or update or delete on public.journal_entries
  for each row execute function public.audit_trigger();
create trigger audit_fiscal_years after update on public.fiscal_years
  for each row execute function public.audit_trigger();
create trigger audit_bank_accounts after insert or update on public.bank_accounts
  for each row execute function public.audit_trigger();
create trigger audit_bank_imports after insert on public.bank_imports
  for each row execute function public.audit_trigger();
create trigger audit_documents after insert or delete on public.documents
  for each row execute function public.audit_trigger();
create trigger audit_members after insert or update or delete on public.members
  for each row execute function public.audit_trigger();
create trigger audit_fee_payments after insert on public.fee_payments
  for each row execute function public.audit_trigger();
create trigger audit_memberships after insert or update or delete on public.memberships
  for each row execute function public.audit_trigger();
create trigger audit_organizations after update on public.organizations
  for each row execute function public.audit_trigger();

-- -----------------------------------------------------------------------------
-- Tableau de bord : agrégats mensuels recettes / dépenses (classes 6 et 7)
-- -----------------------------------------------------------------------------
create or replace function public.monthly_flows(p_org uuid, p_from date, p_to date)
returns table (month date, income bigint, expense bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with months as (
    select generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month')::date as month
  )
  select m.month,
    coalesce(sum(case when a.class = 7 then l.credit - l.debit end), 0)::bigint,
    coalesce(sum(case when a.class = 6 then l.debit - l.credit end), 0)::bigint
  from months m
  left join public.journal_entries e
    on e.organization_id = p_org and e.status = 'posted'
   and date_trunc('month', e.date) = m.month and e.date between p_from and p_to
  left join public.entry_lines l on l.entry_id = e.id
  left join public.accounts a on a.id = l.account_id and a.class in (6, 7)
  group by m.month
  order by m.month;
$$;
grant execute on function public.monthly_flows(uuid, date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Back-office : statistiques SaaS (réservé aux administrateurs plateforme)
-- -----------------------------------------------------------------------------
create or replace function public.admin_platform_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'organizations', (select count(*) from public.organizations),
    'organizations_30d', (select count(*) from public.organizations where created_at > now() - interval '30 days'),
    'users', (select count(*) from public.profiles),
    'users_30d', (select count(*) from public.profiles where created_at > now() - interval '30 days'),
    'paying', (select count(*) from public.subscriptions where status in ('active', 'trialing') and plan <> 'free'),
    'mrr', (select coalesce(sum(case when interval = 'year' then amount / 12 else amount end), 0)
            from public.subscriptions where status = 'active' and plan <> 'free'),
    'by_plan', (select coalesce(jsonb_object_agg(plan, n), '{}'::jsonb) from (select plan, count(*) n from public.organizations group by plan) t),
    'entries', (select count(*) from public.journal_entries),
    'documents', (select count(*) from public.documents),
    'ai_messages_30d', (select count(*) from public.ai_messages where role = 'user' and created_at > now() - interval '30 days'),
    'signups_by_week', (
      select coalesce(jsonb_agg(jsonb_build_object('week', w, 'count', n) order by w), '[]'::jsonb)
      from (select date_trunc('week', created_at)::date w, count(*) n from public.organizations
            where created_at > now() - interval '12 weeks' group by 1) t)
  );
end;
$$;
grant execute on function public.admin_platform_stats() to authenticated;

-- -----------------------------------------------------------------------------
-- Support : tickets
-- -----------------------------------------------------------------------------
create table public.support_tickets (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references public.organizations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  subject          text not null check (length(subject) between 3 and 200),
  message          text not null check (length(message) between 10 and 10000),
  status           text not null default 'open' check (status in ('open', 'pending', 'resolved')),
  admin_reply      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.support_tickets enable row level security;
create policy tickets_own_select on public.support_tickets for select to authenticated using (user_id = auth.uid());
create policy tickets_own_insert on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid() and (organization_id is null or public.is_org_member(organization_id)) and status = 'open' and admin_reply is null);
grant select, insert on public.support_tickets to authenticated;
create trigger support_tickets_touch before update on public.support_tickets
  for each row execute function public.touch_updated_at();

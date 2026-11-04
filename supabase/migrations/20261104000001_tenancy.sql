-- =============================================================================
-- ASSOCIA COMPTA — 0001 : Multi-tenant (organisations, utilisateurs, rôles)
-- =============================================================================
-- Toute donnée métier porte un `organization_id`. L'isolation est garantie par
-- RLS : un utilisateur ne voit que les organisations dont il est membre.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create extension if not exists unaccent;

create type public.org_role as enum ('owner', 'admin', 'treasurer', 'member', 'viewer');
create type public.plan_tier as enum ('free', 'essential', 'pro');

-- -----------------------------------------------------------------------------
-- Profils utilisateurs (miroir public de auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Administrateurs de la plateforme (back-office SaaS)
-- -----------------------------------------------------------------------------
create table public.platform_admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Organisations (associations)
-- -----------------------------------------------------------------------------
create table public.organizations (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null check (length(trim(name)) between 2 and 160),
  slug                   text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$'),
  legal_form             text not null default 'association_loi_1901',
  siren                  text check (siren is null or siren ~ '^[0-9]{9}$'),
  rna                    text check (rna is null or rna ~ '^W[0-9A-Z]{9}$'),
  address_line           text,
  postal_code            text,
  city                   text,
  email                  text,
  fiscal_year_start_month smallint not null default 1 check (fiscal_year_start_month between 1 and 12),
  currency               char(3) not null default 'EUR',
  plan                   public.plan_tier not null default 'free',
  stripe_customer_id     text unique,
  created_by             uuid references auth.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.memberships (
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  role             public.org_role not null default 'member',
  created_at       timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.invitations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  email            text not null,
  role             public.org_role not null default 'member' check (role <> 'owner'),
  token            text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by       uuid references auth.users (id) on delete set null,
  expires_at       timestamptz not null default now() + interval '14 days',
  accepted_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index invitations_org_idx on public.invitations (organization_id);

-- -----------------------------------------------------------------------------
-- Fonctions d'autorisation (utilisées par toutes les politiques RLS)
-- SECURITY DEFINER pour éviter la récursion RLS sur memberships.
-- -----------------------------------------------------------------------------
create or replace function public.is_org_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(org uuid, roles public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = auth.uid() and m.role = any (roles)
  );
$$;

-- Rôles autorisés à écrire des données financières
create or replace function public.can_write_finance(org uuid)
returns boolean
language sql
stable
as $$
  select public.has_org_role(org, array['owner', 'admin', 'treasurer']::public.org_role[]);
$$;

create or replace function public.can_admin_org(org uuid)
returns boolean
language sql
stable
as $$
  select public.has_org_role(org, array['owner', 'admin']::public.org_role[]);
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

-- Lève une exception si l'utilisateur courant n'a pas le droit d'écrire.
create or replace function public.assert_finance_writer(org uuid)
returns void
language plpgsql
stable
as $$
begin
  if not public.can_write_finance(org) then
    raise exception 'Accès refusé : droits de trésorerie requis'
      using errcode = '42501';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- updated_at automatique
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Protection : le plan et le client Stripe ne sont modifiables que par le
-- service (webhook Stripe), jamais par un utilisateur.
-- -----------------------------------------------------------------------------
create or replace function public.protect_org_billing_fields()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.plan is distinct from old.plan
       or new.stripe_customer_id is distinct from old.stripe_customer_id then
      raise exception 'Le plan est géré par la facturation' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger organizations_protect_billing before update on public.organizations
  for each row execute function public.protect_org_billing_fields();

-- Une organisation doit toujours garder au moins un propriétaire.
create or replace function public.ensure_owner_remains()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org uuid := coalesce(old.organization_id, new.organization_id);
begin
  if not exists (select 1 from public.organizations where id = org) then
    return null; -- suppression en cascade de l'organisation
  end if;
  if not exists (
    select 1 from public.memberships where organization_id = org and role = 'owner'
  ) then
    raise exception 'Une association doit conserver au moins un propriétaire';
  end if;
  return null;
end;
$$;

create constraint trigger memberships_owner_guard
  after update or delete on public.memberships
  deferrable initially deferred
  for each row execute function public.ensure_owner_remains();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;

-- Profils : soi-même et les co-membres d'une même association
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.memberships a
      join public.memberships b on a.organization_id = b.organization_id
      where a.user_id = auth.uid() and b.user_id = profiles.id
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy platform_admins_self on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

-- Organisations : créées uniquement via la fonction create_organization()
create policy organizations_select on public.organizations for select to authenticated
  using (public.is_org_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (public.can_admin_org(id)) with check (public.can_admin_org(id));
create policy organizations_delete on public.organizations for delete to authenticated
  using (public.has_org_role(id, array['owner']::public.org_role[]));

create policy memberships_select on public.memberships for select to authenticated
  using (public.is_org_member(organization_id));
create policy memberships_update on public.memberships for update to authenticated
  using (public.can_admin_org(organization_id))
  with check (
    public.can_admin_org(organization_id)
    and (role <> 'owner' or public.has_org_role(organization_id, array['owner']::public.org_role[]))
  );
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.can_admin_org(organization_id) or user_id = auth.uid());

create policy invitations_select on public.invitations for select to authenticated
  using (public.can_admin_org(organization_id));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (public.can_admin_org(organization_id));
create policy invitations_delete on public.invitations for delete to authenticated
  using (public.can_admin_org(organization_id));

grant usage on schema public to authenticated, anon;
grant select, update on public.profiles to authenticated;
grant select on public.platform_admins to authenticated;
grant select, update, delete on public.organizations to authenticated;
grant select, update, delete on public.memberships to authenticated;
grant select, insert, delete on public.invitations to authenticated;

-- Acceptation d'une invitation (le jeton fait foi, l'e-mail doit correspondre)
create or replace function public.accept_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations;
  user_email text;
begin
  select email into user_email from auth.users where id = auth.uid();
  if user_email is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  select * into inv from public.invitations
  where token = invite_token and accepted_at is null and expires_at > now()
  for update;

  if inv.id is null then
    raise exception 'Invitation invalide ou expirée';
  end if;
  if lower(inv.email) <> lower(user_email) then
    raise exception 'Cette invitation est destinée à une autre adresse e-mail';
  end if;

  insert into public.memberships (organization_id, user_id, role)
  values (inv.organization_id, auth.uid(), inv.role)
  on conflict (organization_id, user_id) do update set role = excluded.role;

  update public.invitations set accepted_at = now() where id = inv.id;
  return inv.organization_id;
end;
$$;

grant execute on function public.accept_invitation(text) to authenticated;

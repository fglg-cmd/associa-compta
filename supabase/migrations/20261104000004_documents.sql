-- =============================================================================
-- ASSOCIA COMPTA — 0004 : Gestion documentaire (justificatifs, OCR, recherche)
-- =============================================================================
-- Fichiers stockés dans Supabase Storage, bucket privé « documents »,
-- chemin : {organization_id}/{document_id}/{nom_de_fichier}
-- =============================================================================

create type public.ocr_status as enum ('pending', 'processing', 'done', 'failed', 'skipped');

create text search configuration public.fr_unaccent (copy = pg_catalog.french);
alter text search configuration public.fr_unaccent
  alter mapping for hword, hword_part, word with extensions.unaccent, french_stem;

create table public.documents (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  name                 text not null,
  storage_path         text not null unique,
  mime_type            text not null,
  size_bytes           bigint not null check (size_bytes > 0 and size_bytes <= 26214400), -- 25 Mo
  folder               text not null default 'Justificatifs',
  tags                 text[] not null default '{}',
  ocr_status           public.ocr_status not null default 'pending',
  ocr_text             text,
  extracted_amount     bigint,
  extracted_date       date,
  extracted_vendor     text,
  entry_id             uuid references public.journal_entries (id) on delete set null,
  bank_transaction_id  uuid references public.bank_transactions (id) on delete set null,
  uploaded_by          uuid references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  search               tsvector generated always as (
    setweight(to_tsvector('public.fr_unaccent', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('public.fr_unaccent', coalesce(extracted_vendor, '')), 'A') ||
    setweight(to_tsvector('public.fr_unaccent', coalesce(folder, '')), 'B') ||
    setweight(to_tsvector('public.fr_unaccent', coalesce(ocr_text, '')), 'C')
  ) stored
);
create index documents_org_idx on public.documents (organization_id, created_at desc);
create index documents_search_idx on public.documents using gin (search);
create index documents_tx_idx on public.documents (bank_transaction_id) where bank_transaction_id is not null;
create index documents_entry_idx on public.documents (entry_id) where entry_id is not null;

create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();

-- Recherche plein texte (français, insensible aux accents), avec repli préfixe.
create or replace function public.search_documents(p_org uuid, p_query text, p_limit integer default 50)
returns setof public.documents
language sql
stable
security invoker
set search_path = public
as $$
  select d.* from public.documents d
  where d.organization_id = p_org
    and (
      d.search @@ websearch_to_tsquery('public.fr_unaccent', p_query)
      or extensions.unaccent(lower(d.name)) like '%' || extensions.unaccent(lower(p_query)) || '%'
    )
  order by ts_rank(d.search, websearch_to_tsquery('public.fr_unaccent', p_query)) desc, d.created_at desc
  limit least(greatest(p_limit, 1), 200);
$$;

alter table public.documents enable row level security;

create policy documents_select on public.documents for select to authenticated
  using (public.is_org_member(organization_id));
create policy documents_insert on public.documents for insert to authenticated
  with check (public.can_write_finance(organization_id) and storage_path like organization_id::text || '/%');
create policy documents_update on public.documents for update to authenticated
  using (public.can_write_finance(organization_id)) with check (public.can_write_finance(organization_id));
create policy documents_delete on public.documents for delete to authenticated
  using (public.can_write_finance(organization_id));

grant select, insert, update, delete on public.documents to authenticated;
grant execute on function public.search_documents(uuid, text, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage : bucket privé, accès par préfixe d'organisation
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_org_member(((storage.foldername(name))[1])::uuid));
create policy "documents_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.can_write_finance(((storage.foldername(name))[1])::uuid));
create policy "documents_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.can_write_finance(((storage.foldername(name))[1])::uuid));

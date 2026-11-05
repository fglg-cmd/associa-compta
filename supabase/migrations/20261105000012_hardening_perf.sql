-- =============================================================================
-- ASSOCIA COMPTA — 0012 : Durcissement du stockage et performances (audit)
-- =============================================================================

-- 1. Stockage : 25 Mo maximum, uniquement PDF, images, Word et Excel.
--    (Sans cela, l'API de stockage acceptait n'importe quel fichier de n'importe quelle taille.)
update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
      'application/vnd.oasis.opendocument.spreadsheet'
    ]
where id = 'documents';

-- 2. Index sur toutes les clés étrangères qui n'en ont pas (jointures, suppressions en cascade).
do $$
declare r record; idx text;
begin
  for r in
    select c.conrelid::regclass as tbl, c.conname, c.conrelid, c.conkey,
           (select string_agg(quote_ident(a.attname), ', ' order by k.ord)
              from unnest(c.conkey) with ordinality k(attnum, ord)
              join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols
    from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public' and c.contype = 'f'
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid
          and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] = c.conkey
      )
  loop
    idx := left(replace(r.conname, '_fkey', '') || '_fk_idx', 63);
    execute format('create index if not exists %I on %s (%s)', idx, r.tbl, r.cols);
  end loop;
end $$;

-- 3. auth.uid() évalué une seule fois par requête, et non pour chaque ligne.
drop policy profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.memberships a
      join public.memberships b on a.organization_id = b.organization_id
      where a.user_id = (select auth.uid()) and b.user_id = profiles.id
    )
  );
drop policy profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
drop policy platform_admins_self on public.platform_admins;
create policy platform_admins_self on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));
drop policy memberships_delete on public.memberships;
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.can_admin_org(organization_id) or user_id = (select auth.uid()));
drop policy ai_conv_own on public.ai_conversations;
create policy ai_conv_own on public.ai_conversations for all to authenticated
  using (user_id = (select auth.uid()) and public.is_org_member(organization_id))
  with check (user_id = (select auth.uid()) and public.is_org_member(organization_id));
drop policy ai_msg_own on public.ai_messages;
create policy ai_msg_own on public.ai_messages for all to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid())))
  with check (
    public.is_org_member(organization_id)
    and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = (select auth.uid()) and c.organization_id = ai_messages.organization_id)
  );
drop policy tickets_own_select on public.support_tickets;
create policy tickets_own_select on public.support_tickets for select to authenticated using (user_id = (select auth.uid()));
drop policy tickets_own_insert on public.support_tickets;
create policy tickets_own_insert on public.support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()) and (organization_id is null or public.is_org_member(organization_id)) and status = 'open' and admin_reply is null);

-- 4. Une seule politique par action (les politiques « for all » doublaient la lecture).
do $$
declare t record;
begin
  for t in select * from (values
    ('categorization_rules', 'rules_write'), ('fee_types', 'fee_types_write'), ('members', 'members_write'),
    ('projects', 'projects_write'), ('project_budget_lines', 'pbl_write')) v(tbl, pol)
  loop
    execute format('drop policy %I on public.%I', t.pol, t.tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write_finance(organization_id))', t.tbl || '_insert', t.tbl);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_write_finance(organization_id)) with check (public.can_write_finance(organization_id))', t.tbl || '_update', t.tbl);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_write_finance(organization_id))', t.tbl || '_delete', t.tbl);
  end loop;
end $$;

-- Lignes budgétaires : le projet doit appartenir à la même association (contrôle conservé).
drop policy project_budget_lines_insert on public.project_budget_lines;
create policy project_budget_lines_insert on public.project_budget_lines for insert to authenticated
  with check (public.can_write_finance(organization_id)
    and exists (select 1 from public.projects p where p.id = project_id and p.organization_id = project_budget_lines.organization_id));
drop policy project_budget_lines_update on public.project_budget_lines;
create policy project_budget_lines_update on public.project_budget_lines for update to authenticated
  using (public.can_write_finance(organization_id))
  with check (public.can_write_finance(organization_id)
    and exists (select 1 from public.projects p where p.id = project_id and p.organization_id = project_budget_lines.organization_id));

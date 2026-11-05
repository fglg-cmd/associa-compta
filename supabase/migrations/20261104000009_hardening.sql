-- =============================================================================
-- ASSOCIA COMPTA — 0009 : Durcissement des privilèges (production Supabase)
-- =============================================================================
-- 1. search_path figé sur toutes les fonctions (évite le détournement par schéma).
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('alter function %s set search_path = public, extensions', f.sig);
  end loop;
end $$;

-- 2. Par défaut PostgreSQL accorde EXECUTE à PUBLIC : on le retire, puis on
--    n'ouvre que l'API nécessaire aux utilisateurs connectés.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to service_role;

grant execute on function
  public.is_org_member(uuid),
  public.has_org_role(uuid, public.org_role[]),
  public.can_write_finance(uuid),
  public.can_admin_org(uuid),
  public.is_platform_admin(),
  public.assert_finance_writer(uuid),
  public.accept_invitation(text),
  public.create_organization(text, text, date, date, jsonb),
  public.open_next_fiscal_year(uuid),
  public.create_journal_entry(uuid, uuid, date, text, jsonb, text, boolean, public.entry_source, uuid),
  public.post_journal_entry(uuid),
  public.delete_draft_entry(uuid),
  public.reverse_journal_entry(uuid, date),
  public.close_fiscal_year(uuid),
  public.trial_balance(uuid, date, date),
  public.account_balance(uuid, date),
  public.monthly_flows(uuid, date, date),
  public.create_bank_account(uuid, text, text, text, bigint, date),
  public.book_bank_transaction(uuid, uuid, text, uuid),
  public.book_bank_transactions(jsonb),
  public.match_bank_transaction(uuid, uuid),
  public.unbook_bank_transaction(uuid),
  public.bank_reconciliation(uuid, date),
  public.search_documents(uuid, text, integer),
  public.record_fee_payment(uuid, date, bigint, public.payment_method, uuid, uuid),
  public.issue_fees(uuid, uuid, text, date, date, date),
  public.project_financials(uuid),
  public.admin_platform_stats()
to authenticated;

-- 3. Rôle serveur (webhooks Stripe, cron, back-office) : accès complet explicite.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- 4. Sonde de santé anonyme : lecture autorisée, mais la RLS ne renvoie aucune ligne.
grant select on public.organizations to anon;

-- 5. Les nouvelles fonctions ne sont plus exécutables par anon par défaut.
alter default privileges in schema public revoke execute on functions from public, anon;

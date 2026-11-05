-- =============================================================================
-- ASSOCIA COMPTA — 0010 : Fonctions internes non appelables via l'API
-- =============================================================================
-- Supabase accorde EXECUTE explicitement au rôle authenticated sur toute
-- nouvelle fonction. On le retire partout, puis on ne rouvre que l'API métier.
revoke execute on all functions in schema public from authenticated;

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

alter default privileges in schema public revoke execute on functions from authenticated;

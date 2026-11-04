/**
 * Types des lignes de la base (miroir de supabase/migrations).
 * À régénérer automatiquement via `supabase gen types typescript` en CI.
 */
export type OrgRole = "owner" | "admin" | "treasurer" | "member" | "viewer";
export type PlanTier = "free" | "essential" | "pro";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  legal_form: string;
  siren: string | null;
  rna: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  email: string | null;
  fiscal_year_start_month: number;
  currency: string;
  plan: PlanTier;
  stripe_customer_id: string | null;
  created_at: string;
}

export interface FiscalYear {
  id: string;
  organization_id: string;
  label: string;
  start_date: string;
  end_date: string;
  status: "open" | "closed";
  closed_at: string | null;
}

export type AccountKind = "equity" | "fixed_asset" | "stock" | "third_party" | "financial" | "expense" | "income" | "special";

export interface Account {
  id: string;
  organization_id: string;
  number: string;
  label: string;
  class: number;
  kind: AccountKind;
  is_active: boolean;
  is_system: boolean;
}

export interface Journal {
  id: string;
  code: string;
  label: string;
  type: "bank" | "cash" | "sales" | "purchases" | "misc" | "opening";
}

export interface JournalEntry {
  id: string;
  organization_id: string;
  fiscal_year_id: string;
  journal_id: string;
  entry_number: number | null;
  date: string;
  label: string;
  reference: string | null;
  status: "draft" | "posted";
  source: "manual" | "bank" | "member_fee" | "opening" | "closing" | "reversal" | "import";
  reversal_of: string | null;
  project_id: string | null;
  created_at: string;
}

export interface EntryLine {
  id: string;
  entry_id: string;
  line_no: number;
  account_id: string;
  label: string | null;
  debit: number;
  credit: number;
  project_id: string | null;
}

export interface BankAccount {
  id: string;
  organization_id: string;
  name: string;
  bank_name: string | null;
  iban_last4: string | null;
  account_id: string;
  journal_id: string;
  opening_balance: number;
  opening_date: string;
  is_archived: boolean;
}

export type BankTxStatus = "pending" | "booked" | "matched" | "ignored";

export interface BankTransaction {
  id: string;
  organization_id: string;
  bank_account_id: string;
  import_id: string | null;
  date: string;
  value_date: string | null;
  label: string;
  raw_label: string | null;
  counterparty: string | null;
  amount: number;
  fingerprint: string;
  status: BankTxStatus;
  suggested_account_id: string | null;
  suggested_rule_id: string | null;
  suggested_project_id: string | null;
  entry_id: string | null;
  created_at: string;
}

export interface CategorizationRule {
  id: string;
  organization_id: string;
  name: string;
  match_type: "contains" | "starts_with" | "equals" | "regex";
  pattern: string;
  direction: "any" | "in" | "out";
  min_amount: number | null;
  max_amount: number | null;
  account_id: string;
  project_id: string | null;
  priority: number;
  hits: number;
  is_active: boolean;
}

export interface DocumentRow {
  id: string;
  organization_id: string;
  name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  folder: string;
  tags: string[];
  ocr_status: "pending" | "processing" | "done" | "failed" | "skipped";
  ocr_text: string | null;
  extracted_amount: number | null;
  extracted_date: string | null;
  extracted_vendor: string | null;
  entry_id: string | null;
  bank_transaction_id: string | null;
  created_at: string;
}

export interface Member {
  id: string;
  organization_id: string;
  member_number: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  birth_date: string | null;
  status: "active" | "inactive" | "pending";
  joined_at: string;
  notes: string | null;
}

export interface FeeType {
  id: string;
  label: string;
  amount: number;
  account_id: string;
  is_active: boolean;
}

export interface MemberFee {
  id: string;
  organization_id: string;
  member_id: string;
  fee_type_id: string | null;
  label: string;
  period_start: string;
  period_end: string;
  amount_due: number;
  amount_paid: number;
  status: "due" | "partial" | "paid" | "cancelled";
  due_date: string;
}

export interface FeePayment {
  id: string;
  member_fee_id: string;
  date: string;
  amount: number;
  method: "cash" | "cheque" | "transfer" | "card" | "other";
  entry_id: string | null;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  kind: "project" | "event";
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: "planned" | "active" | "closed";
  color: string;
}

export interface ProjectBudgetLine {
  id: string;
  project_id: string;
  label: string;
  direction: "income" | "expense";
  account_id: string | null;
  amount: number;
}

export interface TrialBalanceRow {
  account_id: string;
  number: string;
  label: string;
  kind: AccountKind;
  debit: number;
  credit: number;
}

import { supabase } from "@/integrations/supabase/client";

/** Shared lightweight data-access helpers. All access is enforced server-side by
 *  row-level security and permission checks in the database. */

export type CountryRecord = {
  id: string;
  code: string;
  name: string;
  display_name: string;
  active: boolean;
  created_at: string;
};

export type TrainingModule = {
  id: string;
  module_number: number;
  title: string;
  description: string | null;
  pass_mark: number;
  max_attempts: number;
  is_mandatory: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type TrainingProgress = {
  id: string;
  user_id: string;
  module_id: string;
  status: string;
  score: number | null;
  attempts: number;
  completed_at: string | null;
  certificate_issued_at: string | null;
  created_at: string;
  updated_at: string;
  training_modules?: {
    module_number: number;
    title: string;
    pass_mark: number;
    max_attempts: number;
  } | null;
};

export type TrainingAssessment = {
  id: string;
  user_id: string;
  module_id: string;
  score: number;
  passed: boolean;
  attempt_number: number;
  submitted_at: string;
  training_modules?: { module_number: number; title: string } | null;
};

export type EmailRequestRecord = {
  id: string;
  user_id: string;
  country_id: string | null;
  current_email: string | null;
  requested_prefix: string;
  display_name: string;
  role: string;
  business_justification: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_note: string | null;
  provisioned_email: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { id: string; full_name: string; email: string } | null;
  countries?: { display_name: string } | null;
};

export type CommissionRecord = {
  id: string;
  user_id: string;
  agreement_version: string;
  transaction_reference: string;
  contribution: string;
  calculated_amount: number | null;
  currency: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  paid_by: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
};

export async function listStaff() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, job_title, active")
    .order("full_name");
  if (error) throw error;
  return data;
}

export async function listPropertyOptions() {
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, status")
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data;
}

// TASKS
export async function listTasks(filters?: { status?: string; assigned_to?: string; due_before?: string }) {
  let query = supabase.from("tasks").select("*").is("deleted_at", null).order("due_date", { ascending: true });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.assigned_to) query = query.eq("assigned_to", filters.assigned_to);
  if (filters?.due_before) query = query.lte("due_date", filters.due_before);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getTask(id: string) {
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listTaskComments(taskId: string) {
  const { data, error } = await supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at");
  if (error) throw error;
  return data;
}

// CORRESPONDENCE
export async function listCorrespondence(filters?: { assigned_to?: string; status?: string; module?: string; record_id?: string }) {
  let query = supabase.from("correspondence").select("*").is("deleted_at", null).order("date", { ascending: false });
  if (filters?.assigned_to) query = query.eq("assigned_to", filters.assigned_to);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.module && filters?.record_id) {
    query = query.eq(`related_${filters.module}_id` as any, filters.record_id);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// ESCALATIONS
export async function listEscalations(filters?: { status?: string; assigned_to?: string; module?: string; record_id?: string }) {
  let query = supabase.from("escalations").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.assigned_to) query = query.eq("assigned_to", filters.assigned_to);
  if (filters?.module) query = query.eq("related_module", filters.module);
  if (filters?.record_id) query = query.eq("related_record_id", filters.record_id);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// KNOWLEDGE GUIDE
export async function listKnowledgeGuide(category?: string) {
  let query = supabase.from("knowledge_guide").select("*").eq("is_active", true).order("sort_order");
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// WORK LOG, RATE CARD & WALLET
export async function listRateCard(activeOnly = true) {
  let query = supabase.from("rate_card").select("*").order("sort_order");
  if (activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listWorkLog(filters?: { staff_id?: string; status?: string; from?: string; to?: string }) {
  let query = supabase
    .from("work_log_entries")
    .select("*, rate_card(code, name, section, unit_label, bonus_condition)")
    .is("deleted_at", null)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (filters?.staff_id) query = query.eq("staff_id", filters.staff_id);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.from) query = query.gte("entry_date", filters.from);
  if (filters?.to) query = query.lte("entry_date", filters.to);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listWalletSummary(staffId?: string) {
  let query = supabase.from("staff_wallet_summary").select("*").order("balance_kes", { ascending: false });
  if (staffId) query = query.eq("staff_id", staffId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listWalletPayments(staffId?: string) {
  let query = supabase.from("wallet_payments").select("*").order("paid_at", { ascending: false });
  if (staffId) query = query.eq("staff_id", staffId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function logAudit(entry: {
  action: string;
  module: string;
  record_id?: string;
  record_label?: string;
  field?: string;
  previous_value?: string;
  new_value?: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("audit_logs").insert({ ...entry, user_id: auth.user.id });
}

export async function notify(entry: {
  recipient_id: string;
  type: string;
  title: string;
  body?: string;
  module?: string;
  record_id?: string;
}) {
  await supabase.from("notifications").insert(entry);
}

export function staffName(
  staff: { id: string; full_name: string; email: string }[] | undefined,
  id: string | null | undefined,
) {
  if (!id) return "Unassigned";
  const person = staff?.find((s) => s.id === id);
  return person ? person.full_name || person.email : "—";
}

// The JCA onboarding/training tables are introduced by migration
// 20260922000001 and are not yet present in the generated Database types.
// `newTables` gives a loosely typed client for them so the queries compile;
// runtime access is still fully constrained by row-level security.
export const newTables = supabase as any;

// Stored procedures added by the onboarding migrations are likewise missing
// from the generated types. `callRpc` keeps call sites free of `any` casts.
export type RpcError = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

export const callRpc = (supabase.rpc as unknown as (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: RpcError | null }>).bind(supabase);

/**
 * Turns a PostgREST/RPC error into a message that can be shown to the user.
 * The database error is preserved rather than replaced by a generic string,
 * because the detail is what makes a failure diagnosable.
 */
export function rpcErrorMessage(
  error: RpcError | null | undefined,
  fallback: string,
): string {
  if (!error) return fallback;
  const parts = [error.message, error.hint, error.details].filter(
    (p): p is string => !!p && p.trim().length > 0,
  );
  const unique = Array.from(new Set(parts));
  return unique.length > 0 ? unique.join(" — ") : fallback;
}

export async function listCountries() {
  const { data, error } = await newTables
    .from("countries")
    .select("id, code, name, display_name, active, created_at")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data as CountryRecord[];
}

export async function listTrainingModules() {
  const { data, error } = await newTables
    .from("training_modules")
    .select("*")
    .eq("is_active", true)
    .order("module_number");
  if (error) throw error;
  return data as TrainingModule[];
}

export async function listTrainingProgress(userId?: string) {
  let query = newTables
    .from("training_progress")
    .select("*, training_modules(module_number, title, pass_mark, max_attempts)")
    .order("created_at", { ascending: true });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return data as TrainingProgress[];
}

export async function listTrainingAssessments(userId?: string) {
  let query = newTables
    .from("training_assessments")
    .select("*, training_modules(module_number, title)")
    .order("submitted_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return data as TrainingAssessment[];
}

export async function listEmailRequests() {
  // `email_requests` has no foreign key to `public.profiles`, so the profile
  // cannot be embedded by PostgREST. Names are resolved client-side from the
  // staff list instead.
  const { data, error } = await newTables
    .from("email_requests")
    .select("*, countries(display_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as EmailRequestRecord[];
}

export async function listCommissionRecords(userId?: string) {
  let query = newTables.from("commission_records").select("*").order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return data as CommissionRecord[];
}

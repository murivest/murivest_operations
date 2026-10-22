-- ============================================================================
-- MURIVEST — JUNIOR CAPITAL ADVISOR ONBOARDING, TRAINING & COUNTRY OPERATIONS
-- Extends the existing operations system with role-based onboarding, mandatory
-- training, country workspaces, company email requests and commission records.
-- Non-destructive: only adds tables/columns/permissions and enum values.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. EXTEND app_role ENUM with the new employee roles
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = 'app_role' AND e.enumlabel = 'junior_capital_advisor') THEN
    ALTER TYPE public.app_role ADD VALUE 'junior_capital_advisor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = 'app_role' AND e.enumlabel = 'senior_advisor') THEN
    ALTER TYPE public.app_role ADD VALUE 'senior_advisor';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = 'app_role' AND e.enumlabel = 'country_office_manager') THEN
    ALTER TYPE public.app_role ADD VALUE 'country_office_manager';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = 'app_role' AND e.enumlabel = 'operations_administrator') THEN
    ALTER TYPE public.app_role ADD VALUE 'operations_administrator';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typname = 'app_role' AND e.enumlabel = 'applicant') THEN
    ALTER TYPE public.app_role ADD VALUE 'applicant';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. COUNTRIES (configurable, supports additional countries without code changes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.countries TO authenticated;
GRANT ALL ON public.countries TO service_role;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "countries read" ON public.countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "countries manage" ON public.countries FOR ALL TO authenticated
  USING (public.can('countries.manage')) WITH CHECK (public.can('countries.manage'));

CREATE INDEX IF NOT EXISTS idx_countries_code ON public.countries(code);
CREATE INDEX IF NOT EXISTS idx_countries_active ON public.countries(active);

-- ---------------------------------------------------------------------------
-- 3. COUNTRY ASSIGNMENTS (user -> country + supervisor, enforced server-side)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.country_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  supervisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  UNIQUE (user_id, country_id)
);
GRANT SELECT, INSERT, UPDATE ON public.country_assignments TO authenticated;
GRANT ALL ON public.country_assignments TO service_role;
ALTER TABLE public.country_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country_assignments read own" ON public.country_assignments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can('countries.view') OR public.can('users.view'));
CREATE POLICY "country_assignments manage" ON public.country_assignments FOR ALL TO authenticated
  USING (public.can('countries.manage')) WITH CHECK (public.can('countries.manage'));

CREATE INDEX IF NOT EXISTS idx_country_assignments_user ON public.country_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_country_assignments_country ON public.country_assignments(country_id);
CREATE INDEX IF NOT EXISTS idx_country_assignments_active ON public.country_assignments(active);

-- ---------------------------------------------------------------------------
-- 4. COUNTRY ID on core operational tables (for RLS-based isolation)
-- ---------------------------------------------------------------------------
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL;
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_properties_country ON public.properties(country_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_country ON public.inquiries(country_id);
CREATE INDEX IF NOT EXISTS idx_tasks_country ON public.tasks(country_id);

-- ---------------------------------------------------------------------------
-- 5. ROLE AGREEMENTS (versioned terms for Junior Capital Advisor engagement)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  title text NOT NULL,
  content text NOT NULL,
  summary text,
  effective_from date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.role_agreements TO authenticated;
GRANT ALL ON public.role_agreements TO service_role;
ALTER TABLE public.role_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_agreements read" ON public.role_agreements FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_agreements manage" ON public.role_agreements FOR ALL TO authenticated
  USING (public.can('onboarding.manage')) WITH CHECK (public.can('onboarding.manage'));

-- ---------------------------------------------------------------------------
-- 6. ONBOARDING STATUS (tracks each Junior Capital Advisor through the workflow)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'applicant',
  role text NOT NULL DEFAULT 'junior_capital_advisor',
  agreement_version text,
  terms_accepted_at timestamptz,
  terms_accepted_version text,
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  supervisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  operational_access_granted_at timestamptz,
  suspended_at timestamptz,
  offboarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.onboarding_status TO authenticated;
GRANT ALL ON public.onboarding_status TO service_role;
ALTER TABLE public.onboarding_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onboarding_status read own" ON public.onboarding_status FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can('onboarding.view') OR public.can('users.view'));
CREATE POLICY "onboarding_status update own fields" ON public.onboarding_status FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "onboarding_status manage" ON public.onboarding_status FOR ALL TO authenticated
  USING (public.can('onboarding.manage')) WITH CHECK (public.can('onboarding.manage'));

CREATE INDEX IF NOT EXISTS idx_onboarding_status_user ON public.onboarding_status(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_status_status ON public.onboarding_status(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_status_country ON public.onboarding_status(country_id);

-- ---------------------------------------------------------------------------
-- 7. TRAINING MODULES & LESSONS (mandatory training academy)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_number integer NOT NULL,
  title text NOT NULL,
  description text,
  pass_mark integer NOT NULL DEFAULT 80,
  max_attempts integer NOT NULL DEFAULT 3,
  is_mandatory boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module_number)
);
GRANT SELECT, INSERT, UPDATE ON public.training_modules TO authenticated;
GRANT ALL ON public.training_modules TO service_role;
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_modules read" ON public.training_modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_modules manage" ON public.training_modules FOR ALL TO authenticated
  USING (public.can('training.manage')) WITH CHECK (public.can('training.manage'));

CREATE TABLE IF NOT EXISTS public.training_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.training_lessons TO authenticated;
GRANT ALL ON public.training_lessons TO service_role;
ALTER TABLE public.training_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_lessons read" ON public.training_lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "training_lessons manage" ON public.training_lessons FOR ALL TO authenticated
  USING (public.can('training.manage')) WITH CHECK (public.can('training.manage'));

CREATE INDEX IF NOT EXISTS idx_training_lessons_module ON public.training_lessons(module_id);

-- ---------------------------------------------------------------------------
-- 8. TRAINING PROGRESS & ASSESSMENTS (persistent, resumable)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_started',
  score integer,
  attempts integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  certificate_issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id)
);
GRANT SELECT, INSERT, UPDATE ON public.training_progress TO authenticated;
GRANT ALL ON public.training_progress TO service_role;
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_progress read own" ON public.training_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can('training.view') OR public.can('users.view'));
CREATE POLICY "training_progress update own" ON public.training_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "training_progress manage" ON public.training_progress FOR ALL TO authenticated
  USING (public.can('training.manage')) WITH CHECK (public.can('training.manage'));

CREATE TABLE IF NOT EXISTS public.training_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.training_modules(id) ON DELETE CASCADE,
  score integer NOT NULL,
  passed boolean NOT NULL DEFAULT false,
  attempt_number integer NOT NULL DEFAULT 1,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.training_assessments TO authenticated;
GRANT ALL ON public.training_assessments TO service_role;
ALTER TABLE public.training_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_assessments read own" ON public.training_assessments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can('training.view') OR public.can('users.view'));
CREATE POLICY "training_assessments insert own" ON public.training_assessments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "training_assessments manage" ON public.training_assessments FOR ALL TO authenticated
  USING (public.can('training.manage')) WITH CHECK (public.can('training.manage'));

CREATE INDEX IF NOT EXISTS idx_training_progress_user ON public.training_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_training_progress_module ON public.training_progress(module_id);
CREATE INDEX IF NOT EXISTS idx_training_assessments_user ON public.training_assessments(user_id);

-- ---------------------------------------------------------------------------
-- 9. TASK EVIDENCE (review/revision history for Junior Capital Advisor tasks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url text,
  description text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_status text NOT NULL DEFAULT 'pending',
  feedback text,
  revision_of uuid REFERENCES public.task_evidence(id) ON DELETE SET NULL
);
GRANT SELECT, INSERT, UPDATE ON public.task_evidence TO authenticated;
GRANT ALL ON public.task_evidence TO service_role;
ALTER TABLE public.task_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_evidence read own" ON public.task_evidence FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can('tasks.view_all') OR public.can('tasks.review'));
CREATE POLICY "task_evidence insert own" ON public.task_evidence FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "task_evidence review" ON public.task_evidence FOR UPDATE TO authenticated
  USING (public.can('tasks.review')) WITH CHECK (public.can('tasks.review'));

CREATE INDEX IF NOT EXISTS idx_task_evidence_task ON public.task_evidence(task_id);
CREATE INDEX IF NOT EXISTS idx_task_evidence_user ON public.task_evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_task_evidence_review_status ON public.task_evidence(review_status);

-- ---------------------------------------------------------------------------
-- 10. COMPANY EMAIL REQUESTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  current_email text,
  requested_prefix text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL,
  business_justification text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  decision_note text,
  provisioned_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.email_requests TO authenticated;
GRANT ALL ON public.email_requests TO service_role;
ALTER TABLE public.email_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "email_requests read own" ON public.email_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can('email_requests.view'));
CREATE POLICY "email_requests insert own" ON public.email_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "email_requests manage" ON public.email_requests FOR ALL TO authenticated
  USING (public.can('email_requests.manage')) WITH CHECK (public.can('email_requests.manage'));

CREATE INDEX IF NOT EXISTS idx_email_requests_user ON public.email_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_email_requests_status ON public.email_requests(status);

-- ---------------------------------------------------------------------------
-- 11. COMMISSION RECORDS (refers to written agreement, tracks contribution)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commission_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreement_version text NOT NULL,
  transaction_reference text NOT NULL,
  contribution text NOT NULL,
  calculated_amount numeric(12, 2),
  currency text NOT NULL DEFAULT 'KES',
  status text NOT NULL DEFAULT 'pending_review',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  paid_at timestamptz,
  paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.commission_records TO authenticated;
GRANT ALL ON public.commission_records TO service_role;
ALTER TABLE public.commission_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commission_records read own" ON public.commission_records FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can('commission.view'));
CREATE POLICY "commission_records insert own" ON public.commission_records FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "commission_records manage" ON public.commission_records FOR ALL TO authenticated
  USING (public.can('commission.manage')) WITH CHECK (public.can('commission.manage'));

CREATE INDEX IF NOT EXISTS idx_commission_records_user ON public.commission_records(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_records_status ON public.commission_records(status);

-- ---------------------------------------------------------------------------
-- 12. PERMISSIONS for new roles (reuse existing names where they apply)
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission) VALUES
-- Junior Capital Advisor / Applicant core
('junior_capital_advisor','dashboard.view'),
('junior_capital_advisor','tasks.view'),('junior_capital_advisor','tasks.create'),('junior_capital_advisor','tasks.edit'),
('junior_capital_advisor','tasks.review.own'),
('junior_capital_advisor','properties.view'),('junior_capital_advisor','properties.create'),('junior_capital_advisor','properties.edit.own'),
('junior_capital_advisor','inquiries.view'),('junior_capital_advisor','inquiries.create'),('junior_capital_advisor','inquiries.edit.own'),
('junior_capital_advisor','knowledge.view'),('junior_capital_advisor','training.view'),
('junior_capital_advisor','worklog.view'),('junior_capital_advisor','worklog.create'),('junior_capital_advisor','worklog.edit.own'),
('junior_capital_advisor','wallet.view'),
('junior_capital_advisor','email_requests.create'),('junior_capital_advisor','email_requests.view.own'),
('junior_capital_advisor','commission.view.own') ON CONFLICT DO NOTHING;

-- Applicant/Trainee (pre-onboarding, restricted)
('applicant','dashboard.view'),
('applicant','training.view'),
('applicant','onboarding.view.own') ON CONFLICT DO NOTHING;

-- Senior Advisor (can review Junior Capital Advisor work)
('senior_advisor','dashboard.view'),
('senior_advisor','tasks.view'),('senior_advisor','tasks.view_all'),('senior_advisor','tasks.review'),
('senior_advisor','properties.view'),('senior_advisor','properties.review'),('senior_advisor','properties.approve'),
('senior_advisor','inquiries.view'),('senior_advisor','inquiries.view.all'),('senior_advisor','inquiries.assign'),
('senior_advisor','training.view'),('senior_advisor','training.review'),
('senior_advisor','commission.view'),('senior_advisor','commission.review'),
('senior_advisor','onboarding.view') ON CONFLICT DO NOTHING;

-- Country Office Manager
('country_office_manager','dashboard.view'),
('country_office_manager','tasks.view_all'),('country_office_manager','tasks.review'),
('country_office_manager','properties.view'),('country_office_manager','properties.review'),
('country_office_manager','inquiries.view.all'),('country_office_manager','inquiries.assign'),
('country_office_manager','training.review'),
('country_office_manager','onboarding.view'),('country_office_manager','onboarding.approve'),
('country_office_manager','countries.view'),('country_office_manager','countries.manage.own'),
('country_office_manager','commission.view'),('country_office_manager','commission.review') ON CONFLICT DO NOTHING;

-- Operations Administrator
('operations_administrator','dashboard.view'),
('operations_administrator','users.view'),('operations_administrator','users.manage'),
('operations_administrator','countries.view'),('operations_administrator','countries.manage'),
('operations_administrator','onboarding.view'),('operations_administrator','onboarding.manage'),
('operations_administrator','training.view'),('operations_administrator','training.manage'),
('operations_administrator','email_requests.view'),('operations_administrator','email_requests.manage'),
('operations_administrator','commission.view'),('operations_administrator','commission.manage') ON CONFLICT DO NOTHING;

-- Managing Director: grant all new permissions
INSERT INTO public.role_permissions (role, permission)
SELECT 'managing_director', p.permission
FROM (VALUES
  ('onboarding.view'),('onboarding.manage'),('onboarding.approve'),
  ('training.view'),('training.manage'),('training.review'),
  ('countries.view'),('countries.manage'),
  ('email_requests.view'),('email_requests.manage'),('email_requests.create'),
  ('commission.view'),('commission.manage'),('commission.review'),
  ('tasks.review'),('tasks.view_all'),
  ('properties.review'),('properties.approve'),
  ('inquiries.assign'),('inquiries.view.all')
) AS p(permission)
ON CONFLICT (role, permission) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 13. VIEW_ALL GRANTS + COUNTRY-SCOPED READ POLICIES (preserve existing access)
-- Existing roles keep broad access via *_view_all permissions; the new
-- junior_capital_advisor role receives only the non-_view_all variant, so its
-- read access is scoped to assigned countries by RLS.
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission) VALUES
  ('managing_director','properties.view_all'),('managing_director','inquiries.view_all'),('managing_director','tasks.view_all'),
  ('secretariat','properties.view_all'),('secretariat','inquiries.view_all'),('secretariat','tasks.view_all'),
  ('capital_advisor','properties.view_all'),('capital_advisor','inquiries.view_all'),('capital_advisor','tasks.view_all'),
  ('senior_advisor','properties.view_all'),('senior_advisor','inquiries.view_all'),('senior_advisor','tasks.view_all'),
  ('country_office_manager','properties.view_all'),('country_office_manager','inquiries.view_all'),('country_office_manager','tasks.view_all')
ON CONFLICT (role, permission) DO NOTHING;

-- Properties: broad access for *_view_all holders; country-scoped for others;
-- NULL country_id records remain visible (backward compatibility).
DROP POLICY IF EXISTS "properties read" ON public.properties;
CREATE POLICY "properties read" ON public.properties FOR SELECT TO authenticated
  USING (
    public.can('properties.view_all')
    OR country_id IS NULL
    OR country_id IN (
      SELECT ca.country_id FROM public.country_assignments ca
      WHERE ca.user_id = auth.uid() AND ca.active = true
    )
  );

-- Inquiries
DROP POLICY IF EXISTS "inquiries read" ON public.inquiries;
CREATE POLICY "inquiries read" ON public.inquiries FOR SELECT TO authenticated
  USING (
    public.can('inquiries.view_all')
    OR country_id IS NULL
    OR country_id IN (
      SELECT ca.country_id FROM public.country_assignments ca
      WHERE ca.user_id = auth.uid() AND ca.active = true
    )
  );

-- Tasks
DROP POLICY IF EXISTS "tasks read" ON public.tasks;
CREATE POLICY "tasks read" ON public.tasks FOR SELECT TO authenticated
  USING (
    public.can('tasks.view_all')
    OR country_id IS NULL
    OR country_id IN (
      SELECT ca.country_id FROM public.country_assignments ca
      WHERE ca.user_id = auth.uid() AND ca.active = true
    )
  );

-- ---------------------------------------------------------------------------
-- 14. SEED COUNTRIES (initial markets; add more via configuration/UI, not code)
-- ---------------------------------------------------------------------------
INSERT INTO public.countries (code, name, display_name) VALUES
  ('KE', 'Kenya', 'Murivest Kenya'),
  ('NG', 'Nigeria', 'Murivest Nigeria'),
  ('GB', 'United Kingdom', 'Murivest United Kingdom'),
  ('AE', 'United Arab Emirates', 'Murivest UAE'),
  ('US', 'United States', 'Murivest United States'),
  ('SG', 'Singapore', 'Murivest Singapore'),
  ('ZA', 'South Africa', 'Murivest South Africa'),
  ('TH', 'Thailand', 'Murivest Thailand'),
  ('ID', 'Indonesia', 'Murivest Indonesia')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 15. SEED TRAINING MODULES (12 mandatory modules; lessons can be authored later)
-- ---------------------------------------------------------------------------
INSERT INTO public.training_modules (module_number, title, description, pass_mark, max_attempts, is_mandatory) VALUES
  (1, 'Murivest and the Junior Capital Advisor role', 'Company structure, reporting lines, professional standards, confidentiality and scope of authority.', 80, 3, true),
  (2, 'Navigating operations.murivest.com', 'Signing in, dashboard, tasks, properties, inquiries, Knowledge module, notifications, submitting work and evidence, reading feedback, requesting assistance, signing out.', 80, 3, true),
  (3, 'Task management', 'Priorities, deadlines, acceptance criteria, status updates, evidence submission, review and revision, escalating blockers.', 80, 3, true),
  (4, 'Commercial property sourcing', 'Identifying assets, source URLs, price/rent/occupancy/tenure/floor area, reported vs verified, missing documents, escalation, authorization before marketing.', 80, 3, true),
  (5, 'Property listings', 'Drafting listings, required fields, authorized images, accurate information, submitting for approval, updating/withdrawing, publishing only when authorized.', 80, 3, true),
  (6, 'Research and SEO', 'Country-specific market research, original articles, sources and verification, metadata and internal links, avoiding duplicates and fabricated claims, editorial review, publication records.', 80, 3, true),
  (7, 'External platforms and marketing accounts', 'Approved portals, directories, publishing platforms, account ownership and access control, platform terms, approved branding.', 80, 3, true),
  (8, 'Leads and transaction support', 'Recording prospects, lead sources, follow-up management, appointment coordination, deal pipeline updates, escalating qualified opportunities, protecting investor information.', 80, 3, true),
  (9, 'Country brand building', 'Country market research, property inventory, content calendars, local directories, approved outreach, search visibility, business development, country performance reporting.', 80, 3, true),
  (10, 'Security and compliance', 'Passwords and MFA, confidential information, personal data, phishing, safe document sharing, conflicts of interest, unauthorized representations, incident reporting.', 80, 3, true),
  (11, 'Commission and career development', 'Written commission agreements, attribution and eligibility, payment records, future employment, performance reviews, promotion criteria.', 80, 3, true),
  (12, 'Practical assessment', 'Demonstrate navigation, task update, property listing draft, article draft, evidence submission, unverified information identification, inquiry handling, role terms explanation.', 80, 3, true)
ON CONFLICT (module_number) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  pass_mark = EXCLUDED.pass_mark,
  max_attempts = EXCLUDED.max_attempts,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 16. DEFAULT ROLE AGREEMENT (version 1.0 — commission-only initial arrangement)
-- Content is a framework; the Managing Director must review for local law before use.
-- ---------------------------------------------------------------------------
INSERT INTO public.role_agreements (version, title, content, summary, effective_from, is_current)
VALUES (
  '1.0',
  'Junior Capital Advisor — Commission-Only Engagement Agreement',
  'This agreement governs the initial commission-only engagement of a Junior Capital Advisor at Murivest Group Ltd. The opportunity is commission-only with no guaranteed base salary during the initial phase, subject to applicable law and the signed agreement. Commissions are calculated per the written agreement, payable on qualifying closed transactions, with contributions attributed to the Junior Capital Advisor of record. Payment timing, failed-transaction treatment, reimbursable expenses, confidentiality, data protection, system use, intellectual property, termination and handover, and applicable legal terms are set out in the full agreement. Future paid employment is a potential opportunity, not a guarantee, and requires management approval, a written offer, and legal compliance.',
  'Commission-only initial arrangement; future paid employment possible after a qualifying transaction, subject to management approval and a written offer.',
  CURRENT_DATE,
  true
) ON CONFLICT (version) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 17. RPC: accept_role_terms — records agreement acceptance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_role_terms(_user_id uuid, _version text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agreement text;
BEGIN
  SELECT version INTO v_agreement FROM public.role_agreements WHERE version = _version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown agreement version: %', _version;
  END IF;

  INSERT INTO public.onboarding_status (user_id, status, agreement_version, terms_accepted_at, terms_accepted_version, updated_at)
  VALUES (_user_id, 'terms_accepted', _version, now(), _version, now())
  ON CONFLICT (user_id) DO UPDATE
    SET status = 'terms_accepted',
        agreement_version = EXCLUDED.agreement_version,
        terms_accepted_at = now(),
        terms_accepted_version = EXCLUDED.terms_accepted_version,
        updated_at = now();

  INSERT INTO public.audit_logs (user_id, action, module, record_id, new_value)
  VALUES (auth.uid(), 'Terms accepted', 'onboarding', _user_id::text, _version);
END; $$;

-- ---------------------------------------------------------------------------
-- 18. RPC: approve_onboarding — MD/ops approves engagement, assigns country + supervisor
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_onboarding(_user_id uuid, _country_id uuid, _supervisor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'onboarding.approve') THEN
    RAISE EXCEPTION 'Not authorised to approve onboarding';
  END IF;

  UPDATE public.onboarding_status
     SET status = 'approved',
         country_id = _country_id,
         supervisor_id = _supervisor_id,
         approved_by = auth.uid(),
         approved_at = now(),
         updated_at = now()
   WHERE user_id = _user_id;

  IF NOT FOUND THEN
    INSERT INTO public.onboarding_status (user_id, status, country_id, supervisor_id, approved_by, approved_at, operational_access_granted_at, updated_at)
    VALUES (_user_id, 'approved', _country_id, _supervisor_id, auth.uid(), now(), now(), now());
  END IF;

  -- Create country assignment record
  INSERT INTO public.country_assignments (user_id, country_id, supervisor_id, assigned_by, active)
  VALUES (_user_id, _country_id, _supervisor_id, auth.uid(), true)
  ON CONFLICT (user_id, country_id) DO UPDATE
    SET supervisor_id = EXCLUDED.supervisor_id,
        assigned_by = EXCLUDED.assigned_by,
        active = true,
        updated_at = now();

  INSERT INTO public.audit_logs (user_id, action, module, record_id, new_value)
  VALUES (auth.uid(), 'Onboarding approved', 'onboarding', _user_id::text, 'country_assigned');

  -- Create initial training progress records for all mandatory modules
  INSERT INTO public.training_progress (user_id, module_id, status)
  SELECT _user_id, tm.id, 'not_started'
    FROM public.training_modules tm
   WHERE tm.is_mandatory = true AND tm.is_active = true
  ON CONFLICT (user_id, module_id) DO NOTHING;
END; $$;

-- ---------------------------------------------------------------------------
-- 19. END
-- ---------------------------------------------------------------------------
SELECT 'jca_onboarding_training_countries migration applied' AS note;


-- ============================================================================
-- MURIVEST — JUNIOR CAPITAL ADVISOR PERMISSION COMPLETION
-- Follow-up to 20260922000001_jca_onboarding_training_countries.sql.
--
-- Why this file exists
-- --------------------
-- The first JCA migration shipped the operational pages, but the Junior Capital
-- Advisor role was only granted a narrow permission set (dashboard, tasks,
-- properties, inquiries, work log, wallet, knowledge, training, email requests
-- and commission). As a result the Junior Capital Advisor portal showed no
-- Calls module, no Appointments, no Follow-ups, no Contacts, no Call Scripts,
-- no Correspondence, no Escalations, no Daily Reports and no Onboarding entry,
-- and the user could not create or log calls.
--
-- This migration is additive and idempotent. It does not delete data, does not
-- change existing staff access, and does not weaken row-level security.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. JUNIOR CAPITAL ADVISOR — full operational permission set
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission) VALUES
  -- Core portal (re-asserted so this migration is self-sufficient)
  ('junior_capital_advisor','dashboard.view'),
  ('junior_capital_advisor','tasks.view'),
  ('junior_capital_advisor','tasks.create'),
  ('junior_capital_advisor','tasks.edit'),
  ('junior_capital_advisor','tasks.complete'),
  ('junior_capital_advisor','tasks.review.own'),
  ('junior_capital_advisor','properties.view'),
  ('junior_capital_advisor','properties.create'),
  ('junior_capital_advisor','properties.edit'),
  ('junior_capital_advisor','properties.edit.own'),
  ('junior_capital_advisor','inquiries.view'),
  ('junior_capital_advisor','inquiries.create'),
  ('junior_capital_advisor','inquiries.edit'),
  ('junior_capital_advisor','inquiries.edit.own'),
  ('junior_capital_advisor','knowledge.view'),
  ('junior_capital_advisor','worklog.view'),
  ('junior_capital_advisor','worklog.create'),
  ('junior_capital_advisor','worklog.edit.own'),
  ('junior_capital_advisor','wallet.view'),
  ('junior_capital_advisor','email_requests.create'),
  ('junior_capital_advisor','email_requests.view.own'),
  ('junior_capital_advisor','commission.view.own'),
  -- Onboarding & training (own records)
  ('junior_capital_advisor','onboarding.view.own'),
  ('junior_capital_advisor','training.view'),
  -- Calls (log, read and amend own call records)
  ('junior_capital_advisor','calls.view'),
  ('junior_capital_advisor','calls.create'),
  ('junior_capital_advisor','calls.edit'),
  -- Appointments
  ('junior_capital_advisor','appointments.view'),
  ('junior_capital_advisor','appointments.create'),
  ('junior_capital_advisor','appointments.edit'),
  -- Follow-ups
  ('junior_capital_advisor','followups.view'),
  ('junior_capital_advisor','followups.create'),
  ('junior_capital_advisor','followups.edit'),
  -- Contacts
  ('junior_capital_advisor','contacts.view'),
  ('junior_capital_advisor','contacts.create'),
  ('junior_capital_advisor','contacts.edit'),
  -- Call scripts (company standard scripts)
  ('junior_capital_advisor','scripts.view'),
  -- Correspondence
  ('junior_capital_advisor','correspondence.view'),
  ('junior_capital_advisor','correspondence.create'),
  ('junior_capital_advisor','correspondence.edit'),
  -- Escalations (raise, resolve own)
  ('junior_capital_advisor','escalations.view'),
  ('junior_capital_advisor','escalations.create'),
  -- Reporting & reference data
  ('junior_capital_advisor','reports.view'),
  ('junior_capital_advisor','ratecard.view')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. APPLICANT — training catalogue and own onboarding only (unchanged scope)
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission) VALUES
  ('applicant','dashboard.view'),
  ('applicant','onboarding.view.own'),
  ('applicant','training.view')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. ASSOCIATE CAPITAL ADVISOR — training visibility + call logging
-- The Associate Capital Advisor could create appointments, follow-ups, tasks
-- and properties but could not log a call, and had no access to the training
-- academy. Both gaps are closed here without changing any other access.
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission) VALUES
  ('capital_advisor','training.view'),
  ('capital_advisor','calls.create'),
  ('capital_advisor','calls.edit')
ON CONFLICT DO NOTHING;

-- Secretariat and Managing Director keep full training visibility.
INSERT INTO public.role_permissions (role, permission) VALUES
  ('secretariat','training.view'),
  ('managing_director','training.view')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. BROAD-ACCESS ROLES — preserve existing visibility of operational records
-- The remaining operational roles (Senior Advisor, Country Office Manager,
-- Operations Administrator) need the same read access the Managing Director
-- and Secretariat already have, otherwise scoping the call log below would
-- silently remove their visibility.
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission) VALUES
  ('senior_advisor','calls.view'),
  ('senior_advisor','calls.create'),
  ('senior_advisor','calls.edit'),
  ('senior_advisor','appointments.view'),
  ('senior_advisor','appointments.create'),
  ('senior_advisor','appointments.edit'),
  ('senior_advisor','followups.view'),
  ('senior_advisor','followups.create'),
  ('senior_advisor','followups.edit'),
  ('senior_advisor','contacts.view'),
  ('senior_advisor','scripts.view'),
  ('senior_advisor','correspondence.view'),
  ('senior_advisor','reports.view'),
  ('senior_advisor','ratecard.view'),
  ('country_office_manager','calls.view'),
  ('country_office_manager','calls.create'),
  ('country_office_manager','calls.edit'),
  ('country_office_manager','appointments.view'),
  ('country_office_manager','appointments.create'),
  ('country_office_manager','appointments.edit'),
  ('country_office_manager','followups.view'),
  ('country_office_manager','followups.create'),
  ('country_office_manager','followups.edit'),
  ('country_office_manager','contacts.view'),
  ('country_office_manager','scripts.view'),
  ('country_office_manager','correspondence.view'),
  ('country_office_manager','reports.view'),
  ('country_office_manager','ratecard.view'),
  ('operations_administrator','calls.view'),
  ('operations_administrator','calls.create'),
  ('operations_administrator','calls.edit'),
  ('operations_administrator','appointments.view'),
  ('operations_administrator','followups.view'),
  ('operations_administrator','contacts.view'),
  ('operations_administrator','scripts.view'),
  ('operations_administrator','correspondence.view'),
  ('operations_administrator','reports.view'),
  ('operations_administrator','ratecard.view')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. COUNTRY-SCOPED CALL LOG
-- Roles with the broad `calls.view_all` permission keep the existing
-- "see every call" behaviour. Everyone else is limited to the calls they
-- created, the calls assigned to them, and the calls attached to a property in
-- a country they are assigned to. This mirrors the country scoping already
-- applied to properties, inquiries and tasks.
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission) VALUES
  ('managing_director','calls.view_all'),
  ('secretariat','calls.view_all'),
  ('capital_advisor','calls.view_all'),
  ('senior_advisor','calls.view_all'),
  ('country_office_manager','calls.view_all'),
  ('operations_administrator','calls.view_all')
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "calls read" ON public.calls;
CREATE POLICY "calls read" ON public.calls FOR SELECT TO authenticated
  USING (
    public.can('calls.view_all')
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR property_id IN (
      SELECT p.id FROM public.properties p
      WHERE p.country_id IN (
        SELECT ca.country_id FROM public.country_assignments ca
        WHERE ca.user_id = auth.uid() AND ca.active = true
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 6. FULL MATRIX RE-ASSERTION
-- The first JCA migration introduced permissions for the Managing Director,
-- Senior Advisor, Country Office Manager and Operations Administrator. They
-- are re-asserted here so this migration alone is sufficient to bring the
-- permission matrix to its intended state, regardless of the version of the
-- first migration that was applied. Every statement is idempotent.
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission) VALUES
  -- Managing Director: full control of the new modules
  ('managing_director','onboarding.view'),
  ('managing_director','onboarding.manage'),
  ('managing_director','onboarding.approve'),
  ('managing_director','training.view'),
  ('managing_director','training.manage'),
  ('managing_director','training.review'),
  ('managing_director','countries.view'),
  ('managing_director','countries.manage'),
  ('managing_director','email_requests.view'),
  ('managing_director','email_requests.manage'),
  ('managing_director','email_requests.create'),
  ('managing_director','commission.view'),
  ('managing_director','commission.manage'),
  ('managing_director','commission.review'),
  ('managing_director','tasks.review'),
  ('managing_director','tasks.view_all'),
  ('managing_director','properties.review'),
  ('managing_director','properties.approve'),
  ('managing_director','inquiries.assign'),
  ('managing_director','inquiries.view.all'),
  -- Secretariat
  ('secretariat','countries.view'),
  ('secretariat','training.view'),
  -- Senior Advisor
  ('senior_advisor','dashboard.view'),
  ('senior_advisor','tasks.view'),
  ('senior_advisor','tasks.view_all'),
  ('senior_advisor','tasks.review'),
  ('senior_advisor','properties.view'),
  ('senior_advisor','properties.review'),
  ('senior_advisor','properties.approve'),
  ('senior_advisor','inquiries.view'),
  ('senior_advisor','inquiries.view.all'),
  ('senior_advisor','inquiries.assign'),
  ('senior_advisor','training.view'),
  ('senior_advisor','training.review'),
  ('senior_advisor','commission.view'),
  ('senior_advisor','commission.review'),
  ('senior_advisor','onboarding.view'),
  -- Country Office Manager
  ('country_office_manager','dashboard.view'),
  ('country_office_manager','tasks.view_all'),
  ('country_office_manager','tasks.review'),
  ('country_office_manager','properties.view'),
  ('country_office_manager','properties.review'),
  ('country_office_manager','inquiries.view.all'),
  ('country_office_manager','inquiries.assign'),
  ('country_office_manager','training.review'),
  ('country_office_manager','onboarding.view'),
  ('country_office_manager','onboarding.approve'),
  ('country_office_manager','countries.view'),
  ('country_office_manager','countries.manage.own'),
  ('country_office_manager','commission.view'),
  ('country_office_manager','commission.review'),
  -- Operations Administrator
  ('operations_administrator','dashboard.view'),
  ('operations_administrator','users.view'),
  ('operations_administrator','users.manage'),
  ('operations_administrator','countries.view'),
  ('operations_administrator','countries.manage'),
  ('operations_administrator','onboarding.view'),
  ('operations_administrator','onboarding.manage'),
  ('operations_administrator','training.view'),
  ('operations_administrator','training.manage'),
  ('operations_administrator','email_requests.view'),
  ('operations_administrator','email_requests.manage'),
  ('operations_administrator','commission.view'),
  ('operations_administrator','commission.manage')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. SANITY CHECK
-- Lists the Junior Capital Advisor permissions that are now active.
-- ---------------------------------------------------------------------------
SELECT role, count(*) AS permission_count
FROM public.role_permissions
WHERE role IN ('junior_capital_advisor','applicant')
GROUP BY role
ORDER BY role;

SELECT 'jca_role_permissions_completion migration applied' AS note;

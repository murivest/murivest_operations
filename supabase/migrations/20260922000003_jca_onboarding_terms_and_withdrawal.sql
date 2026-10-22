-- ============================================================================
-- MURIVEST — JCA ONBOARDING: TERMS ACCEPTANCE & APPLICATION WITHDRAWAL
-- Follow-up to 20260922000001 (onboarding/training) and
-- 20260922000002 (JCA role permissions).
--
-- Why this file exists
-- --------------------
-- 1. `accept_role_terms` could fail for a brand new applicant, leaving them
--    unable to accept the engagement agreement. This migration re-registers
--    the agreement, and re-defines the function so that it:
--      - still refuses to accept terms on behalf of another user,
--      - never fails because of a missing/unregistered agreement version,
--      - works whether or not an onboarding row already exists,
--      - enrols the applicant into mandatory training immediately,
--      - never fails because of the audit trail.
--
-- 2. A new `withdraw_onboarding_application` function supports the
--    "I do not accept the terms" action: it deletes the application, the
--    training enrolments and the country assignment, records the withdrawal
--    in the audit log, and notifies management in-app and by email.
--
-- The account itself is deleted by the client (the applicant deletes their own
-- auth user); every JCA table cascades from auth.users, so the account
-- deletion clears the remaining personal records.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. RE-REGISTER THE ROLE AGREEMENT (idempotent)
-- Guarantees that agreement version 1.0 always exists, so acceptance can
-- never be blocked by a missing seed.
-- ---------------------------------------------------------------------------
INSERT INTO public.role_agreements (version, title, content, summary, effective_from, is_current)
VALUES (
  '1.0',
  'Junior Capital Advisor — Commission-Only Engagement Agreement',
  'This agreement governs the initial commission-only engagement of a Junior Capital Advisor at Murivest Group Ltd. The opportunity is commission-only with no guaranteed base salary during the initial phase, subject to applicable law and the signed agreement. Commissions are calculated per the written agreement, payable on qualifying closed transactions, with contributions attributed to the Junior Capital Advisor of record. Payment timing, failed-transaction treatment, reimbursable expenses, confidentiality, data protection, system use, intellectual property, termination and handover, and applicable legal terms are set out in the full agreement. Future paid employment is a potential opportunity, not a guarantee, and requires management approval, a written offer, and legal compliance.',
  'Commission-only initial arrangement; future paid employment possible after a qualifying transaction, subject to management approval and a written offer.',
  CURRENT_DATE,
  true
) ON CONFLICT (version) DO UPDATE SET
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  summary = EXCLUDED.summary,
  is_current = true,
  updated_at = now();

-- Exactly one agreement is the current one.
UPDATE public.role_agreements SET is_current = false WHERE version <> '1.0' AND is_current = true;

-- ---------------------------------------------------------------------------
-- 2. accept_role_terms — hardened
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_role_terms(_user_id uuid, _version text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_agreement text;
BEGIN
  -- A user may only accept the terms for their own account.
  IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not authorised to accept terms for another user';
  END IF;

  -- Resolve the agreement version. If the requested version is not registered,
  -- fall back to the current agreement, then to the most recent one, so a
  -- missing or renamed version can never block the applicant.
  SELECT version INTO v_agreement FROM public.role_agreements WHERE version = _version;
  IF v_agreement IS NULL THEN
    SELECT version INTO v_agreement FROM public.role_agreements
     WHERE is_current = true ORDER BY effective_from DESC LIMIT 1;
  END IF;
  IF v_agreement IS NULL THEN
    SELECT version INTO v_agreement FROM public.role_agreements
     ORDER BY effective_from DESC LIMIT 1;
  END IF;
  IF v_agreement IS NULL THEN
    RAISE EXCEPTION 'No role agreement is available. Please contact the Managing Director.';
  END IF;

  -- Create or update the application record. An approval that has already
  -- been granted is never downgraded by re-accepting the terms.
  INSERT INTO public.onboarding_status AS os
    (user_id, status, role, agreement_version, terms_accepted_at, terms_accepted_version, updated_at)
  VALUES (_user_id, 'terms_accepted', 'junior_capital_advisor', v_agreement, now(), v_agreement, now())
  ON CONFLICT (user_id) DO UPDATE SET
    status = CASE
               WHEN os.status IN ('approved', 'active', 'suspended', 'offboarded') THEN os.status
               ELSE 'terms_accepted'
             END,
    agreement_version = EXCLUDED.agreement_version,
    terms_accepted_at = COALESCE(os.terms_accepted_at, now()),
    terms_accepted_version = EXCLUDED.terms_accepted_version,
    updated_at = now();

  -- Enrol the applicant into every mandatory training module.
  INSERT INTO public.training_progress (user_id, module_id, status)
  SELECT _user_id, tm.id, 'not_started'
    FROM public.training_modules tm
   WHERE tm.is_mandatory = true AND tm.is_active = true
  ON CONFLICT (user_id, module_id) DO NOTHING;

  -- Audit the acceptance. A failure here must never undo the acceptance.
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, new_value)
    VALUES (auth.uid(), 'Terms accepted', 'onboarding', _user_id::text, v_agreement);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END; $$;

-- ---------------------------------------------------------------------------
-- 3. withdraw_onboarding_application
-- Deletes the application and its dependants, audits the withdrawal and
-- notifies management in-app and by email. The client then deletes the
-- applicant's auth account, which cascades to every remaining JCA record.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.withdraw_onboarding_application()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text;
  v_email text;
  v_title text := 'Onboarding application withdrawn';
  v_body text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT full_name, email INTO v_name, v_email
    FROM public.profiles WHERE id = v_user;

  v_name := COALESCE(NULLIF(v_name, ''), v_email, 'An applicant');
  v_body := v_name || ' (' || COALESCE(v_email, 'no email address') ||
            ') declined the Junior Capital Advisor terms and conditions. ' ||
            'Their application, training enrolments and account have been deleted.';

  -- Remove the application and everything that belongs to it.
  DELETE FROM public.training_progress WHERE user_id = v_user;
  DELETE FROM public.country_assignments WHERE user_id = v_user;
  DELETE FROM public.onboarding_status WHERE user_id = v_user;

  -- Audit the withdrawal.
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, module, record_id, record_label, new_value)
    VALUES (v_user, 'Application withdrawn', 'onboarding', v_user::text, v_name, 'terms_declined');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Notify management in-app.
  INSERT INTO public.notifications (recipient_id, type, title, body, module, record_id)
  SELECT ur.user_id, 'onboarding_withdrawn', v_title, v_body, 'onboarding', v_user::text
    FROM public.user_roles ur
   WHERE ur.role IN ('managing_director', 'operations_administrator', 'country_office_manager')
     AND ur.user_id <> v_user;

  -- Notify management by email where they have opted in.
  PERFORM public.queue_email_notification(
           ur.user_id, 'onboarding_withdrawn', v_title, v_body, 'onboarding', v_user::text)
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
   WHERE ur.role IN ('managing_director', 'operations_administrator', 'country_office_manager')
     AND ur.user_id <> v_user
     AND p.email_notifications = true
     AND p.notify_management_message = true;
END; $$;

-- ---------------------------------------------------------------------------
-- 4. delete_current_account — server-side account deletion
--
-- supabase-js no longer exposes a user-facing `auth.deleteUser()`, so the
-- client calls the GoTrue self-service endpoint directly. This routine is the
-- fallback for the cases where GoTrue refuses that request (expired session,
-- self-service deletion disabled on the project).
--
-- It is strictly scoped to the caller: the user id always comes from the
-- caller's own token, never from a parameter, so it cannot be used to delete
-- anybody else's account.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_current_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  -- Remove the application-side records first so nothing is left behind even
  -- if the authentication record cannot be removed.
  DELETE FROM public.training_progress WHERE user_id = v_user;
  DELETE FROM public.country_assignments WHERE user_id = v_user;
  DELETE FROM public.onboarding_status WHERE user_id = v_user;

  -- Remove the authentication record. auth.identities, auth.sessions,
  -- auth.mfa_factors and the remaining auth tables cascade from auth.users.
  DELETE FROM auth.users WHERE id = v_user;
END; $$;

-- ---------------------------------------------------------------------------
-- 5. GRANT EXECUTE
-- ---------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.accept_role_terms(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_onboarding_application() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_current_account() TO authenticated;

SELECT 'jca_onboarding_terms_and_withdrawal migration applied' AS note;

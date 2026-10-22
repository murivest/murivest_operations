import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { callRpc, newTables, rpcErrorMessage } from "@/lib/queries";
import { deleteCurrentAccount } from "@/lib/account";
import { formatDateTime, text } from "@/lib/format";
import { COMPANY } from "@/lib/constants";
import {
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/app/onboarding")({
  component: OnboardingPage,
});

type OnboardingStatus = {
  id: string;  user_id: string;
  status: string;
  role: string;
  agreement_version: string | null;
  terms_accepted_at: string | null;
  terms_accepted_version: string | null;
  country_id: string | null;
  supervisor_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  operational_access_granted_at: string | null;
  suspended_at: string | null;
  offboarded_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Presents a failure to the user without discarding the reason. Database
 * errors are the only way to diagnose a rejected action, so the detail is
 * kept; only access-control failures are rewritten for clarity.
 */
function describeFailure(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message) return fallback;
  if (/row-level security|permission denied/i.test(message)) {
    return "You do not have permission to perform this action.";
  }
  return message;
}

function OnboardingPage() {
  const { profile, role } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [declining, setDeclining] = useState(false);

  const { data: onboarding, isLoading } = useQuery({
    queryKey: ["onboarding-status"],
    queryFn: async () => {
      const { data, error } = await newTables
        .from("onboarding_status")
        .select("*")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();
      if (error) throw error;
      return data as OnboardingStatus | null;
    },
  });

  const acceptTerms = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in.");
      const { error } = await callRpc("accept_role_terms", {
        _user_id: auth.user.id,
        _version: "1.0",
      });
      if (error) throw new Error(rpcErrorMessage(error, "Unable to accept terms."));
    },
    onSuccess: () => {
      toast.success("Terms accepted. Your application is ready for administrator review.");
      queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
    },
    onError: (e) => {
      toast.error(describeFailure(e, "Unable to accept terms."));
    },
  });
  // Declining the terms withdraws the application, deletes the account and
  // notifies management. The application and the management notification are
  // handled server-side; the account deletion uses the applicant's own
  // session, so it must run from the browser.
  const declineTerms = useMutation({
    mutationFn: async () => {
      const { error } = await callRpc("withdraw_onboarding_application", {});
      if (error) throw new Error(rpcErrorMessage(error, "Unable to withdraw the application."));

      try {
        await deleteCurrentAccount();
      } catch (e) {
        // The application is already withdrawn and management notified, so the
        // only remaining step is the account itself.
        await supabase.auth.signOut();
        throw new Error(
          `Your application was withdrawn and management was notified, but the account could not be deleted automatically (${describeFailure(e, "unknown error")}). Please sign in again and contact the Managing Director to complete the deletion.`,
        );
      }
    },
    onSuccess: () => {
      setDeclining(false);
      queryClient.clear();
      toast.success("Your application has been withdrawn and your account deleted. Management has been notified.");
      navigate({ to: "/auth/login", replace: true });
    },
    onError: (e) => {
      setDeclining(false);
      toast.error(describeFailure(e, "Unable to withdraw the application."));
    },
  });

  if (isLoading) return <LoadingState label="Loading onboarding status…" />;

  const status = onboarding?.status ?? "applicant";
  const accepted = !!onboarding?.terms_accepted_at;
  const approved = !!onboarding?.approved_at;
  const operational = !!onboarding?.operational_access_granted_at;

  // Only the Junior Capital Advisor and Applicant roles go through this
  // programme. Everyone else must never be offered the accept/decline
  // actions, because declining deletes the signed-in account.
  const isOnboardingRole = role === "junior_capital_advisor" || role === "applicant";

  const showTerms = isOnboardingRole && accepted === false && status !== "offboarded";
  const showAwaitingApproval = isOnboardingRole && accepted && !approved;
  const showAwaitingCountry = isOnboardingRole && approved && !operational && !onboarding?.country_id;
  const showComplete = isOnboardingRole && operational;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding"
        description="Your journey from application to active Junior Capital Advisor."
      />

      {!isOnboardingRole && (
        <Panel title="Not applicable to your role">
          <p className="text-sm text-muted-foreground">
            The Junior Capital Advisor onboarding programme applies to applicants and Junior
            Capital Advisors. Your account is provisioned directly by an administrator.
          </p>
        </Panel>
      )}

      <Panel title="Your status">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Stage"
            value={status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
            tone={
              status === "approved" || status === "active"
                ? "success"
                : status === "suspended" || status === "offboarded"
                  ? "destructive"
                  : "default"
            }
          />
          <StatCard
            label="Terms accepted"
            value={accepted ? "Yes" : "No"}
            tone={accepted ? "success" : "warning"}
          />
          <StatCard
            label="Operational access"
            value={operational ? "Active" : "Restricted"}
            tone={operational ? "success" : "warning"}
          />
        </div>
      </Panel>

      <Panel title="Onboarding steps">
        <ol className="space-y-3">
          {[
            { label: "Application submitted", done: true },
            { label: "Administrator review", done: status !== "applicant" },
            { label: "Review role description", done: status !== "applicant" },
            { label: "Accept terms & conditions", done: accepted },
            { label: "Administrator approval", done: approved },
            { label: "Country & supervisor assigned", done: !!onboarding?.country_id },
            { label: "Mandatory training", done: status === "training" || status === "active" },
            { label: "Operational access activated", done: operational },
          ].map((step, i) => (
            <li key={i} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
              <span className={`size-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${step.done ? "bg-success text-success-foreground" : "bg-border text-muted-foreground border-border"}`}>
                {step.done ? "✓" : i + 1}
              </span>
              <span className={`text-sm ${step.done ? "text-foreground" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      {showTerms && (
        <Panel title="Role terms & conditions">
          <p className="text-sm text-muted-foreground mb-4">
            Before you can access operational tools, you must read and accept the
            Junior Capital Advisor engagement agreement (version 1.0). This is a
            commission-only initial arrangement. Please review it carefully.
          </p>
          <div className="surface rounded-md border border-border p-4 max-w-2xl text-sm text-muted-foreground leading-relaxed">
            <p><strong>Position:</strong> Junior Capital Advisor — Commercial Real Estate</p>
            <p><strong>Company:</strong> {COMPANY.name}</p>
            <p>
              <strong>Initial arrangement:</strong> Commission-only, with no guaranteed base salary
              during the initial phase, subject to applicable law and the signed agreement.
            </p>
            <p>
              Commissions are calculated per the written agreement, payable on qualifying closed
              transactions, with contributions attributed to the Junior Capital Advisor of record.
            </p>
            <p>
              Future paid employment is a potential opportunity, not a guarantee, and requires
              management approval, a written offer, and legal compliance.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => acceptTerms.mutate()}
              disabled={acceptTerms.isPending}
              className="w-fit"
            >
              {acceptTerms.isPending ? "Saving…" : "I accept the terms & conditions (v1.0)"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeclining(true)}
              disabled={acceptTerms.isPending || declineTerms.isPending}
              className="w-fit"
            >
              I do not accept the terms & conditions
            </Button>
          </div>
        </Panel>
      )}

      {showAwaitingApproval && (
        <Panel title="Awaiting administrator approval">
          <p className="text-sm text-muted-foreground">
            Your terms have been accepted. The Managing Director will review your application and
            assign a country and supervisor. You will be notified when your account is approved.
          </p>
        </Panel>
      )}

      {showAwaitingCountry && (
        <Panel title="Awaiting country assignment">
          <p className="text-sm text-muted-foreground">
            Your application has been approved. An administrator will assign you to a country and
            supervisor before operational access is activated.
          </p>
        </Panel>
      )}

      {showComplete && (
        <Panel title="Onboarding complete">
          <p className="text-sm text-success">
            You are now an active Junior Capital Advisor. You can access tasks, properties,
            inquiries, and training.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button asChild size="sm">
              <Link to="/app/tasks">View tasks</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/training">Training academy</Link>
            </Button>
          </div>
        </Panel>
      )}

      <Dialog open={declining} onOpenChange={(open) => !open && setDeclining(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw your application?</DialogTitle>
            <DialogDescription>
              Declining the Junior Capital Advisor terms and conditions permanently withdraws
              your application. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>When you continue, the following happens automatically:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Your onboarding application and training enrolments are deleted.</li>
              <li>Your user account is deleted.</li>
              <li>
                The Managing Director, Operations Administrator and Country Office Manager are
                notified that you declined the terms.
              </li>
            </ul>
            <p>
              If you change your mind later you will need to submit a new application.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeclining(false)}
              disabled={declineTerms.isPending}
            >
              Keep my application
            </Button>
            <Button
              variant="destructive"
              onClick={() => declineTerms.mutate()}
              disabled={declineTerms.isPending}
            >
              {declineTerms.isPending ? "Withdrawing…" : "Withdraw and delete my account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app/AppShell";
import { LoadingState } from "@/components/app/ui-kit";
import { useAuth } from "@/lib/auth";
import { newTables } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

const ONBOARDING_ALLOWED_PATHS = ["/app/onboarding", "/app/training", "/app/settings", "/app/email-requests", "/app/commission"];

type OnboardingRow = {
  status: string | null;
  approved_at: string | null;
  operational_access_granted_at: string | null;
};

function AppLayout() {
  const { loading, role, profile, session } = useAuth();
  const location = useLocation();

  // Onboarding state drives the access gate: a Junior Capital Advisor keeps
  // the onboarding/training surface until their engagement is approved.
  const { data: onboarding, isLoading: onboardingLoading } = useQuery({
    queryKey: ["onboarding-status", session?.user.id],
    enabled: !!session?.user.id,
    queryFn: async () => {
      const { data, error } = await newTables
        .from("onboarding_status")
        .select("status, approved_at, operational_access_granted_at")
        .eq("user_id", session!.user.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as OnboardingRow | null;
    },
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Loading your workspace…" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="surface max-w-md rounded-md p-8 text-center">
          <p className="wordmark text-lg text-foreground">MURIVEST</p>
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            Awaiting role assignment
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account ({profile?.email}) has been created but no role has been assigned
            yet. The Managing Director must assign your role before you can access the
            internal system.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth/login";
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  // Access gate: the Junior Capital Advisor and Applicant roles must complete
  // onboarding and mandatory training before accessing operational tools.
  // The gate lifts for a Junior Capital Advisor once their engagement has been
  // approved and operational access granted.
  const onboardingStatus = onboarding?.status ?? null;
  const onboardingComplete =
    onboardingStatus === "approved" ||
    onboardingStatus === "active" ||
    !!onboarding?.operational_access_granted_at;
  const isRestrictedRole =
    role === "applicant" || (role === "junior_capital_advisor" && !onboardingComplete);
  const isOnAllowedPath = ONBOARDING_ALLOWED_PATHS.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`),
  );

  // While the onboarding record is still loading, wait rather than flashing
  // the "Onboarding required" screen at an already-onboarded advisor.
  if (role === "junior_capital_advisor" && onboardingLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingState label="Loading your workspace…" />
      </div>
    );
  }

  if (isRestrictedRole && !isOnAllowedPath) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="surface max-w-md rounded-md p-8 text-center">
          <p className="wordmark text-lg text-foreground">MURIVEST</p>
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            Onboarding required
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account ({profile?.email}) is assigned the {role.replace(/_/g, " ")} role,
            but onboarding and mandatory training must be completed before you can access
            operational tools.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              window.location.href = "/app/onboarding";
            }}
          >
            Go to onboarding
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell restrictTo={isRestrictedRole ? ONBOARDING_ALLOWED_PATHS : undefined}>
      <Outlet />
    </AppShell>
  );
}

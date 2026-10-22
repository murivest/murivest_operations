import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  listTrainingModules,
  listTrainingProgress,
  newTables,
  staffName,
} from "@/lib/queries";
import { formatDateTime, friendlyError } from "@/lib/format";
import {
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/training")({
  component: TrainingPage,
});

type ModuleWithProgress = {
  id: string;
  module_number: number;
  title: string;
  description: string;
  pass_mark: number;
  max_attempts: number;
  is_mandatory: boolean;
  is_active: boolean;
  training_progress: {
    id: string;
    user_id: string;
    module_id: string;
    status: string;
    score: number | null;
    attempts: number;
    completed_at: string | null;
    certificate_issued_at: string | null;
  } | null;
};

function TrainingPage() {
  const { profile, role, can } = useAuth();
  const queryClient = useQueryClient();

  const { data: modules, isLoading } = useQuery({
    queryKey: ["training-modules-with-progress"],
    queryFn: async () => {
      const [mods, progress] = await Promise.all([
        listTrainingModules(),
        listTrainingProgress((await supabase.auth.getUser()).data.user?.id),
      ]);
      const progressMap = new Map(
        (progress ?? []).map((p) => [p.module_id, p]),
      );
      return (mods ?? []).map((m) => ({
        ...m,
        training_progress: progressMap.get(m.id) ?? null,
      })) as ModuleWithProgress[];
    },
  });

  const retake = useMutation({
    mutationFn: async ({ moduleId }: { moduleId: string }) => {
      const { error } = await newTables
        .from("training_progress")
        .update({ status: "not_started", score: null, attempts: 0, completed_at: null })
        .eq("module_id", moduleId)
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Module reset. You can retake it.");
      queryClient.invalidateQueries({ queryKey: ["training-modules-with-progress"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to reset module.")),
  });

  if (isLoading) return <LoadingState label="Loading training modules…" />;

  const rows = modules ?? [];
  const mandatory = rows.filter((m) => m.is_mandatory);
  const completed = mandatory.filter(
    (m) => m.training_progress?.status === "completed",
  ).length;
  const allMandatoryComplete = mandatory.length > 0 && completed === mandatory.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training academy"
        description={
          role === "junior_capital_advisor" || role === "applicant"
            ? "Complete all mandatory modules to activate operational access."
            : "Review and manage training for Junior Capital Advisors."
        }
        actions={
          can("training.manage") ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/app/admin/training">Manage training</Link>
            </Button>
          ) : null
        }
      />

      <Panel title="Your progress">
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard label="Modules" value={rows.length} />
          <StatCard
            label="Mandatory complete"
            value={`${completed} / ${mandatory.length}`}
            tone={allMandatoryComplete ? "success" : "warning"}
          />
          <StatCard
            label="In progress"
            value={rows.filter((m) => m.training_progress?.status === "in_progress").length}
          />
          <StatCard
            label="Not started"
            value={rows.filter((m) => !m.training_progress || m.training_progress.status === "not_started").length}
            tone="warning"
          />
        </div>
      </Panel>

      {rows.length === 0 ? (
        <EmptyState message="No training modules available." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => {
            const p = m.training_progress;
            const done = p?.status === "completed";
            const inProgress = p?.status === "in_progress";
            return (
              <Panel key={m.id} title={m.title} className="group">
                <p className="text-xs text-muted-foreground mb-3">
                  Module {m.module_number} · {m.description}
                </p>
                <div className="flex items-center justify-between mb-3">
                  <StatusBadge tone={done ? "success" : inProgress ? "info" : "neutral"}>
                    {done ? "Completed" : inProgress ? "In progress" : "Not started"}
                  </StatusBadge>
                  {p?.score != null && (
                    <span className="text-xs font-mono text-muted-foreground">
                      Score: {p.score}%
                    </span>
                  )}
                </div>
                {p?.attempts && p.attempts > 0 && (
                  <p className="text-xs text-muted-foreground mb-3">
                    Attempts: {p.attempts} / {m.max_attempts}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    asChild
                    size="sm"
                    disabled={!done && role === "applicant" && !can("training.view")}
                  >
                    <Link
                      to="/app/training/$moduleId"
                      params={{ moduleId: m.id }}
                    >
                      {done ? "Review" : "Start"}
                    </Link>
                  </Button>
                  {done && can("training.manage") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => retake.mutate({ moduleId: m.id })}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {allMandatoryComplete && role === "junior_capital_advisor" && (
        <Panel title="Training complete" className="border-success">
          <p className="text-sm text-success">
            All mandatory training modules are complete. Operational access will be activated
            by an administrator.
          </p>
        </Panel>
      )}
    </div>
  );
}

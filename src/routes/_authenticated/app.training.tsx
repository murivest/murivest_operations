// src/app/training.tsx  (route: /_authenticated/app/training)
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { BookOpenCheck, Clock, FileDown, PlayCircle, Video } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listTrainingModules, listTrainingProgress, newTables } from "@/lib/queries";
import { friendlyError } from "@/lib/format";
import { MODULES } from "@/lib/trainingAcademy";
import {
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  StatCard,
  StatusBadge,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/app/training")({
  component: TrainingPage,
});

/* Lesson-level progress lives in localStorage (no schema change needed). */
const lessonKey = (mod: string, lesson: string) => `mv-lesson-${mod}-${lesson}`;

function lessonsDone(modCode: string, lessonIds: string[]): number {
  if (typeof window === "undefined") return 0;
  return lessonIds.filter((id) => localStorage.getItem(lessonKey(modCode, id)) === "1").length;
}

function TrainingPage() {
  const { role, can } = useAuth();
  const queryClient = useQueryClient();

  // DB modules/progress are joined to static content by module_number so the
  // existing admin "Manage training" flow keeps working.
  const { data: dbModules } = useQuery({
    queryKey: ["training-modules"],
    queryFn: listTrainingModules,
  });

  const { data: dbProgress } = useQuery({
    queryKey: ["training-progress"],
    queryFn: async () => listTrainingProgress((await supabase.auth.getUser()).data.user?.id),
  });

  const retake = useMutation({
    mutationFn: async ({ moduleNumber }: { moduleNumber: number }) => {
      const dbRow = (dbModules ?? []).find((m) => m.module_number === moduleNumber);
      if (dbRow) {
        const { error } = await newTables
          .from("training_progress")
          .update({ status: "not_started", score: null, attempts: 0, completed_at: null })
          .eq("module_id", dbRow.id)
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id);
        if (error) throw error;
      } else {
        localStorage.removeItem(`mv-assessment-${moduleNumber}`);
      }
    },
    onSuccess: () => {
      toast.success("Module reset. You can retake it.");
      queryClient.invalidateQueries({ queryKey: ["training-progress"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to reset module.")),
  });

  const rows = MODULES.map((mod) => {
    const dbRow = (dbModules ?? []).find((m) => m.module_number === mod.moduleNumber);
    const p = dbRow ? (dbProgress ?? []).find((x) => x.module_id === dbRow.id) : null;
    const lessonIds = mod.lessons.map((l) => l.id);
    const doneCount = lessonsDone(mod.code, lessonIds);
    return {
      mod,
      dbRow,
      status: p?.status ?? "not_started",
      score: p?.score ?? null,
      attempts: p?.attempts ?? 0,
      lessonsDone: doneCount,
      lessonsTotal: lessonIds.length,
    };
  });

  const mandatory = rows.filter((r) => r.mod.mandatory);
  const completed = mandatory.filter((r) => r.status === "completed").length;
  const allMandatoryComplete = mandatory.length > 0 && completed === mandatory.length;
  const totalResources = MODULES.reduce((n, m) => n + m.resources.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Murivest Training Academy"
        description={
          role === "junior_capital_advisor" || role === "applicant"
            ? "Complete all 12 mandatory modules — including your core mandates: AI content publishing and property publishing — to activate full operational access."
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
          <StatCard label="Modules" value={MODULES.length} />
          <StatCard
            label="Mandatory complete"
            value={`${completed} / ${mandatory.length}`}
            tone={allMandatoryComplete ? "success" : "warning"}
          />
          <StatCard
            label="In progress"
            value={rows.filter((r) => r.status === "in_progress").length}
          />
          <StatCard label="Downloads & videos" value={totalResources} />
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ mod, dbRow, status, score, attempts, lessonsDone, lessonsTotal }) => {
          const done = status === "completed";
          const inProgress = status === "in_progress";
          const lessonPct = lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0;
          return (
            <Panel key={mod.code} title={`Module ${mod.moduleNumber}`} className="group flex flex-col">
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge tone={done ? "success" : inProgress ? "info" : "neutral"}>
                    {done ? "Completed" : inProgress ? "In progress" : "Not started"}
                  </StatusBadge>
                  {mod.mandatory && <StatusBadge tone="warning">Mandatory</StatusBadge>}
                </div>
                <h3 className="font-semibold leading-snug">{mod.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{mod.subtitle}</p>
              </div>

              <div className="space-y-2 text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> {mod.duration}
                </div>
                <div className="flex items-center gap-1.5">
                  <BookOpenCheck className="h-3.5 w-3.5" /> {mod.lessons.length} lessons
                  {lessonsDone > 0 && ` · ${lessonsDone}/${lessonsTotal} done`}
                </div>
                {mod.zoomRecordingUrl && (
                  <div className="flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5" /> Zoom recording included
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <FileDown className="h-3.5 w-3.5" /> {mod.resources.length} downloadable documents
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                  <span>Lesson progress</span>
                  <span>{lessonPct}%</span>
                </div>
                <Progress value={lessonPct} className="h-1.5" />
              </div>

              {score != null && (
                <p className="text-xs font-mono text-muted-foreground mb-3">Score: {score}%</p>
              )}
              {attempts > 0 && !done && (
                <p className="text-xs text-muted-foreground mb-3">
                  Attempts: {attempts} / {mod.maxAttempts}
                </p>
              )}

              <div className="mt-auto flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link
                    to="/app/training/$moduleId"
                    params={{ moduleId: mod.code }}
                    onClick={() => {
                      // mark in_progress in DB the first time they open it
                      if (!done && !inProgress && dbRow) {
                        void supabase.auth.getUser().then(({ data }) => {
                          if (!data.user) return;
                          void newTables.from("training_progress").upsert(
                            {
                              user_id: data.user.id,
                              module_id: dbRow.id,
                              status: "in_progress",
                              attempts: 1,
                            },
                            { onConflict: "user_id, module_id" },
                          );
                          queryClient.invalidateQueries({ queryKey: ["training-progress"] });
                        });
                      }
                    }}
                  >
                    <PlayCircle className="h-4 w-4 mr-1" />
                    {done ? "Review" : "Start module"}
                  </Link>
                </Button>
                {done && can("training.manage") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => retake.mutate({ moduleNumber: mod.moduleNumber })}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </Panel>
          );
        })}
      </div>

      {allMandatoryComplete && role === "junior_capital_advisor" && (
        <Panel title="Training complete" className="border-success">
          <p className="text-sm text-success">
            All mandatory training modules are complete. Operational access will be activated by an
            administrator.
          </p>
        </Panel>
      )}

      {rows.length === 0 && <EmptyState message="No training modules available." />}
    </div>
  );
}


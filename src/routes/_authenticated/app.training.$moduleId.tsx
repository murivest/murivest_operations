import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  listTrainingModules,
  listTrainingProgress,
  newTables,
} from "@/lib/queries";
import { formatDateTime, friendlyError } from "@/lib/format";
import {
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/training/$moduleId")({
  component: TrainingModulePage,
});

type Module = {
  id: string;
  module_number: number;
  title: string;
  description: string;
  pass_mark: number;
  max_attempts: number;
  is_mandatory: boolean;
};

type Lesson = {
  id: string;
  module_id: string;
  title: string;
  content: string;
  order_index: number;
};

type Progress = {
  id: string;
  user_id: string;
  module_id: string;
  status: string;
  score: number | null;
  attempts: number;
  completed_at: string | null;
};

function TrainingModulePage() {
  const { profile, role, can } = useAuth();
  const queryClient = useQueryClient();
  const { moduleId } = useParams({ from: "/_authenticated/app/training/$moduleId" });
  const [assessmentScore, setAssessmentScore] = useState("");

  const { data: module, isLoading: moduleLoading } = useQuery({
    queryKey: ["training-module", moduleId],
    queryFn: async () => {
      const { data, error } = await newTables
        .from("training_modules")
        .select("*")
        .eq("id", moduleId)
        .maybeSingle();
      if (error) throw error;
      return data as Module;
    },
    enabled: !!moduleId,
  });

  const { data: lessons, isLoading: lessonsLoading } = useQuery({
    queryKey: ["training-lessons", moduleId],
    queryFn: async () => {
      const { data, error } = await newTables
        .from("training_lessons")
        .select("*")
        .eq("module_id", moduleId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as Lesson[];
    },
    enabled: !!moduleId,
  });

  const { data: progress, isLoading: progressLoading } = useQuery({
    queryKey: ["training-progress", moduleId],
    queryFn: async () => {
      const { data, error } = await newTables
        .from("training_progress")
        .select("*")
        .eq("module_id", moduleId)
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .maybeSingle();
      if (error) throw error;
      return data as Progress | null;
    },
    enabled: !!moduleId,
  });

  const startModule = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in.");
      const { error } = await newTables.from("training_progress").insert({
        user_id: auth.user.id,
        module_id: moduleId,
        status: "in_progress",
        attempts: 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["training-progress", moduleId] });
      queryClient.invalidateQueries({ queryKey: ["training-modules-with-progress"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to start module.")),
  });

  const submitAssessment = useMutation({
    mutationFn: async (score: number) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in.");
      const passed = score >= (module?.pass_mark ?? 80);
      const attempts = (progress?.attempts ?? 0) + 1;
      const { error } = await newTables.from("training_progress").upsert({
        user_id: auth.user.id,
        module_id: moduleId,
        status: passed ? "completed" : "in_progress",
        score,
        attempts,
        completed_at: passed ? new Date().toISOString() : null,
      }, { onConflict: "user_id, module_id" });
      if (error) throw error;
      const { error: aError } = await newTables.from("training_assessments").insert({
        user_id: auth.user.id,
        module_id: moduleId,
        score,
        passed,
        attempt_number: attempts,
      });
      if (aError) throw aError;
    },
    onSuccess: () => {
      toast.success("Assessment submitted.");
      queryClient.invalidateQueries({ queryKey: ["training-progress", moduleId] });
      queryClient.invalidateQueries({ queryKey: ["training-modules-with-progress"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to submit assessment.")),
  });

  if (moduleLoading || lessonsLoading || progressLoading)
    return <LoadingState label="Loading training module…" />;
  if (!module) return <EmptyState message="Training module not found." />;

  const done = progress?.status === "completed";
  const attemptsUsed = progress?.attempts ?? 0;
  const canAttempt = attemptsUsed < (module.max_attempts ?? 3) || done;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Module ${module.module_number}: ${module.title}`}
        description={module.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              size="sm"
              disabled={done}
              onClick={() => startModule.mutate()}
            >
              <Link to="/app/training/$moduleId" params={{ moduleId }}>
                Start module
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/training">Back to academy</Link>
            </Button>
          </div>
        }
      />

      <Panel title="Lessons">
        {(lessons ?? []).length === 0 ? (
          <EmptyState message="No lessons authored for this module yet." hint="An administrator can add lessons." />
        ) : (
          <div className="space-y-4">
            {(lessons ?? []).map((l) => (
              <Panel key={l.id} title={l.title} className="p-3">
                <div className="prose-sm text-sm text-muted-foreground leading-relaxed">
                  {l.content}
                </div>
              </Panel>
            ))}
          </div>
        )}
      </Panel>

      {!done && canAttempt && module.is_mandatory && (
        <Panel title="Assessment">
          <p className="text-sm text-muted-foreground mb-4">
            Pass mark: {module.pass_mark}% · Attempts remaining:
            {module.max_attempts - attemptsUsed} of {module.max_attempts}
          </p>
          <div className="space-y-3 max-w-md">
            <Field label="Your score (%)">
              <Input
                type="number"
                min={0}
                max={100}
                value={assessmentScore}
                onChange={(e) => setAssessmentScore(e.target.value)}
                placeholder="e.g. 85"
              />
            </Field>
            <Button
              onClick={() => {
                const s = Number(assessmentScore);
                if (!s || s < 0 || s > 100) {
                  toast.error("Enter a valid score between 0 and 100.");
                  return;
                }
                submitAssessment.mutate(s);
              }}
              disabled={submitAssessment.isPending || !assessmentScore}
            >
              {submitAssessment.isPending ? "Submitting…" : "Submit assessment"}
            </Button>
          </div>
        </Panel>
      )}

      {done && (
        <Panel title="Module completed" className="border-success">
          <p className="text-sm text-success">
            You scored {progress?.score}% and completed this module.
          </p>
        </Panel>
      )}

      {!canAttempt && !done && (
        <Panel title="Attempts exhausted" className="border-destructive">
          <p className="text-sm text-muted-foreground">
            You have used all {module.max_attempts} attempts for this module. Please contact an
            administrator to request a reassignment.
          </p>
        </Panel>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="label-caps block">{label}</span>
      {children}
    </label>
  );
}

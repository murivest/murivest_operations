import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listTrainingModules, listTrainingProgress, listStaff, newTables, staffName } from "@/lib/queries";
import { formatDateTime, friendlyError } from "@/lib/format";
import {
  DataTable,
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  Row,
  Cell,
  StatCard,
  StatusBadge,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/admin/training")({
  component: AdminTrainingPage,
});

type ProgressRow = {
  id: string;
  user_id: string;
  module_id: string;
  status: string;
  score: number | null;
  attempts: number;
  completed_at: string | null;
  certificate_issued_at: string | null;
  training_modules: {
    module_number: number;
    title: string;
    is_mandatory: boolean;
  } | null;
};

function AdminTrainingPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-training-progress"],
    queryFn: async () => {
      const { data, error } = await newTables
        .from("training_progress")
        .select("*, training_modules(module_number, title, is_mandatory)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProgressRow[];
    },
  });

  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });

  const reassign = useMutation({
    mutationFn: async ({ moduleId, userId }: { moduleId: string; userId: string }) => {
      const { error } = await newTables
        .from("training_progress")
        .update({ status: "not_started", score: null, attempts: 0, completed_at: null })
        .eq("module_id", moduleId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Training reassigned.");
      queryClient.invalidateQueries({ queryKey: ["admin-training-progress"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to reassign training.")),
  });

  if (isLoading) return <LoadingState label="Loading training progress…" />;

  const rows = data ?? [];
  const incomplete = rows.filter((r) => r.status !== "completed");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training management"
        description="Monitor Junior Capital Advisor training completion and reassign modules when policies change."
      />

      <Panel title="Overview">
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard label="Total enrollments" value={rows.length} />
          <StatCard label="Completed" value={rows.filter((r) => r.status === "completed").length} tone="success" />
          <StatCard label="In progress" value={rows.filter((r) => r.status === "in_progress").length} />
          <StatCard label="Not started" value={rows.filter((r) => r.status === "not_started").length} tone="warning" />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {incomplete.length} enrollment(s) are not yet complete. Use Reassign to reset a module
          for a user when critical policies change.
        </p>
      </Panel>

      {rows.length === 0 ? (
        <EmptyState message="No training progress records." />
      ) : (
        <DataTable
          columns={["User", "Module", "Status", "Score", "Attempts", "Completed"]}
          empty={false}
        >
          {rows.map((r) => (
            <Row key={r.id}>
              <Cell muted>{staffName(staff, r.user_id)}</Cell>
              <Cell muted>
                {r.training_modules ? `Module ${r.training_modules.module_number} — ${r.training_modules.title}` : r.module_id}
              </Cell>
              <Cell muted>
                <StatusBadge
                  tone={r.status === "completed" ? "success" : r.status === "in_progress" ? "info" : "neutral"}
                >
                  {r.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </StatusBadge>
              </Cell>
              <Cell muted>{r.score != null ? `${r.score}%` : "—"}</Cell>
              <Cell muted>{r.attempts}</Cell>
              <Cell muted>{r.completed_at ? formatDateTime(r.completed_at) : "—"}</Cell>
              <Cell>
                {can("training.manage") && r.status !== "completed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reassign.mutate({ moduleId: r.module_id, userId: r.user_id })}
                  >
                    Reassign
                  </Button>
                )}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}

function text(value: string | null | undefined) {
  return value && value.trim() !== "" ? value : "—";
}

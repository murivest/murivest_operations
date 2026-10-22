import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { newTables, listStaff, staffName } from "@/lib/queries";
import { formatDateTime, formatMoney, friendlyError, text } from "@/lib/format";
import {
  DataTable,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  Row,
  Cell,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/app/admin/commission")({
  component: AdminCommissionPage,
});

type CommissionRecord = {
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

const STATUS_TONE = {
  approved: "success",
  rejected: "danger",
  paid: "info",
  pending_review: "warning",
} as const;

function AdminCommissionPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState<CommissionRecord | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-commission-records"],
    queryFn: async () => {
      const { data, error } = await newTables
        .from("commission_records")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CommissionRecord[];
    },
  });

  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });

  const review = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await newTables
        .from("commission_records")
        .update({
          status: decision,
          calculated_amount: decision === "approved" ? Number(amount) : null,
          reviewed_by: auth.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Commission record reviewed.");
      queryClient.invalidateQueries({ queryKey: ["admin-commission-records"] });
      queryClient.invalidateQueries({ queryKey: ["commission-records"] });
      setReviewing(null);
      setAmount("");
      setNote("");
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to review this record.")),
  });

  const markPaid = useMutation({
    mutationFn: async ({ id, reference }: { id: string; reference: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await newTables
        .from("commission_records")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          paid_by: auth.user?.id ?? null,
          payment_reference: reference || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Commission marked as paid.");
      queryClient.invalidateQueries({ queryKey: ["admin-commission-records"] });
      queryClient.invalidateQueries({ queryKey: ["commission-records"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to mark this record as paid.")),
  });

  if (isLoading) return <LoadingState label="Loading commission records…" />;

  const rows = data ?? [];
  const pending = rows.filter((r) => r.status === "pending_review");
  const approvedUnpaid = rows.filter((r) => r.status === "approved" && !r.paid_at);
  const paidTotal = rows
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + (r.calculated_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commission records"
        description="Review commission-eligible contributions, approve amounts and record payments."
      />

      <Panel title="Overview">
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard label="Total records" value={rows.length} />
          <StatCard label="Awaiting review" value={pending.length} tone="warning" />
          <StatCard label="Approved, unpaid" value={approvedUnpaid.length} />
          <StatCard label="Paid to date" value={formatMoney(paidTotal)} tone="success" />
        </div>
      </Panel>

      {rows.length === 0 ? (
        <EmptyState
          message="No commission records."
          hint="Records appear here once a deal contribution is submitted for review."
        />
      ) : (
        <DataTable
          columns={["Advisor", "Transaction", "Agreement", "Amount", "Status", "Submitted", ""]}
          empty={false}
        >
          {rows.map((r) => (
            <Row key={r.id}>
              <Cell>
                <p className="font-medium">{staffName(staff, r.user_id)}</p>
                <Cell muted>{text(staff?.find((s) => s.id === r.user_id)?.email)}</Cell>
              </Cell>
              <Cell muted>{text(r.transaction_reference)}</Cell>
              <Cell muted>{r.agreement_version}</Cell>
              <Cell muted>
                {r.calculated_amount != null
                  ? formatMoney(r.calculated_amount, r.currency)
                  : "—"}
              </Cell>
              <Cell muted>
                <StatusBadge tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                  {r.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </StatusBadge>
              </Cell>
              <Cell muted>{formatDateTime(r.created_at)}</Cell>
              <Cell>
                <div className="flex gap-1">
                  {can("commission.review") && r.status === "pending_review" && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setReviewing(r);
                        setAmount(r.calculated_amount != null ? String(r.calculated_amount) : "");
                        setNote("");
                      }}
                    >
                      Review
                    </Button>
                  )}
                  {can("commission.manage") &&
                    r.status === "approved" &&
                    !r.paid_at && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          markPaid.mutate({ id: r.id, reference: `PAY-${r.id.slice(0, 8)}` })
                        }
                      >
                        Mark paid
                      </Button>
                    )}
                </div>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      <Dialog open={!!reviewing} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review commission record</DialogTitle>
            <DialogDescription>
              {text(reviewing?.transaction_reference)} — {text(reviewing?.contribution)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label={`Calculated amount (${reviewing?.currency ?? "KES"})`}>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="Review note">
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Basis for the approved amount, or the reason for rejection."
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => reviewing && review.mutate({ id: reviewing.id, decision: "rejected" })}
            >
              Reject
            </Button>
            <Button
              onClick={() => reviewing && review.mutate({ id: reviewing.id, decision: "approved" })}
              disabled={review.isPending}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

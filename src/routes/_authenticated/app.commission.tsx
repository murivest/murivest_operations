import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listCommissionRecords, newTables } from "@/lib/queries";
import { formatMoney, formatDateTime, friendlyError, text } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  Row,
  Cell,
  StatusBadge,
} from "@/components/app/ui-kit";

export const Route = createFileRoute("/_authenticated/app/commission")({
  component: CommissionPage,
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

function CommissionPage() {
  const { profile, role, can } = useAuth();
  const isAdmin = can("commission.manage") || can("commission.review") || role === "managing_director";

  const { data, isLoading } = useQuery({
    queryKey: ["commission-records"],
    queryFn: async () => {
      let query = newTables.from("commission_records").select("*").order("created_at", { ascending: false });
      if (!isAdmin) {
        query = query.eq("user_id", (await supabase.auth.getUser()).data.user?.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as CommissionRecord[];
    },
  });

  if (isLoading) return <LoadingState label="Loading commission records…" />;

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commission records"
        description="Track your commission-eligible contributions under the written engagement agreement."
      />

      <Panel title="Important">
        <p className="text-sm text-muted-foreground">
          Commission is payable only under the signed written agreement, on qualifying closed
          transactions. A closed deal triggers a review workflow — it does not automatically
          create a commission amount, salary, or promotion. Future paid employment is a potential
          opportunity, not a guarantee.
        </p>
      </Panel>

      {rows.length === 0 ? (
        <EmptyState message="No commission records." hint="Records appear here once a deal contribution is submitted for review." />
      ) : (
        <DataTable
          columns={["Transaction", "Contribution", "Agreement", "Amount", "Status", "Submitted", ""]}
          empty={false}
        >
          {rows.map((r) => (
            <Row key={r.id}>
              <Cell muted>{text(r.transaction_reference)}</Cell>
              <Cell muted>{text(r.contribution)}</Cell>
              <Cell muted>{r.agreement_version}</Cell>
              <Cell muted>
                {r.calculated_amount != null ? formatMoney(r.calculated_amount, r.currency) : "—"}
              </Cell>
              <Cell muted>
                <StatusBadge
                  tone={
                    r.status === "approved"
                      ? "success"
                      : r.status === "rejected"
                        ? "danger"
                        : r.status === "paid"
                          ? "info"
                          : "warning"
                  }
                >
                  {r.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </StatusBadge>
              </Cell>
              <Cell muted>{formatDateTime(r.created_at)}</Cell>
              <Cell>
                {isAdmin && (
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/app/admin/commission">Manage</Link>
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

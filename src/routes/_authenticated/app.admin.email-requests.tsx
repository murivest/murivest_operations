import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { newTables, listStaff, staffName } from "@/lib/queries";
import { formatDateTime, friendlyError, text } from "@/lib/format";
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

export const Route = createFileRoute("/_authenticated/app/admin/email-requests")({
  component: AdminEmailRequestsPage,
});

type EmailRequest = {
  id: string;
  user_id: string;
  country_id: string | null;
  current_email: string | null;
  requested_prefix: string;
  display_name: string;
  role: string;
  business_justification: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_note: string | null;
  provisioned_email: string | null;
  created_at: string;
  updated_at: string;
  countries?: { display_name: string } | null;
};

const STATUS_TONE = {
  approved: "success",
  rejected: "danger",
  provisioned: "info",
  pending: "warning",
} as const;

function AdminEmailRequestsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [deciding, setDeciding] = useState<EmailRequest | null>(null);
  const [provisioned, setProvisioned] = useState("");
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-email-requests"],
    queryFn: async () => {
      const { data, error } = await newTables
        .from("email_requests")
        .select("*, countries(display_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EmailRequest[];
    },
  });

  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });

  const decide = useMutation({
    mutationFn: async ({
      id,
      status,
      note,
      provisionedEmail,
    }: {
      id: string;
      status: "approved" | "rejected";
      note: string;
      provisionedEmail?: string;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await newTables
        .from("email_requests")
        .update({
          status,
          decision_note: note || null,
          reviewed_by: auth.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          provisioned_email: provisionedEmail || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Email request updated.");
      queryClient.invalidateQueries({ queryKey: ["admin-email-requests"] });
      queryClient.invalidateQueries({ queryKey: ["email-requests"] });
      setDeciding(null);
      setProvisioned("");
      setNote("");
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to update this request.")),
  });

  if (isLoading) return <LoadingState label="Loading email requests…" />;
  const rows = data ?? [];  const pending = rows.filter((r) => r.status === "pending");
  const approved = rows.filter((r) => r.status === "approved");
  const rejected = rows.filter((r) => r.status === "rejected");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email requests"
        description="Approve or reject employee requests for company email addresses."
      />

      <Panel title="Overview">
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard label="Total requests" value={rows.length} />
          <StatCard label="Awaiting decision" value={pending.length} tone="warning" />
          <StatCard label="Approved" value={approved.length} tone="success" />
          <StatCard label="Rejected" value={rejected.length} tone="destructive" />
        </div>
      </Panel>

      {rows.length === 0 ? (
        <EmptyState message="No email requests." hint="Requests will appear here." />
      ) : (
        <DataTable
          columns={["Name", "Country", "Prefix", "Justification", "Status", "Submitted", ""]}
          empty={false}
        >
          {rows.map((r) => (
            <Row key={r.id}>
              <Cell>
                <p className="font-medium">{staffName(staff, r.user_id)}</p>
                <Cell muted>{text(staff?.find((s) => s.id === r.user_id)?.email)}</Cell>
              </Cell>
              <Cell muted>{text(r.countries?.display_name)}</Cell>
              <Cell muted>{r.requested_prefix}</Cell>
              <Cell muted>{text(r.business_justification)}</Cell>
              <Cell muted>
                <StatusBadge tone={STATUS_TONE[r.status as keyof typeof STATUS_TONE] ?? "neutral"}>
                  {r.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </StatusBadge>
              </Cell>
              <Cell muted>{formatDateTime(r.created_at)}</Cell>
              <Cell>
                {can("email_requests.manage") && r.status === "pending" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setDeciding(r);
                      setProvisioned("");
                      setNote("");
                    }}
                  >
                    Review
                  </Button>
                )}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      <Dialog open={!!deciding} onOpenChange={(open) => !open && setDeciding(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review email request</DialogTitle>
            <DialogDescription>
              {staffName(staff, deciding?.user_id)} — requested prefix{" "}
              {deciding?.requested_prefix}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Provisioned company email (optional)">
              <Input
                type="email"
                value={provisioned}
                onChange={(e) => setProvisioned(e.target.value)}
                placeholder={`${deciding?.requested_prefix ?? "name"}@murivest.com`}
              />
            </Field>
            <Field label="Decision note">
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for the decision, or provisioning instructions."
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                deciding &&
                decide.mutate({ id: deciding.id, status: "rejected", note })
              }
            >
              Reject
            </Button>
            <Button
              onClick={() =>
                deciding &&
                decide.mutate({
                  id: deciding.id,
                  status: "approved",
                  note,
                  provisionedEmail: provisioned,
                })
              }
              disabled={decide.isPending}
            >
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

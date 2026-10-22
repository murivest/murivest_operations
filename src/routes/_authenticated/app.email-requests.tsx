import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listCountries, listStaff, newTables, staffName } from "@/lib/queries";
import { formatDateTime, friendlyError, text } from "@/lib/format";
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
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/email-requests")({
  component: EmailRequestsPage,
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

function EmailRequestsPage() {
  const { profile, role, can } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const isAdmin = can("email_requests.manage") || role === "managing_director";

  const { data: requests, isLoading } = useQuery({
    queryKey: ["email-requests"],
    queryFn: async () => {
      let query = newTables
        .from("email_requests")
        .select("*, countries(display_name)")
        .order("created_at", { ascending: false });
      if (!isAdmin) {
        query = query.eq("user_id", (await supabase.auth.getUser()).data.user?.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as EmailRequest[];
    },
  });

  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: listCountries });
  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });

  const submit = useMutation({
    mutationFn: async () => {
      const form = document.getElementById("email-request-form") as HTMLFormElement;
      const fd = new FormData(form);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in.");
      const { error } = await newTables.from("email_requests").insert({
        user_id: auth.user.id,
        country_id: fd.get("country_id") || null,
        current_email: fd.get("current_email") || null,
        requested_prefix: fd.get("requested_prefix") as string,
        display_name: fd.get("display_name") as string,
        role: fd.get("role") as string,
        business_justification: fd.get("business_justification") as string,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Email request submitted.");
      queryClient.invalidateQueries({ queryKey: ["email-requests"] });
      setOpen(false);
      (document.getElementById("email-request-form") as HTMLFormElement).reset();
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to submit request.")),
  });

  const decide = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await newTables
        .from("email_requests")
        .update({
          status,
          decision_note: note || null,
          reviewed_by: auth.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request updated.");
      queryClient.invalidateQueries({ queryKey: ["email-requests"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to update request.")),
  });

  if (isLoading) return <LoadingState label="Loading email requests…" />;

  const rows = requests ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company email requests"
        description={
          isAdmin
            ? "Review and approve employee requests for company email addresses."
            : "Request a company email address for your role."
        }
        actions={
          !isAdmin ? (
            <Button onClick={() => setOpen(true)}>+ Request email</Button>
          ) : null
        }
      />

      <Panel title="How it works">
        <p className="text-sm text-muted-foreground">
          Submit your requested email prefix and business justification. An administrator reviews
          and provisions the address through the company's email provider. Mailbox credentials are
          never stored in this system.
        </p>
      </Panel>

      {!isAdmin && !open && (
        <Panel title="Submit a request">
          <p className="text-sm text-muted-foreground mb-4">
            Provide the details below. Your request will be reviewed by the Managing Director or
            operations administrator.
          </p>
          <Button onClick={() => setOpen(true)}>+ Request company email</Button>
        </Panel>
      )}

      {rows.length === 0 ? (
        <EmptyState message="No email requests." hint="Requests will appear here." />
      ) : (
        <DataTable
          columns={["Name", "Email", "Country", "Requested prefix", "Status", "Submitted", ""]}
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
              <Cell muted>
                <StatusBadge
                  tone={
                    r.status === "approved"
                      ? "success"
                      : r.status === "rejected"
                        ? "danger"
                        : r.status === "provisioned"
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
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() =>
                        decide.mutate({ id: r.id, status: "approved", note: "" })
                      }
                      disabled={r.status !== "pending"}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        decide.mutate({ id: r.id, status: "rejected", note: "" })
                      }
                      disabled={r.status !== "pending"}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      {!isAdmin && open && (
        <form id="email-request-form" onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }} className="space-y-4 p-4 border rounded-md surface">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Country</label>
              <select
                name="country_id"
                defaultValue=""
                className="border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none"
              >
                <option value="">Select country</option>
                {(countries ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Current platform email</label>
              <input
                name="current_email"
                type="email"
                defaultValue={profile?.email ?? ""}
                className="border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-foreground">Requested email prefix</label>
              <input
                name="requested_prefix"
                placeholder="e.g. firstname.lastname"
                className="border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-foreground">Preferred display name</label>
              <input
                name="display_name"
                defaultValue={profile?.full_name}
                className="border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-foreground">Role</label>
              <input
                name="role"
                defaultValue="Junior Capital Advisor"
                className="border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium text-foreground">Business justification</label>
              <textarea
                name="business_justification"
                rows={3}
                placeholder="Why do you need a company email address?"
                className="border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none"
              ></textarea>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

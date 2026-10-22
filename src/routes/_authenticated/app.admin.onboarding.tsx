import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { callRpc, listCountries, listStaff, newTables, staffName } from "@/lib/queries";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/admin/onboarding")({
  component: AdminOnboardingPage,
});

type OnboardingRow = {
  id: string;
  user_id: string;
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

function AdminOnboardingPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [countryId, setCountryId] = useState<string>("");
  const [supervisorId, setSupervisorId] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-onboarding"],
    queryFn: async () => {
      const { data, error } = await newTables
        .from("onboarding_status")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OnboardingRow[];
    },
  });

  const { data: staff } = useQuery({ queryKey: ["staff"], queryFn: listStaff });
  const { data: countries } = useQuery({ queryKey: ["countries"], queryFn: listCountries });

  const approve = useMutation({
    mutationFn: async () => {
      const { error } = await callRpc("approve_onboarding", {
        _user_id: selectedUserId,
        _country_id: countryId,
        _supervisor_id: supervisorId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Onboarding approved and access activated.");
      queryClient.invalidateQueries({ queryKey: ["admin-onboarding"] });
      setOpen(false);
      setSelectedUserId("");
      setCountryId("");
      setSupervisorId("");
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to approve onboarding.")),
  });

  if (isLoading) return <LoadingState label="Loading onboarding records…" />;

  const rows = data ?? [];
  const pending = rows.filter(
    (r) => r.status === "terms_accepted" || r.status === "approved" || r.status === "applicant",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding management"
        description="Review Junior Capital Advisor applications, approve engagements, and assign countries and supervisors."
        actions={
          can("onboarding.manage") ? (
            <Button onClick={() => setOpen(true)}>+ Approve application</Button>
          ) : null
        }
      />

      <Panel title="How it works">
        <p className="text-sm text-muted-foreground">
          Applications move through: applicant → terms_accepted → approved → active. Operational
          access is only granted after a country and supervisor are assigned. Training completion
          is tracked separately in Training management.
        </p>
      </Panel>

      {rows.length === 0 ? (
        <EmptyState message="No onboarding records." hint="New applications will appear here." />
      ) : (
        <DataTable
          columns={["Name", "Email", "Status", "Country", "Terms accepted", "Approved", "Operational"]}
          empty={false}
        >
          {rows.map((r) => (
            <Row key={r.id}>
              <Cell>
                <p className="font-medium">{staffName(staff, r.user_id)}</p>
                <p className="text-xs text-muted-foreground">
                  {text(staff?.find((s) => s.id === r.user_id)?.email)}
                </p>
              </Cell>
              <Cell muted>
                <StatusBadge
                  tone={
                    r.status === "active" || r.status === "approved"
                      ? "success"
                      : r.status === "terms_accepted"
                        ? "warning"
                        : r.status === "suspended" || r.status === "offboarded"
                          ? "danger"
                          : "neutral"
                  }
                >
                  {r.status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </StatusBadge>
              </Cell>
              <Cell muted>{text(r.country_id ? "Assigned" : "—")}</Cell>
              <Cell muted>
                {r.terms_accepted_at ? formatDateTime(r.terms_accepted_at) : "—"}
              </Cell>
              <Cell muted>{r.approved_at ? formatDateTime(r.approved_at) : "—"}</Cell>
              <Cell muted>
                {r.operational_access_granted_at
                  ? formatDateTime(r.operational_access_granted_at)
                  : "—"}
              </Cell>
              {can("onboarding.manage") && (
                <Cell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedUserId(r.user_id);
                      setOpen(true);
                    }}
                  >
                    Assign
                  </Button>
                </Cell>
              )}
            </Row>
          ))}
        </DataTable>
      )}

      {can("onboarding.manage") && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve onboarding</DialogTitle>
              <DialogDescription>
                Select the applicant, then assign a country and supervisor to activate
                operational access.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Applicant</label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select applicant" />
                  </SelectTrigger>
                  <SelectContent>
                    {pending.map((r) => (
                      <SelectItem key={r.user_id} value={r.user_id}>
                        {staffName(staff, r.user_id)} — {text(staff?.find((s) => s.id === r.user_id)?.email)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Country</label>
                <Select value={countryId} onValueChange={setCountryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {(countries ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Supervisor</label>
                <Select value={supervisorId} onValueChange={setSupervisorId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {(staff ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.full_name || s.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => approve.mutate()}
                disabled={approve.isPending || !selectedUserId || !countryId}
              >
                {approve.isPending ? "Approving…" : "Approve & activate access"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

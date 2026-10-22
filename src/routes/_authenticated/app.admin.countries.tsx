import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { listCountries, newTables } from "@/lib/queries";
import { formatDateTime, friendlyError } from "@/lib/format";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Input,
} from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/admin/countries")({
  component: AdminCountriesPage,
});

type CountryRow = {
  id: string;
  code: string;
  name: string;
  display_name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function AdminCountriesPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-countries"],
    queryFn: listCountries,
  });

  const upsertCountry = useMutation({
    mutationFn: async () => {
      const form = document.getElementById("country-form") as HTMLFormElement;
      const fd = new FormData(form);
      const id = editingId;
      if (id) {
        const { error } = await newTables
          .from("countries")
          .update({
            name: fd.get("name") as string,
            display_name: fd.get("display_name") as string,
            active: fd.get("active") === "true",
          })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await newTables.from("countries").insert({
          code: fd.get("code") as string,
          name: fd.get("name") as string,
          display_name: fd.get("display_name") as string,
          active: fd.get("active") === "true",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Country saved.");
      queryClient.invalidateQueries({ queryKey: ["admin-countries"] });
      setOpen(false);
      setEditingId(null);
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to save country.")),
  });

  const deleteCountry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await newTables.from("countries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Country deactivated.");
      queryClient.invalidateQueries({ queryKey: ["admin-countries"] });
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to deactivate country.")),
  });

  if (isLoading) return <LoadingState label="Loading countries…" />;

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Country workspaces"
        description="Configure the countries in which Junior Capital Advisors operate. Additional countries can be added here without code changes."
        actions={
          can("countries.manage") ? (
            <Button onClick={() => { setEditingId(null); setOpen(true); }}>
              + Add country
            </Button>
          ) : null
        }
      />

      <Panel title="About country workspaces">
        <p className="text-sm text-muted-foreground">
          Each country workspace tracks assigned employees, supervisors, tasks, properties,
          inquiries, and content. Country assignments are enforced through database row-level
          security, not just frontend filters. Display names are configurable — do not append
          "Ltd" or "LLC" unless the legal entity has been verified.
        </p>
      </Panel>

      {rows.length === 0 ? (
        <EmptyState message="No countries configured." />
      ) : (
        <DataTable
          columns={["Code", "Name", "Display name", "Active", "Created"]}
          empty={false}
        >
          {rows.map((r) => (
            <Row key={r.id}>
              <Cell muted>{r.code}</Cell>
              <Cell>{r.name}</Cell>
              <Cell muted>{r.display_name}</Cell>
              <Cell muted>
                <StatusBadge tone={r.active ? "success" : "neutral"}>
                  {r.active ? "Active" : "Inactive"}
                </StatusBadge>
              </Cell>
              <Cell muted>{formatDateTime(r.created_at)}</Cell>
              <Cell>
                <div className="flex gap-1">
                  {can("countries.manage") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditingId(r.id); setOpen(true); }}
                    >
                      Edit
                    </Button>
                  )}
                  {can("countries.manage") && rows.length > 1 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteCountry.mutate(r.id)}
                    >
                      Deactivate
                    </Button>
                  )}
                </div>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}

      {can("countries.manage") && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Save country</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit country" : "Add country"}
              </DialogTitle>
              <DialogDescription>
                Configure a country workspace for Junior Capital Advisor operations.
              </DialogDescription>
            </DialogHeader>
            <form id="country-form" onSubmit={(e) => { e.preventDefault(); upsertCountry.mutate(); }} className="space-y-4 p-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Country code</label>
                <input
                  name="code"
                  defaultValue={editingId ? (rows.find((r) => r.id === editingId)?.code ?? "") : ""}
                  disabled={!!editingId}
                  className="border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Country name</label>
                <input
                  name="name"
                  defaultValue={editingId ? (rows.find((r) => r.id === editingId)?.name ?? "") : ""}
                  className="border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Display name</label>
                <input
                  name="display_name"
                  defaultValue={editingId ? (rows.find((r) => r.id === editingId)?.display_name ?? "") : ""}
                  placeholder="e.g. Murivest Kenya"
                  className="border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Active</label>
                <select
                  name="active"
                  defaultValue="true"
                  className="border border-border rounded-md px-3 py-2 bg-background text-sm focus:outline-none"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={upsertCountry.isPending}>
                  {upsertCountry.isPending ? "Saving…" : "Save country"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

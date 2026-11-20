import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PROPERTY_STATUS, PROPERTY_TYPES, REVIEW_STATUS, optionsOf } from "@/lib/constants";
import { formatMoney, text } from "@/lib/format";
import {
  Cell,
  DataTable,
  EmptyState,
  LoadingState,
  PageHeader,
  Row,
  SearchInput,
  StatusBadge,
  statusTone,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/properties/")({
  component: PropertiesPage,
});

const ALL = "all";

interface PropertyRow {
  id: string;
  name: string;
  reference: string | null;
  location: string | null;
  city: string | null;
  property_type: string | null;
  price: number | null;
  price_currency: string | null;
  status: string;
  review_status: keyof typeof REVIEW_STATUS | null;
  updated_at: string;
}

function PropertiesPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [type, setType] = useState(ALL);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["properties", status, type],
    queryFn: async () => {
      // Only fetch the columns the table uses — faster loads, smaller payload.
      let query = supabase
        .from("properties")
        .select(
          "id, name, reference, location, city, property_type, price, price_currency, status, review_status, updated_at",
        )
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

      if (status !== ALL)
        query = query.eq(
          "status",
          status as "draft" | "internal_review" | "approved" | "published" | "needs_update" | "archived",
        );
      if (type !== ALL) query = query.eq("property_type", type);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PropertyRow[];
    },
  });

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data ?? [];

    return (data ?? []).filter((p) =>
      [p.name, p.reference, p.location, p.city]
        .filter((v): v is string => typeof v === "string" && v.length > 0)
        .some((v) => v.toLowerCase().includes(needle)),
    );
  }, [data, search]);

  const total = data?.length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Properties"
        description="Asset register for published listings. Work done on these listings is recorded in the Work Log and paid through your Wallet."
        actions={
          can("worklog.create") ? (
            <Button asChild size="sm">
              <Link to="/app/work-log">+ Log Work Done</Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, reference…"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {optionsOf(PROPERTY_STATUS).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48" aria-label="Filter by type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {PROPERTY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {rows.length === total
          ? `${total} ${total === 1 ? "property" : "properties"}`
          : `${rows.length} of ${total} properties`}
      </p>

      {isLoading ? (
        <LoadingState label="Loading properties…" />
      ) : isError ? (
        <EmptyState
          message="Could not load properties."
          hint={(error as Error)?.message ?? "Try refreshing the page."}
        />
      ) : (
        <DataTable
          columns={["Property", "Type", "Location", "Price", "Status", "Review", ""]}
          empty={rows.length === 0}
        >
          {rows.map((p) => (
            <Row key={p.id}>
              <Cell>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">{text(p.reference)}</p>
              </Cell>
              <Cell muted>{text(p.property_type)}</Cell>
              <Cell muted>{text(p.location || p.city)}</Cell>
              <Cell muted>{formatMoney(p.price, p.price_currency ?? "KES")}</Cell>
              <Cell>
                <StatusBadge tone={statusTone(p.status)}>
                  {PROPERTY_STATUS[p.status as keyof typeof PROPERTY_STATUS] ?? p.status}
                </StatusBadge>
              </Cell>
              <Cell muted>
                {p.review_status
                  ? REVIEW_STATUS[p.review_status] ?? p.review_status
                  : "—"}
              </Cell>
              <Cell>
                <Link
                  to="/app/properties/$propertyId"
                  params={{ propertyId: p.id }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Open
                </Link>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}
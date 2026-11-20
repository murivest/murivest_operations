import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client2";
import {
  Cell,
  DataTable,
  LoadingState,
  PageHeader,
  Row,
  SearchInput,
  StatusBadge,
  statusTone,
} from "@/components/app/ui-kit";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/website/subscriptions")({
  component: WebsiteSubscriptionsPage,
});

const ALL = "all";

const PERIODS = {
  "7d": { label: "Last 7 days", days: 7 },
  "28d": { label: "Last 28 days", days: 28 },
  "3m": { label: "Last 3 months", days: 90 },
  "6m": { label: "Last 6 months", days: 180 },
  ytd: { label: "Year to date", days: null },
  all: { label: "All time", days: null },
} as const;

type PeriodKey = keyof typeof PERIODS;

type WebsiteSubscription = {
  id: string;
  source_created_at: string;
  country_code: string;
  status: string;
  email: string;
  source: string | null;
  campaign: string | null;
};

const COUNTRY_NAMES: Record<string, string> = {
  KE: "Kenya", GB: "United Kingdom", US: "United States", AE: "United Arab Emirates", NG: "Nigeria",
};

const STATUS_TONE: Record<string, Parameters<typeof statusTone>[0]> = {
  Active: "success",
  Subscribed: "success",
  Unsubscribed: "danger",
  Bounced: "danger",
  Pending: "info",
};

const STATUS_OPTIONS = ["Active", "Subscribed", "Unsubscribed", "Bounced", "Pending"];

function sinceDate(period: PeriodKey): string | null {
  const now = new Date();
  const config = PERIODS[period];
  if (config.days !== null) {
    return new Date(now.getTime() - config.days * 24 * 60 * 60 * 1000).toISOString();
  }
  if (period === "ytd") {
    return new Date(now.getFullYear(), 0, 1).toISOString();
  }
  return null;
}

function breakdown(map: Map<string, number>, total: number) {
  return [...map.entries()]
    .map(([name, count]) => ({
      name,
      count,
      share: total ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function BreakdownList({ items, emptyLabel }: { items: { name: string; count: number; share: number }[]; emptyLabel: string }) {
  if (items.length === 0) return <p className="px-5 py-6 text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <div className="space-y-3 px-5 py-4">
      {items.map((item) => (
        <div key={item.name}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{item.name}</span>
            <span className="text-xs text-muted-foreground">{item.count} ({item.share}%)</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded bg-muted">
            <div className="h-full bg-[#0B3D2E]" style={{ width: `${item.share}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ✅ Removed `export` to satisfy TanStack Router code-splitting
function WebsiteSubscriptionsPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodKey>("28d");
  const [country, setCountry] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState("");

  // -------------------------------------------------------
  // FETCH SUBSCRIPTIONS
  // -------------------------------------------------------
  const {
    data: subscriptions = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<WebsiteSubscription[]>({
    queryKey: ["website-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          id,
          email,
          status,
          created_at,
          country_id,
          countries ( code, name ),
          subscription_sources ( source, medium, campaign, page_url )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Subscriptions fetch failed:", error);
        throw error;
      }

      return (data ?? []).map((row: any) => {
        const country = Array.isArray(row.countries) ? row.countries[0] : row.countries;
        const sources = Array.isArray(row.subscription_sources) ? row.subscription_sources[0] : row.subscription_sources;

        return {
          id: row.id,
          email: row.email,
          status: row.status,
          source_created_at: row.created_at,
          country_code: country?.code ?? "UNKNOWN",
          source: sources?.source ?? null,
          campaign: sources?.campaign ?? null,
        };
      });
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // -------------------------------------------------------
  // REALTIME LISTENER
  // -------------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel("murivest-subscriptions-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "subscriptions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["website-subscriptions"] });
          toast.success("New subscriber received");
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "subscriptions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["website-subscriptions"] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // -------------------------------------------------------
  // STATISTICS & ANALYSIS
  // -------------------------------------------------------
  const stats = useMemo(() => {
    const since = sinceDate(period);
    const inPeriod = subscriptions.filter(
      (sub) => !since || new Date(sub.source_created_at).getTime() >= new Date(since).getTime()
    );
    
    const total = inPeriod.length;
    const byCountry = new Map<string, number>();
    const byStatus = new Map<string, number>();
    const bySource = new Map<string, number>();

    for (const sub of inPeriod) {
      byCountry.set(sub.country_code, (byCountry.get(sub.country_code) ?? 0) + 1);
      byStatus.set(sub.status, (byStatus.get(sub.status) ?? 0) + 1);
      
      const src = sub.source?.trim() || "Direct / Unknown";
      bySource.set(src, (bySource.get(src) ?? 0) + 1);
    }

    const countries = breakdown(byCountry, total).map((b) => ({
      code: b.name,
      name: COUNTRY_NAMES[b.name] ?? b.name,
      count: b.count,
      share: b.share,
    }));

    const activeCount = byStatus.get("Active") ?? byStatus.get("Subscribed") ?? 0;
    const activeRate = total ? Math.round((activeCount / total) * 100) : 0;

    return {
      total,
      countries,
      statuses: breakdown(byStatus, total),
      sources: breakdown(bySource, total).slice(0, 6),
      top: countries[0],
      activeCount,
      activeRate,
    };
  }, [subscriptions, period]);

  // -------------------------------------------------------
  // FILTERS
  // -------------------------------------------------------
  const rows = useMemo(() => {
    const since = sinceDate(period);
    const normalizedSearch = search.trim().toLowerCase();

    return subscriptions
      .filter((sub) => !since || new Date(sub.source_created_at).getTime() >= new Date(since).getTime())
      .filter((sub) => country === ALL || sub.country_code === country)
      .filter((sub) => status === ALL || sub.status === status)
      .filter((sub) => {
        if (!normalizedSearch) return true;
        return [sub.email].filter(Boolean).some((val) => val.toLowerCase().includes(normalizedSearch));
      });
  }, [subscriptions, period, country, status, search]);

  // -------------------------------------------------------
  // DASHBOARD
  // -------------------------------------------------------
  return (
    <div className="space-y-5">
      <PageHeader
        title="Website Subscriptions"
        description="Manage investor newsletter and market update subscribers."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">Unable to load subscriptions.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "An unexpected database error occurred."}
          </p>
          <Button className="mt-3" variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      )}

      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={(value) => setPeriod(value as PeriodKey)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PERIODS).map(([key, item]) => (
              <SelectItem key={key} value={key}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All countries</SelectItem>
            {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
              <SelectItem key={code} value={code}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUS_OPTIONS.map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SearchInput value={search} onChange={setSearch} placeholder="Search email address…" />
      </div>

      {/* STATISTICS */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Subscribers · {PERIODS[period].label}</p>
          <p className="mt-2 text-3xl font-semibold">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Active Rate</p>
          <p className="mt-2 text-3xl font-semibold">{stats.activeRate}%</p>
          <p className="text-xs text-muted-foreground">{stats.activeCount} active of {stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Top Country</p>
          <p className="mt-2 text-3xl font-semibold">{stats.top ? stats.top.name : "—"}</p>
          {stats.top && <p className="text-xs text-muted-foreground">{stats.top.count} subscribers ({stats.top.share}%)</p>}
        </div>
      </div>

      {/* DEEP ANALYSIS */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card">
          <div className="border-b px-5 py-3 text-sm font-medium">Status breakdown</div>
          <BreakdownList items={stats.statuses} emptyLabel="No data in this period." />
        </div>
        <div className="rounded-lg border bg-card">
          <div className="border-b px-5 py-3 text-sm font-medium">Top Acquisition Sources</div>
          <BreakdownList items={stats.sources} emptyLabel="No source data." />
        </div>
        <div className="rounded-lg border bg-card">
          <div className="border-b px-5 py-3 text-sm font-medium">Top Countries</div>
          <BreakdownList items={stats.countries} emptyLabel="No country data." />
        </div>
      </div>

      {/* SUBSCRIBERS TABLE */}
      {isLoading ? (
        <LoadingState label="Loading subscriptions…" />
      ) : (
        <DataTable columns={["Subscribed", "Email", "Country", "Source", "Status"]} empty={rows.length === 0}>
          {rows.map((sub) => (
            <Row key={sub.id}>
              <Cell muted className="whitespace-nowrap text-xs">{formatDateTime(sub.source_created_at)}</Cell>
              <Cell>
                <p className="font-medium">{sub.email}</p>
              </Cell>
              <Cell muted>{COUNTRY_NAMES[sub.country_code] ?? sub.country_code}</Cell>
              <Cell muted>
                <p>{sub.source ?? "Direct"}</p>
                {sub.campaign && <p className="text-xs text-muted-foreground">{sub.campaign}</p>}
              </Cell>
              <Cell>
                <StatusBadge tone={STATUS_TONE[sub.status] ?? "neutral"}>{sub.status}</StatusBadge>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated/app/website-inquiries")({
  component: WebsiteInquiriesPage,
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

type WebsiteInquiry = {
  id: string;
  source_created_at: string;
  country_code: string;
  status: string;
  name: string; // Fallback applied since DB schema lacks this
  email: string;
  phone: string | null;
  reference: string;
  investment_range: string | null;
  property_type: string | null;
};

type WebsiteNotification = {
  id: string;
  is_read: boolean;
  title?: string | null;
  created_at?: string;
};

const COUNTRY_NAMES: Record<string, string> = {
  KE: "Kenya",
  GB: "United Kingdom",
  US: "United States",
  AE: "United Arab Emirates",
  NG: "Nigeria",
};

const STATUS_TONE: Record<string, Parameters<typeof statusTone>[0]> = {
  New: "info",
  Unread: "info",
  Contacted: "neutral",
  Qualified: "success",
  Converted: "success",
  Lost: "danger",
  Archived: "neutral",
};

const STATUS_OPTIONS = [
  "New", "Unread", "Contacted", "Qualified", "Converted", "Lost", "Archived",
];

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

function BreakdownList({
  items,
  emptyLabel,
}: {
  items: { name: string; count: number; share: number }[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="px-5 py-6 text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3 px-5 py-4">
      {items.map((item) => (
        <div key={item.name}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{item.name}</span>
            <span className="text-xs text-muted-foreground">
              {item.count} ({item.share}%)
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded bg-muted">
            <div className="h-full bg-[#0B3D2E]" style={{ width: `${item.share}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ✅ Removed `export` here to fix the TanStack Router warning
function WebsiteInquiriesPage({ initialCountry = ALL }: { initialCountry?: string }) {
  const queryClient = useQueryClient();

  const [period, setPeriod] = useState<PeriodKey>("28d");
  const [country, setCountry] = useState(initialCountry);
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState("");

  // -------------------------------------------------------
  // 1. FETCH WEBSITE INQUIRIES (Exact Schema Joins)
  // -------------------------------------------------------
  const {
    data: inquiries = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<WebsiteInquiry[]>({
    queryKey: ["website-inquiries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inquiries")
        .select(`
          id,
          reference,
          status,
          created_at,
          email,
          phone,
          company,
          country_id,
          countries ( code, name ),
          inquiry_details ( investment_range, property_type ),
          inquiry_sources ( page_url, referrer, source, medium, campaign )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Website inquiries fetch failed:", error);
        throw error;
      }

      // Flatten the relational data for the UI
      return (data ?? []).map((row: any) => {
        const details = Array.isArray(row.inquiry_details) ? row.inquiry_details[0] : row.inquiry_details;
        const country = Array.isArray(row.countries) ? row.countries[0] : row.countries;
        
        // DB schema lacks a "name" column. Using company or email prefix as fallback.
        const displayName = row.company || row.email.split("@")[0] || "Unknown";

        return {
          id: row.id,
          reference: row.reference,
          status: row.status,
          source_created_at: row.created_at,
          country_code: country?.code ?? "UNKNOWN",
          name: displayName,
          email: row.email,
          phone: row.phone,
          investment_range: details?.investment_range ?? null,
          property_type: details?.property_type ?? null,
        };
      });
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // -------------------------------------------------------
  // 2. FETCH WEBSITE NOTIFICATIONS 
  // (Graceful fallback since table is missing in schema)
  // -------------------------------------------------------
  const { data: notifications = [], isLoading: notificationsLoading } = useQuery<
    WebsiteNotification[]
  >({
    queryKey: ["website-notifications"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("website_notifications" as any)
          .select("id, is_read, title, created_at")
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) throw error;
        return (data ?? []) as unknown as WebsiteNotification[];
      } catch (err) {
        // Fail silently if the table doesn't exist in Supabase
        return [];
      }
    },
    staleTime: 30_000,
  });

  // -------------------------------------------------------
  // 3. SUPABASE REALTIME LISTENERS
  // -------------------------------------------------------
  useEffect(() => {
    const channel = supabase
      .channel("murivest-website-inquiries-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "inquiries" },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["website-inquiries"] });
          toast.success("New website enquiry received");
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "inquiries" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["website-inquiries"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // -------------------------------------------------------
  // 4. MARK NOTIFICATIONS AS READ
  // -------------------------------------------------------
  const markAllRead = async () => {
    const unreadIds = notifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from("website_notifications" as any)
      .update({ is_read: true })
      .in("id", unreadIds);

    if (error) {
      toast.error("Could not mark notifications as read.");
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["website-notifications"] });
    toast.success("Notifications marked as read.");
  };

  // -------------------------------------------------------
  // 5. STATISTICS & ANALYSIS
  // -------------------------------------------------------
  const stats = useMemo(() => {
    const since = sinceDate(period);
    const inPeriod = inquiries.filter(
      (inquiry) =>
        !since || new Date(inquiry.source_created_at).getTime() >= new Date(since).getTime(),
    );

    const total = inPeriod.length;
    const byCountry = new Map<string, number>();
    const byStatus = new Map<string, number>();
    const byRange = new Map<string, number>();
    const byType = new Map<string, number>();

    for (const inquiry of inPeriod) {
      byCountry.set(inquiry.country_code, (byCountry.get(inquiry.country_code) ?? 0) + 1);
      byStatus.set(inquiry.status, (byStatus.get(inquiry.status) ?? 0) + 1);

      const range = inquiry.investment_range?.trim() || "Not specified";
      byRange.set(range, (byRange.get(range) ?? 0) + 1);

      const type = inquiry.property_type?.trim() || "Not specified";
      byType.set(type, (byType.get(type) ?? 0) + 1);
    }

    const countries = breakdown(byCountry, total).map((b) => ({
      code: b.name,
      name: COUNTRY_NAMES[b.name] ?? b.name,
      count: b.count,
      share: b.share,
    }));

    const unread = notifications.filter((notification) => !notification.is_read).length;
    const convertedCount = byStatus.get("Converted") ?? 0;
    const conversionRate = total ? Math.round((convertedCount / total) * 100) : 0;
    const newCount = byStatus.get("New") ?? 0;

    return {
      total, countries, statuses: breakdown(byStatus, total),
      ranges: breakdown(byRange, total).slice(0, 6),
      types: breakdown(byType, total).slice(0, 6),
      unread, top: countries[0], convertedCount, conversionRate, newCount,
    };
  }, [inquiries, notifications, period]);

  // -------------------------------------------------------
  // 6. FILTERS
  // -------------------------------------------------------
  const rows = useMemo(() => {
    const since = sinceDate(period);
    const normalizedSearch = search.trim().toLowerCase();

    return inquiries
      .filter((inquiry) => !since || new Date(inquiry.source_created_at).getTime() >= new Date(since).getTime())
      .filter((inquiry) => country === ALL || inquiry.country_code === country)
      .filter((inquiry) => status === ALL || inquiry.status === status)
      .filter((inquiry) => {
        if (!normalizedSearch) return true;
        return [inquiry.name, inquiry.email, inquiry.phone, inquiry.reference]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedSearch));
      });
  }, [inquiries, period, country, status, search]);

  // -------------------------------------------------------
  // 7. DASHBOARD
  // -------------------------------------------------------
  return (
    <div className="space-y-5">
      <PageHeader
        title="Website Inquiries"
        description="Live enquiries from murivest.com across all country pages, delivered in real time."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? "Refreshing..." : "Refresh"}
            </Button>
            {stats.unread > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead} disabled={notificationsLoading}>
                Mark all read ({stats.unread})
              </Button>
            )}
          </div>
        }
      />

      {isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">Unable to load website enquiries.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "An unexpected database error occurred."}
          </p>
          <Button className="mt-3" variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
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

        <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, reference…" />
      </div>

      {/* STATISTICS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Inquiries · {PERIODS[period].label}</p>
          <p className="mt-2 text-3xl font-semibold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">{stats.newCount} new</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Unread notifications</p>
          <p className="mt-2 text-3xl font-semibold">{stats.unread}</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Top country</p>
          <p className="mt-2 text-3xl font-semibold">{stats.top ? stats.top.name : "—"}</p>
          {stats.top && <p className="text-xs text-muted-foreground">{stats.top.count} inquiries ({stats.top.share}%)</p>}
        </div>
        <div className="rounded-lg border bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Conversion rate</p>
          <p className="mt-2 text-3xl font-semibold">{stats.conversionRate}%</p>
          <p className="text-xs text-muted-foreground">{stats.convertedCount} converted of {stats.total}</p>
        </div>
      </div>

      {/* PERFORMANCE BY COUNTRY */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-5 py-3 text-sm font-medium">Performance by country · {PERIODS[period].label}</div>
        {isLoading ? (
          <LoadingState label="Loading country performance…" />
        ) : stats.countries.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No website inquiries in this period yet.</p>
        ) : (
          <DataTable columns={["Country", "Inquiries", "Share"]} empty={false}>
            {stats.countries.map((item) => (
              <Row key={item.code}>
                <Cell className="font-medium">
                  <Link to="/app/website/inquiries/$country" params={{ country: item.code }} className="underline-offset-4 hover:underline">
                    {item.name}
                  </Link>
                </Cell>
                <Cell>{item.count}</Cell>
                <Cell>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-40 overflow-hidden rounded bg-muted">
                      <div className="h-full bg-[#0B3D2E]" style={{ width: `${item.share}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{item.share}%</span>
                  </div>
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </div>

      {/* DEEP ANALYSIS — STATUS / RANGE / TYPE */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card">
          <div className="border-b px-5 py-3 text-sm font-medium">Status breakdown · {PERIODS[period].label}</div>
          <BreakdownList items={stats.statuses} emptyLabel="No inquiries in this period yet." />
        </div>
        <div className="rounded-lg border bg-card">
          <div className="border-b px-5 py-3 text-sm font-medium">Top investment ranges · {PERIODS[period].label}</div>
          <BreakdownList items={stats.ranges} emptyLabel="No investment range data yet." />
        </div>
        <div className="rounded-lg border bg-card">
          <div className="border-b px-5 py-3 text-sm font-medium">Top property types · {PERIODS[period].label}</div>
          <BreakdownList items={stats.types} emptyLabel="No property type data yet." />
        </div>
      </div>

      {/* WEBSITE INQUIRIES TABLE */}
      {isLoading ? (
        <LoadingState label="Loading website inquiries…" />
      ) : (
        <DataTable columns={["Received", "Reference", "Investor", "Country", "Range / Type", "Status", ""]} empty={rows.length === 0}>
          {rows.map((inquiry) => (
            <Row key={inquiry.id}>
              <Cell muted className="whitespace-nowrap text-xs">{formatDateTime(inquiry.source_created_at)}</Cell>
              <Cell><span className="font-mono text-xs">{inquiry.reference}</span></Cell>
              <Cell>
                <p className="font-medium">{inquiry.name}</p>
                <p className="text-xs text-muted-foreground">{inquiry.email}</p>
                {inquiry.phone && <p className="text-xs text-muted-foreground">{inquiry.phone}</p>}
              </Cell>
              <Cell muted>{COUNTRY_NAMES[inquiry.country_code] ?? inquiry.country_code}</Cell>
              <Cell muted>
                {inquiry.investment_range ?? "—"}
                {inquiry.property_type && <p className="text-xs">{inquiry.property_type}</p>}
              </Cell>
              <Cell>
                <StatusBadge tone={STATUS_TONE[inquiry.status] ?? "neutral"}>{inquiry.status}</StatusBadge>
              </Cell>
              <Cell>
                <Link to="/app/website-inquiries-detail" search={{ id: inquiry.id }} className="text-sm font-medium text-[#0B3D2E] underline-offset-4 hover:underline">
                  View
                </Link>
              </Cell>
            </Row>
          ))}
        </DataTable>
      )}
    </div>
  );
}
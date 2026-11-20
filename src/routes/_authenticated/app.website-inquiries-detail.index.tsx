import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client2";
import {
  LoadingState,
  PageHeader,
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

// ---------------------------------------------------------------------------
// Route — accepts ?id=<inquiryId>. If no id is provided, shows a picker with
// recent inquiries so the page is useful when deep-linked on its own.
// ---------------------------------------------------------------------------
type DetailSearch = { id?: string };

export const Route = createFileRoute("/_authenticated/app/website-inquiries-detail/")({
  validateSearch: (search: Record<string, unknown>): DetailSearch => {
    const id = search["id"];
    return typeof id === "string" && id.length > 0 ? { id } : {};
  },
  component: WebsiteInquiryDetailPage,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type WebsiteInquiryDetail = {
  id: string;
  reference: string;
  source_created_at: string;
  created_at?: string | null;
  updated_at?: string | null;
  country_code: string;
  status: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
  investment_range?: string | null;
  property_type?: string | null;
  budget?: string | null;
  objectives?: string | null;
  page_url?: string | null;
  referrer?: string | null;
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  marketing_consent?: boolean | null;
};

type RecentInquiry = {
  id: string;
  reference: string;
  name: string;
  country_code: string;
  status: string;
  source_created_at: string;
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
  "New",
  "Unread",
  "Contacted",
  "Qualified",
  "Converted",
  "Lost",
  "Archived",
];

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Could not copy ${label.toLowerCase()}`);
  }
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm break-words ${mono ? "font-mono" : ""}`}>
        {value === null || value === undefined || value === "" ? "—" : value}
      </p>
    </div>
  );
}

function Card({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-5 py-3 text-sm font-medium">
        <span>{title}</span>
        {actions}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
function WebsiteInquiryDetailPage() {
  const { id } = Route.useSearch();
  const queryClient = useQueryClient();
  const [statusUpdating, setStatusUpdating] = useState(false);

  // -------------------------------------------------------
  // 1. FETCH THE SELECTED INQUIRY (full row)
  // -------------------------------------------------------
  const {
    data: inquiry,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<WebsiteInquiryDetail | null>({
    queryKey: ["website-inquiry", id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("inquiries" as any)
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error("Website inquiry detail fetch failed:", error);
        throw error;
      }

      return (data ?? null) as unknown as WebsiteInquiryDetail | null;
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  // -------------------------------------------------------
  // 2. RECENT LIST (only used when no id is provided)
  // -------------------------------------------------------
  const { data: recent = [], isLoading: recentLoading } = useQuery<RecentInquiry[]>({
    queryKey: ["website-inquiries-recent"],
    enabled: !id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("website_inquiries" as any)
        .select("id, reference, name, country_code, status, source_created_at")
        .order("source_created_at", { ascending: false })
        .limit(15);

      if (error) throw error;
      return (data ?? []) as unknown as RecentInquiry[];
    },
    staleTime: 30_000,
  });

  // -------------------------------------------------------
  // 3. REALTIME — keep this single inquiry in sync
  // -------------------------------------------------------
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`website-inquiry-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "website_inquiries",
          filter: `id=eq.${id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["website-inquiry", id] });
          queryClient.invalidateQueries({ queryKey: ["website-inquiries"] });
        },
      )
      .subscribe((channelStatus) => {
        if (channelStatus === "CHANNEL_ERROR") {
          console.error("Could not subscribe to inquiry detail realtime.");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  // -------------------------------------------------------
  // 4. STATUS UPDATE
  // -------------------------------------------------------
  const updateStatus = async (nextStatus: string) => {
    if (!id || !inquiry || inquiry.status === nextStatus) return;

    setStatusUpdating(true);

    const { error } = await supabase
      .from("website_inquiries" as any)
      .update({ status: nextStatus })
      .eq("id", id);

    setStatusUpdating(false);

    if (error) {
      console.error("Status update failed:", error);
      toast.error("Could not update status.");
      return;
    }

    toast.success(`Status updated to ${nextStatus}`);
    queryClient.invalidateQueries({ queryKey: ["website-inquiry", id] });
    queryClient.invalidateQueries({ queryKey: ["website-inquiries"] });
  };

  // -------------------------------------------------------
  // 5. EMPTY STATE — no id in the URL
  // -------------------------------------------------------
  if (!id) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Website Inquiry Detail"
          description="Select an inquiry to view its full record."
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/website-inquiries">Back to inquiries</Link>
            </Button>
          }
        />

        <Card title="Recent inquiries">
          {recentLoading ? (
            <LoadingState label="Loading recent inquiries…" />
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inquiries yet.</p>
          ) : (
            <ul className="divide-y">
              {recent.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{row.reference}</span>
                      {" · "}
                      {COUNTRY_NAMES[row.country_code] ?? row.country_code}
                      {" · "}
                      {formatDateTime(row.source_created_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge tone={STATUS_TONE[row.status] ?? "neutral"}>
                      {row.status}
                    </StatusBadge>
                    <Link
                      to="/app/website-inquiries-detail"
                      search={{ id: row.id }}
                      className="text-sm font-medium text-[#0B3D2E] underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------
  // 6. LOADING / ERROR
  // -------------------------------------------------------
  if (isLoading) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Website Inquiry Detail"
          description="Loading the inquiry record…"
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/website-inquiries">Back to inquiries</Link>
            </Button>
          }
        />
        <LoadingState label="Loading inquiry…" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Website Inquiry Detail"
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/website-inquiries">Back to inquiries</Link>
            </Button>
          }
        />
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="font-medium text-destructive">Unable to load this inquiry.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "An unexpected database error occurred."}
          </p>
          <Button className="mt-3" variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!inquiry) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Website Inquiry Detail"
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/website-inquiries">Back to inquiries</Link>
            </Button>
          }
        />
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm font-medium">Inquiry not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This record may have been removed, or the link is stale.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------
  // 7. FULL DETAIL VIEW
  // -------------------------------------------------------
  const countryName = COUNTRY_NAMES[inquiry.country_code] ?? inquiry.country_code;

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Inquiry ${inquiry.reference}`}
        description={`${inquiry.name} · ${countryName} · received ${formatDateTime(
          inquiry.source_created_at,
        )}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyText(inquiry.reference, "Reference")}
            >
              Copy reference
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`mailto:${inquiry.email}`}>Email investor</a>
            </Button>
            {inquiry.phone && (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${inquiry.phone}`}>Call investor</a>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/website-inquiries">Back to inquiries</Link>
            </Button>
          </div>
        }
      />

      {/* STATUS + META STRIP */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Status</span>
          <StatusBadge tone={STATUS_TONE[inquiry.status] ?? "neutral"}>
            {inquiry.status}
          </StatusBadge>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Update status</span>
          <Select
            value={inquiry.status}
            onValueChange={updateStatus}
            disabled={statusUpdating}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* CONTACT + ENQUIRY */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Contact"
          actions={
            <button
              type="button"
              onClick={() => copyText(inquiry.email, "Email")}
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Copy email
            </button>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" value={inquiry.name} />
            <Field label="Company" value={inquiry.company} />
            <Field
              label="Email"
              value={
                <a className="text-[#0B3D2E] hover:underline" href={`mailto:${inquiry.email}`}>
                  {inquiry.email}
                </a>
              }
            />
            <Field
              label="Phone"
              value={
                inquiry.phone ? (
                  <a className="text-[#0B3D2E] hover:underline" href={`tel:${inquiry.phone}`}>
                    {inquiry.phone}
                  </a>
                ) : null
              }
            />
            <Field label="Country" value={countryName} />
            <Field label="Marketing consent" value={inquiry.marketing_consent ? "Yes" : "No"} />
          </div>
        </Card>

        <Card title="Enquiry">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Investment range" value={inquiry.investment_range} />
            <Field label="Property type" value={inquiry.property_type} />
            <Field label="Budget" value={inquiry.budget} />
            <Field label="Objectives" value={inquiry.objectives} />
            <div className="sm:col-span-2">
              <Field
                label="Message"
                value={
                  inquiry.message ? (
                    <span className="whitespace-pre-wrap leading-relaxed">{inquiry.message}</span>
                  ) : null
                }
              />
            </div>
          </div>
        </Card>
      </div>

      {/* ATTRIBUTION */}
      <Card title="Attribution">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Source" value={inquiry.source} />
          <Field label="Medium" value={inquiry.medium} />
          <Field label="Campaign" value={inquiry.campaign} />
          <Field
            label="Landing page"
            value={
              inquiry.page_url ? (
                <a
                  className="break-all text-[#0B3D2E] hover:underline"
                  href={inquiry.page_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {inquiry.page_url}
                </a>
              ) : null
            }
          />
          <Field label="Referrer" value={inquiry.referrer} />
          <Field label="Reference" value={inquiry.reference} mono />
        </div>
      </Card>

      {/* METADATA */}
      <Card title="Metadata">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Received" value={formatDateTime(inquiry.source_created_at)} />
          <Field
            label="Created"
            value={inquiry.created_at ? formatDateTime(inquiry.created_at) : null}
          />
          <Field
            label="Updated"
            value={inquiry.updated_at ? formatDateTime(inquiry.updated_at) : null}
          />
          <Field label="Record ID" value={inquiry.id} mono />
        </div>
      </Card>
    </div>
  );
}
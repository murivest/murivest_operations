import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";

import { PageHeader, Panel, DataTable, Row, Cell, EmptyState, LoadingState, SearchInput, StatusBadge } from "@/components/app/ui-kit";
import { Card } from "@/components/ui/card";

type AuctionBid = { id: string; bidder: string; amount: number; property: string; date: string; status: string };

function AuctionsPage() {
  const [search, setSearch] = useState("");
  const [bids] = useState<AuctionBid[]>([]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Auctions back-office"
        description="Manage auctions.murivest.com — bids, communications, registrations, and daily activity reports."
      />
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Active auctions</p>
          <p className="mt-1 text-2xl font-semibold">0</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total bids</p>
          <p className="mt-1 text-2xl font-semibold">0</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Registrations</p>
          <p className="mt-1 text-2xl font-semibold">0</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">New comms today</p>
          <p className="mt-1 text-2xl font-semibold">0</p>
        </Card>
      </div>
      <Panel title="Recent bids" description="Latest bids received across all auction properties.">
        <div className="mb-3 flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search bidder, property…" />
        </div>
        {bids.length === 0 ? (
          <EmptyState message="No bids yet" hint="Bids will appear here once auctions go live." />
        ) : (
          <DataTable columns={["Bidder", "Property", "Amount", "Date", "Status"]}>
            {bids.map((b) => (
              <Row key={b.id}>
                <Cell>{b.bidder}</Cell>
                <Cell>{b.property}</Cell>
                <Cell>{b.amount.toLocaleString()}</Cell>
                <Cell muted>{b.date}</Cell>
                <Cell>
                  <StatusBadge tone={b.status === "accepted" ? "success" : "neutral"}>{b.status}</StatusBadge>
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </Panel>
      <Panel title="Daily activity report" description="Staff submit daily reports of bids, communications, and registrations.">
        <form className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">Date</span>
              <input type="date" className="w-full rounded border border-border px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">Staff member</span>
              <input type="text" className="w-full rounded border border-border px-3 py-2 text-sm" placeholder="Your name" />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">New bids</span>
            <textarea className="w-full rounded border border-border px-3 py-2 text-sm" rows={2} placeholder="Summary of new bids received today" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">New communications</span>
            <textarea className="w-full rounded border border-border px-3 py-2 text-sm" rows={2} placeholder="Summary of new communications" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium">New registrations</span>
            <textarea className="w-full rounded border border-border px-3 py-2 text-sm" rows={2} placeholder="Summary of new registrations" />
          </label>
          <button type="submit" className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Submit daily report
          </button>
        </form>
      </Panel>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/auctions")({
  component: AuctionsPage,
});

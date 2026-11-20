import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { PageHeader, Panel, DataTable, Row, Cell, EmptyState, SearchInput } from "@/components/app/ui-kit";

type AuctionProperty = { id: string; title: string; reserve: number; currentBid: number; bids: number; status: string; endDate: string };

function AuctionPropertiesPage() {
  const [search, setSearch] = useState("");
  const [properties] = useState<AuctionProperty[]>([]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Auction properties"
        description="Properties listed for auction on auctions.murivest.com."
        actions={
          <button className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
            <Plus className="size-4" /> Add property
          </button>
        }
      />
      <Panel title="All auction properties">
        <div className="mb-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search property…" />
        </div>
        {properties.length === 0 ? (
          <EmptyState message="No auction properties yet" hint="Add a property to start an auction." />
        ) : (
          <DataTable columns={["Property", "Reserve", "Current bid", "Bids", "Ends", "Status"]}>
            {properties.map((p) => (
              <Row key={p.id}>
                <Cell>{p.title}</Cell>
                <Cell>{p.reserve.toLocaleString()}</Cell>
                <Cell>{p.currentBid.toLocaleString()}</Cell>
                <Cell>{p.bids}</Cell>
                <Cell muted>{p.endDate}</Cell>
                <Cell>
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">{p.status}</span>
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </Panel>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/auctions/properties" as never)({
  component: AuctionPropertiesPage,
});

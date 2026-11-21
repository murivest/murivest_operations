import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Upload, Users, FileText } from "lucide-react";

import { PageHeader, Panel, EmptyState, StatusBadge } from "@/components/app/ui-kit";

function InvestorPortalAdminPage() {
  const [tab, setTab] = useState<"investors" | "communications" | "content">("investors");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Investor portal admin"
        description="Back-end administration for investors.murivest.com — onboarding, documents, communications, content sync."
      />
      <div className="flex gap-2 border-b border-border pb-2">
        {(["investors", "communications", "content"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === "investors" && (
        <Panel title="Investor accounts" description="New investors synced from the portal; review and approve.">
          <EmptyState message="No investors yet" hint="New investor registrations will appear here for review." />
        </Panel>
      )}
      {tab === "communications" && (
        <Panel title="Communications" description="Reply to investor communications.">
          <EmptyState message="No communications" hint="Investor messages will appear here." />
        </Panel>
      )}
      {tab === "content" && (
        <Panel title="Content sync" description="Sync properties and documents to the investor portal. Monthly report of numbers and data submitted monthly.">
          <EmptyState message="No sync jobs" hint="Trigger a sync to push updates to investors.murivest.com." />
        </Panel>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/admin/investors-portal")({
  component: InvestorPortalAdminPage,
});

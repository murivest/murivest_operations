import { createFileRoute } from "@tanstack/react-router";

import { PlannedFeaturePage } from "@/components/app/PlannedFeaturePage";

export const Route = createFileRoute("/_authenticated/app/admin/portal/activity")({
  component: () => (
    <PlannedFeaturePage
      title="Portal activity"
      description="Investor portal access and document activity."
    />
  ),
});

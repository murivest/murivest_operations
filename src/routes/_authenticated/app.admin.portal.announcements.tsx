import { createFileRoute } from "@tanstack/react-router";

import { PlannedFeaturePage } from "@/components/app/PlannedFeaturePage";

export const Route = createFileRoute("/_authenticated/app/admin/portal/announcements")({
  component: () => (
    <PlannedFeaturePage
      title="Announcements"
      description="Investor-facing announcements and publication controls."
    />
  ),
});

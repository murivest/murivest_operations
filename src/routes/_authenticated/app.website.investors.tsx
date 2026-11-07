import { createFileRoute } from "@tanstack/react-router";

import { PlannedFeaturePage } from "@/components/app/PlannedFeaturePage";

export const Route = createFileRoute("/_authenticated/app/website/investors")({
  component: () => (
    <PlannedFeaturePage
      title="Investor leads"
      description="Investor lead management from website submissions."
    />
  ),
});

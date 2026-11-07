import { createFileRoute } from "@tanstack/react-router";

import { PlannedFeaturePage } from "@/components/app/PlannedFeaturePage";

export const Route = createFileRoute("/_authenticated/app/website/analytics")({
  component: () => (
    <PlannedFeaturePage
      title="Lead analytics"
      description="Website lead trends and market performance."
    />
  ),
});

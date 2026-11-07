import { createFileRoute } from "@tanstack/react-router";

import { PlannedFeaturePage } from "@/components/app/PlannedFeaturePage";

export const Route = createFileRoute("/_authenticated/app/website/subscriptions")({
  component: () => (
    <PlannedFeaturePage
      title="Subscriptions"
      description="Website subscription records and consent management."
    />
  ),
});

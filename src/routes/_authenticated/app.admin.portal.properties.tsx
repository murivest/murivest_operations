import { createFileRoute } from "@tanstack/react-router";

import { PlannedFeaturePage } from "@/components/app/PlannedFeaturePage";

export const Route = createFileRoute("/_authenticated/app/admin/portal/properties")({
  component: () => (
    <PlannedFeaturePage
      title="Featured properties"
      description="Property features and visibility in the investor portal."
    />
  ),
});

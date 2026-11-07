import { createFileRoute } from "@tanstack/react-router";

import { PlannedFeaturePage } from "@/components/app/PlannedFeaturePage";

export const Route = createFileRoute("/_authenticated/app/admin/investors")({
  component: () => (
    <PlannedFeaturePage
      title="Investor accounts"
      description="Investor account administration for the investor portal."
    />
  ),
});

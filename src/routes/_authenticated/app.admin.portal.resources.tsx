import { createFileRoute } from "@tanstack/react-router";

import { PlannedFeaturePage } from "@/components/app/PlannedFeaturePage";

export const Route = createFileRoute("/_authenticated/app/admin/portal/resources")({
  component: () => (
    <PlannedFeaturePage
      title="Resource management"
      description="Investor portal resources, categories, and visibility."
    />
  ),
});

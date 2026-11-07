import { createFileRoute } from "@tanstack/react-router";

import { PlannedFeaturePage } from "@/components/app/PlannedFeaturePage";

export const Route = createFileRoute("/_authenticated/app/admin/portal/documents")({
  component: () => (
    <PlannedFeaturePage
      title="Portal documents"
      description="Investor document publishing, assignment, and access history."
    />
  ),
});

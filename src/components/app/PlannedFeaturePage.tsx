import type { ReactNode } from "react";

import { PageHeader, Panel, EmptyState } from "@/components/app/ui-kit";

interface PlannedFeaturePageProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

export function PlannedFeaturePage({ title, description, actions }: PlannedFeaturePageProps) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} actions={actions} />
      <Panel title={title} description={description}>
        <EmptyState
          message="Not yet available"
          hint="This feature is planned for a future release."
        />
      </Panel>
    </div>
  );
}

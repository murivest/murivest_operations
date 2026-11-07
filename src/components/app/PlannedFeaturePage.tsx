import { PageHeader, Panel, StatusBadge } from "@/components/app/ui-kit";

export function PlannedFeaturePage({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description} />
      <Panel>
        <div className="space-y-3">
          <StatusBadge tone="info">Planned</StatusBadge>
          <p className="text-sm text-muted-foreground">
            This page is a navigation placeholder. Its data and management features have not been
            implemented.
          </p>
        </div>
      </Panel>
    </div>
  );
}

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Upload, FileText } from "lucide-react";

import { PageHeader, Panel, EmptyState } from "@/components/app/ui-kit";

function InvestorStudioPage() {
  const [files, setFiles] = useState<File[]>([]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Investor studio"
        description="Upload and manage documents, properties, and content for the investor portal."
      />
      <Panel title="Upload documents / properties" description="Studio for uploading content to investors.murivest.com.">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded border border-dashed border-border p-8 text-center hover:bg-accent">
          <Upload className="size-8 text-muted-foreground" />
          <span className="mt-2 text-sm font-medium">Click to select files</span>
          <span className="text-xs text-muted-foreground">PDF, DOCX, images supported</span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>
        {files.length > 0 && (
          <ul className="mt-3 space-y-1">
            {files.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-muted-foreground" />
                {f.name}
                <span className="text-xs text-muted-foreground">({Math.round(f.size / 1024)} KB)</span>
              </li>
            ))}
          </ul>
        )}
        {files.length > 0 && (
          <button className="mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Upload {files.length} file(s)
          </button>
        )}
      </Panel>
      <Panel title="Uploaded content" description="Previously uploaded documents and properties.">
        <EmptyState message="No content uploaded yet" hint="Uploads will appear here." />
      </Panel>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/admin/investors-studio")({
  component: InvestorStudioPage,
});

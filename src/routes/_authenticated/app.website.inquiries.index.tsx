import { createFileRoute } from "@tanstack/react-router";

import { WebsiteInquiriesPage } from "./app.website-inquiries";

export const Route = createFileRoute("/_authenticated/app/website/inquiries/")({
  component: WebsiteInquiriesPage,
});

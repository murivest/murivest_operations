import { createFileRoute } from "@tanstack/react-router";

import { WebsiteInquiriesPage } from "./app.website-inquiries";

export const Route = createFileRoute("/_authenticated/app/website/inquiries/$country")({
  component: WebsiteCountryInquiriesPage,
});

function WebsiteCountryInquiriesPage() {
  const { country } = Route.useParams();
  return <WebsiteInquiriesPage key={country} initialCountry={country.toUpperCase()} />;
}

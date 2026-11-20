import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { flushEmailQueue } from "@/lib/email-dispatch";
import { PROPERTY_STATUS, PROPERTY_TYPES, REVIEW_STATUS, optionsOf } from "@/lib/constants";
import {
  formatDateTime,
  formatMoney,
  formatNumber,
  friendlyError,
  text,
} from "@/lib/format";
import {
  DetailItem,
  EmptyState,
  Field,
  LoadingState,
  PageHeader,
  Panel,
  StatusBadge,
  statusTone,
} from "@/components/app/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/properties/$propertyId")({
  component: PropertyDetailPage,
});

// Every field is a string in the form so we can round-trip nulls cleanly
// and don't have to juggle number/string unions per keystroke.
interface PropertyForm {
  name: string;
  reference: string;
  property_type: string;
  location: string;
  city: string;
  county: string;
  address: string;
  tenure: string;
  description: string;
  investment_summary: string;
  investment_highlights: string;
  location_advantages: string;
  asset_characteristics: string;
  income_information: string;
  seller_information: string;
  internal_notes: string;
  internal_valuation: string;
  primary_image_url: string;
  price: string;
  annual_income: string;
  monthly_income: string;
  yield_percent: string;
  occupancy: string;
  land_size: string;
  building_size: string;
  units: string;
}

const EMPTY_FORM: PropertyForm = {
  name: "",
  reference: "",
  property_type: "Warehouse",
  location: "",
  city: "",
  county: "",
  address: "",
  tenure: "",
  description: "",
  investment_summary: "",
  investment_highlights: "",
  location_advantages: "",
  asset_characteristics: "",
  income_information: "",
  seller_information: "",
  internal_notes: "",
  internal_valuation: "",
  primary_image_url: "",
  price: "",
  annual_income: "",
  monthly_income: "",
  yield_percent: "",
  occupancy: "",
  land_size: "",
  building_size: "",
  units: "",
};

function PropertyDetailPage() {
  const { propertyId } = useParams({
    from: "/_authenticated/app/properties/$propertyId",
  });
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: property,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["property", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", propertyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["property-reviews", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_reviews")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState<PropertyForm>(EMPTY_FORM);
  const [dirty, setDirty] = useState(false);

  // Reset the form whenever we land on a different property (or refetch it).
  useEffect(() => {
    if (!property) return;
    setForm(formFromProperty(property));
    setDirty(false);
  }, [property]);

  const updateField = useCallback(
    <K extends keyof PropertyForm>(key: K, value: PropertyForm[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setDirty(true);
    },
    [],
  );

  const canEdit = can("properties.edit");
  const canFinancials = can("properties.edit.financials");
  const canReview = can("properties.review");
  const canApprove = can("properties.approve");
  const canPublish = can("properties.publish");
  const canSeeConfidential = can("properties.view.confidential");

  // Invalidate only what these mutations actually touch. The old
  // queryClient.invalidateQueries() refetched every query in the app.
  const invalidateProperty = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["properties"] });
    queryClient.invalidateQueries({ queryKey: ["property", propertyId] });
  }, [queryClient, propertyId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) {
        throw new Error("Property name is required.");
      }

      const patch: Record<string, unknown> = {
        name: form.name.trim(),
        reference: form.reference.trim() || null,
        property_type: form.property_type || null,
        location: form.location.trim() || null,
        city: form.city.trim() || null,
        county: form.county.trim() || null,
        address: form.address.trim() || null,
        tenure: form.tenure.trim() || null,
        description: form.description.trim() || null,
        investment_summary: form.investment_summary.trim() || null,
        investment_highlights: form.investment_highlights.trim() || null,
        location_advantages: form.location_advantages.trim() || null,
        asset_characteristics: form.asset_characteristics.trim() || null,
        income_information: form.income_information.trim() || null,
        primary_image_url: form.primary_image_url.trim() || null,
        units: form.units ? Number(form.units) : null,
      };

      if (canFinancials) {
        patch["price"] = form.price ? Number(form.price) : null;
        patch["annual_income"] = form.annual_income ? Number(form.annual_income) : null;
        patch["monthly_income"] = form.monthly_income ? Number(form.monthly_income) : null;
        patch["yield_percent"] = form.yield_percent ? Number(form.yield_percent) : null;
        patch["occupancy"] = form.occupancy ? Number(form.occupancy) : null;
        patch["land_size"] = form.land_size.trim() || null;
        patch["building_size"] = form.building_size.trim() || null;
      }

      if (canSeeConfidential) {
        patch["seller_information"] = form.seller_information.trim() || null;
        patch["internal_notes"] = form.internal_notes.trim() || null;
        patch["internal_valuation"] = form.internal_valuation.trim() || null;
      }

      const { error } = await supabase
        .from("properties")
        .update(patch as never)
        .eq("id", propertyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Property saved.");
      setDirty(false);
      invalidateProperty();
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to save the property.")),
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const patch: Record<string, unknown> = { status };

      if (status === "approved") {
        patch['approved_at'] = new Date().toISOString();
        patch['approved_by'] = auth.user?.id ?? null;
      }
      if (status === "published") {
        patch['published_at'] = new Date().toISOString();
      }

      const { error } = await supabase
        .from("properties")
        .update(patch as never)
        .eq("id", propertyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Property status updated.");
      invalidateProperty();
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to change the status.")),
  });

  const [reviewStatus, setReviewStatus] = useState("verified");
  const [reviewComment, setReviewComment] = useState("");

  const submitReview = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in.");

      const { error: insertError } = await supabase.from("property_reviews").insert({
        property_id: propertyId,
        reviewed_by: auth.user.id,
        status: reviewStatus as never,
        comment: reviewComment.trim() || null,
      });
      if (insertError) throw insertError;

      // Preserve the existing workflow: "verified" sends the property back to
      // internal_review (waiting on approver), "needs_correction" sends it to
      // needs_update. If you want re-reviews on approved/published docs to be
      // non-destructive, change nextStatus to fall through to property.status.
      const nextStatus =
        reviewStatus === "needs_correction" ? "needs_update" : "internal_review";

      const { error: updateError } = await supabase
        .from("properties")
        .update({
          review_status: reviewStatus as never,
          reviewed_at: new Date().toISOString(),
          reviewed_by: auth.user.id,
          status: nextStatus,
        } as never)
        .eq("id", propertyId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Review recorded.");
      setReviewComment("");
      invalidateProperty();
      queryClient.invalidateQueries({
        queryKey: ["property-reviews", propertyId],
      });
      // Fire-and-forget, but catch so a queue failure doesn't become an
      // unhandled rejection in the console.
      flushEmailQueue().catch((e) =>
        console.error("Email queue flush failed:", e),
      );
    },
    onError: (e) => toast.error(friendlyError(e, "Unable to record the review.")),
  });

  if (isLoading) return <LoadingState label="Loading property…" />;

  if (isError) {
    return (
      <EmptyState
        message="Could not load property"
        hint={(error as Error)?.message ?? "Try refreshing the page."}
      />
    );
  }

  if (!property) {
    return (
      <EmptyState
        message="Property not found"
        hint="This property may have been removed or you do not have access to it."
      />
    );
  }

  const statusLabel = PROPERTY_STATUS[property.status] ?? property.status;
  const reviewLabel = property.review_status
    ? REVIEW_STATUS[property.review_status] ?? property.review_status
    : null;

  const input = (key: keyof PropertyForm, label: string) => (
    <Field label={label}>
      <Input
        value={form[key]}
        onChange={(e) => updateField(key, e.target.value)}
      />
    </Field>
  );

  const area = (key: keyof PropertyForm, label: string) => (
    <Field label={label} className="sm:col-span-2">
      <Textarea
        rows={3}
        value={form[key]}
        onChange={(e) => updateField(key, e.target.value)}
      />
    </Field>
  );

  return (
    <div className="space-y-5">
      <Link
        to="/app/properties"
        className="text-xs text-muted-foreground hover:underline"
      >
        ← Back to properties
      </Link>

      <PageHeader
        title={property.name}
        description={`${text(property.reference)} · ${text(property.property_type)} · ${text(property.location || property.city)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit && property.status === "draft" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate("internal_review")}
              >
                Submit for review
              </Button>
            ) : null}
            {canApprove &&
            (property.status === "internal_review" ||
              property.status === "needs_update") ? (
              <Button
                size="sm"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate("approved")}
              >
                Approve
              </Button>
            ) : null}
            {canPublish && property.status === "approved" ? (
              <Button
                size="sm"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate("published")}
              >
                Publish
              </Button>
            ) : null}
            {canEdit && property.status !== "archived" ? (
              <Button
                size="sm"
                variant="outline"
                disabled={setStatus.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Archive this property? It will be hidden from the active register.",
                    )
                  ) {
                    setStatus.mutate("archived");
                  }
                }}
              >
                Archive
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={statusTone(property.status)}>{statusLabel}</StatusBadge>
        {reviewLabel ? (
          <StatusBadge tone={statusTone(property.review_status ?? property.status)}>
            {reviewLabel}
          </StatusBadge>
        ) : null}
        {dirty ? (
          <span className="text-xs font-medium text-amber-600">Unsaved changes</span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          Updated {formatDateTime(property.updated_at)}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel title="Property record">
            <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
              {input("name", "Property name")}
              {input("reference", "Reference")}
              <Field label="Type">
                <Select
                  value={form.property_type}
                  onValueChange={(v) => updateField("property_type", v)}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {input("tenure", "Tenure")}
              {input("location", "Location")}
              {input("city", "City")}
              {input("county", "County")}
              {input("address", "Address")}
              {input("units", "Units")}
              {input("primary_image_url", "Primary image URL")}
              {area("description", "Description")}
              {area("investment_summary", "Investment summary")}
              {area("investment_highlights", "Investment highlights")}
              {area("location_advantages", "Location advantages")}
              {area("asset_characteristics", "Asset characteristics")}
              {area("income_information", "Income information")}
            </fieldset>
          </Panel>

          <Panel
            title="Commercial terms"
            description={
              canFinancials
                ? "Editable — financial authority granted by your role."
                : "Read-only — your role cannot edit financial fields."
            }
          >
            {canFinancials ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {input("price", "Price")}
                {input("annual_income", "Annual income")}
                {input("monthly_income", "Monthly income")}
                {input("yield_percent", "Yield (%)")}
                {input("occupancy", "Occupancy (%)")}
                {input("land_size", "Land size")}
                {input("building_size", "Building size")}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem
                  label="Price"
                  value={formatMoney(property.price, property.price_currency ?? "KES")}
                />
                <DetailItem label="Annual income" value={formatMoney(property.annual_income)} />
                <DetailItem label="Monthly income" value={formatMoney(property.monthly_income)} />
                <DetailItem label="Yield" value={formatNumber(property.yield_percent, "%")} />
                <DetailItem label="Occupancy" value={formatNumber(property.occupancy, "%")} />
                <DetailItem label="Land size" value={text(property.land_size)} />
                <DetailItem label="Building size" value={text(property.building_size)} />
              </div>
            )}
          </Panel>

          {canSeeConfidential ? (
            <Panel
              title="Confidential"
              description="Never shown to clients or public listings."
            >
              <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-2">
                {area("seller_information", "Seller information")}
                {area("internal_valuation", "Internal valuation")}
                {area("internal_notes", "Internal notes")}
              </fieldset>
            </Panel>
          ) : null}

          {canEdit ? (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => save.mutate()}
                disabled={save.isPending || !dirty}
              >
                {save.isPending ? "Saving…" : "Save changes"}
              </Button>
              {dirty && !save.isPending ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setForm(formFromProperty(property));
                    setDirty(false);
                  }}
                >
                  Discard
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          {canReview ? (
            <Panel title="Record review">
              <div className="space-y-3">
                <Field label="Outcome">
                  <Select value={reviewStatus} onValueChange={setReviewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {optionsOf(REVIEW_STATUS).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Comment">
                  <Textarea
                    rows={4}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Verification notes, corrections required, or information awaited."
                  />
                </Field>
                <Button
                  size="sm"
                  onClick={() => submitReview.mutate()}
                  disabled={submitReview.isPending}
                >
                  {submitReview.isPending ? "Saving…" : "Submit review"}
                </Button>
              </div>
            </Panel>
          ) : null}

          <Panel title="Review history">
            {(reviews ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No reviews recorded yet.</p>
            ) : (
              <ul className="space-y-3">
                {(reviews ?? []).map((r) => (
                  <li key={r.id} className="border-l-2 border-border pl-3">
                    <StatusBadge tone={statusTone(r.status)}>
                      {REVIEW_STATUS[r.status] ?? r.status}
                    </StatusBadge>
                    <p className="mt-1 text-xs text-muted-foreground">{text(r.comment)}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatDateTime(r.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

// Extracted so the reset paths (mount + Discard button) stay in sync.
function formFromProperty(p: Record<string, any>): PropertyForm {
  return {
    name: p['name'] ?? "",
    reference: p['reference'] ?? "",
    property_type: p['property_type'] ?? "Warehouse",
    location: p['location'] ?? "",
    city: p['city'] ?? "",
    county: p['county'] ?? "",
    address: p['address'] ?? "",
    tenure: p['tenure'] ?? "",
    description: p['description'] ?? "",
    investment_summary: p['investment_summary'] ?? "",
    investment_highlights: p['investment_highlights'] ?? "",
    location_advantages: p['location_advantages'] ?? "",
    asset_characteristics: p['asset_characteristics'] ?? "",
    income_information: p['income_information'] ?? "",
    seller_information: p['seller_information'] ?? "",
    internal_notes: p['internal_notes'] ?? "",
    internal_valuation: p['internal_valuation'] ?? "",
    primary_image_url: p['primary_image_url'] ?? "",
    price: p['price']?.toString() ?? "",
    annual_income: p['annual_income']?.toString() ?? "",
    monthly_income: p['monthly_income']?.toString() ?? "",
    yield_percent: p['yield_percent']?.toString() ?? "",
    occupancy: p['occupancy']?.toString() ?? "",
    land_size: p['land_size'] ?? "",
    building_size: p['building_size'] ?? "",
    units: p['units']?.toString() ?? "",
  };
}
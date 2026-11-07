declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): void;
};

// @ts-ignore Deno resolves this URL import at runtime; TypeScript may not resolve it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPECTED_SECRET = Deno.env.get("OPS_INGEST_SECRET")!;

Deno.serve(async (req) => {
  if (req.headers.get("x-integration-secret") !== EXPECTED_SECRET) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  const ev = await req.json();
  if (ev.event_type !== "contact_inquiry.created") {
    return new Response(JSON.stringify({ ok: true, skipped: ev.event_type }), { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const p = ev.payload ?? {};

  const { data: inquiry, error: insErr } = await supabase
    .from("website_inquiries")
    .upsert(
      {
        source_event_id: ev.event_id,
        reference: p.reference,
        country_code: ev.country_code,
        name: p.name,
        email: p.email,
        phone: p.phone ?? null,
        page_url: p.page_url ?? null,
        status: p.status ?? "New",
        source_created_at: ev.created_at,
      },
      { onConflict: "source_event_id" },
    )
    .select()
    .single();

  if (insErr) return new Response(JSON.stringify({ error: insErr.message }), { status: 500 });

  const { data: existing } = await supabase
    .from("website_notifications")
    .select("id")
    .eq("inquiry_id", inquiry.id)
    .limit(1);

  if (!existing?.length) {
    const names: Record<string, string> = { KE: "Kenya", GB: "UK", US: "USA", AE: "UAE", NG: "Nigeria" };
    await supabase.from("website_notifications").insert({
      title: `New ${names[ev.country_code] ?? ev.country_code} enquiry — ${p.reference}`,
      body: `${p.name} · ${p.email}${p.phone ? " · " + p.phone : ""}`,
      country_code: ev.country_code,
      inquiry_id: inquiry.id,
    });
  }

  return new Response(JSON.stringify({ ok: true, reference: p.reference }), { status: 200 });
});
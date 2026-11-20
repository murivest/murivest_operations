import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Phone, Mail } from "lucide-react";

import { PageHeader, Panel, EmptyState } from "@/components/app/ui-kit";

function LettingsPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lettings"
        description="Lettings portal for lettings.murivest.com — enquiries routed direct to phone or email."
      />
      <Panel title="Contact for lettings" description="CTA directs enquiries straight to phone or email.">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <a href="tel:+254700000000" className="flex items-center gap-3 rounded border border-border p-4 hover:bg-accent">
              <Phone className="size-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Call us</p>
                <p className="text-xs text-muted-foreground">+254 700 000 000</p>
              </div>
            </a>
            <a href="mailto:lettings@murivest.com" className="flex items-center gap-3 rounded border border-border p-4 hover:bg-accent">
              <Mail className="size-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Email us</p>
                <p className="text-xs text-muted-foreground">lettings@murivest.com</p>
              </div>
            </a>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
            className="space-y-3"
          >
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-border px-3 py-2 text-sm" required />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-border px-3 py-2 text-sm" required />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">Phone</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded border border-border px-3 py-2 text-sm" />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium">Message</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="w-full rounded border border-border px-3 py-2 text-sm" rows={3} />
            </label>
            <button type="submit" className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Send enquiry
            </button>
            {submitted ? <p className="text-xs text-success">Enquiry sent. We'll be in touch.</p> : null}
          </form>
        </div>
      </Panel>
      <Panel title="Letting enquiries" description="Recent letting enquiries received.">
        <EmptyState message="No letting enquiries yet" hint="Enquiries will appear here." />
      </Panel>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/app/lettings")({
  component: LettingsPage,
});

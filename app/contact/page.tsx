import type { Metadata } from "next";

import ContactForm from "@/components/ContactForm";
import { TrackedLink } from "@/components/finch/TrackedLink";
import { Button } from "@/components/vyso/Button";
import { Card } from "@/components/vyso/Card";
import { Section } from "@/components/vyso/Section";
import { Shell } from "@/components/vyso/Shell";
import { buildContactSchema } from "@/components/vyso/company/company-jsonld";
import { SITE } from "@/lib/marketing/site";

/* ── /contact ─────────────────────────────────────────────────────────────────
   Rebuilt for the 2026 redesign (`.ai/plan_vyso_redesign_2026.md` §7.6):
   simple, three intents, one form. Anyone who wants to book the audit is sent
   straight to `/operations-audit` (the front door, and the only place that
   booking form lives); the other two intents both land on the same general
   `ContactForm` below, because "ask a question" and "talk about an
   operational problem" want the same four fields, not two different forms.

   `ContactForm` itself is NOT rewritten (plan constraint: it's a shared
   component used by `/operations-audit`, `/academy` and a resources page too,
   `.ai/implementation_redesign_2026.md` Phase 2's off-limits list would cover
   it even where it isn't named explicitly). It's composed here inside a
   `Card`: its own `--fn-*` field styling is close enough to `--vy-line` /
   `--vy-surface` that the two systems don't visibly clash, and rewriting its
   internals to `--vy-*` would touch three other pages this task doesn't own. */

const TITLE = "Contact us in Johannesburg";
const DESCRIPTION =
  "Reach Vyso in Johannesburg to start an operations audit, ask a question, or talk through an operational problem. We reply within one business day.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE.url}/contact` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE.url}/contact`,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const INTENTS: readonly {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  label: string;
}[] = [
  {
    eyebrow: "Ready now",
    title: "Start an operations audit",
    body: "Free, about an hour, and it ends in a diagnosis rather than a quote. This is the fastest way to find out where Vyso can help.",
    href: "/operations-audit",
    label: "Book your free audit",
  },
  {
    eyebrow: "Not sure yet",
    title: "Ask a question",
    body: "About what Vyso does, how it's priced, or whether it fits a business like yours. The form below covers it.",
    href: "#message",
    label: "Send a question",
  },
  {
    eyebrow: "Thinking it through",
    title: "Talk about an operational problem",
    body: "Describe what's breaking down, stock, suppliers, admin, wastage, and we'll tell you honestly whether it sounds like something Vyso would help with.",
    href: "#message",
    label: "Describe the problem",
  },
];

export default function ContactPage() {
  return (
    <Shell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildContactSchema()).replace(/</g, "\\u003c"),
        }}
      />

      <Section
        eyebrow="Contact"
        heading="Talk to Vyso,"
        continuation="about your operation, not a demo script."
        lead="Questions about Vyso, whether it's a fit, or an operational problem you'd like a second opinion on. Send the messy version. We reply within one business day."
        headingLevel={1}
      />

      <Section id="how-can-we-help" heading="How can we help?" divider>
        <ul className="m-0 grid list-none grid-cols-1 gap-[16px] p-0 md:grid-cols-3">
          {INTENTS.map((intent) => (
            <Card key={intent.title} as="li" padding="lg" className="flex h-full flex-col">
              <span className="vy-label text-[color:var(--vy-ink-4)]">{intent.eyebrow}</span>
              <h3 className="vy-h3 mt-[12px] mb-[10px] text-[color:var(--vy-ink)]">{intent.title}</h3>
              <p className="vy-body flex-1 text-[color:var(--vy-ink-3)] text-pretty">{intent.body}</p>
              <Button href={intent.href} variant="quiet" className="mt-[18px] self-start">
                {intent.label}
              </Button>
            </Card>
          ))}
        </ul>
      </Section>

      <Section id="message-section" divider>
        <div className="grid grid-cols-1 gap-[32px] lg:grid-cols-[0.85fr_1.15fr] lg:gap-[56px]">
          <div>
            <div className="border-b border-[color:var(--vy-line)] pb-[20px]">
              <div className="vy-label mb-[8px] text-[color:var(--vy-ink-3)]">Email</div>
              <TrackedLink
                href={`mailto:${SITE.email}`}
                event="outbound_click"
                eventProps={{ href: `mailto:${SITE.email}` }}
                className="text-[16px] font-medium text-[color:var(--vy-ink)] transition-colors duration-150 hover:text-[color:var(--vy-ink-2)]"
              >
                {SITE.email}
              </TrackedLink>
            </div>
            <div className="border-b border-[color:var(--vy-line)] py-[20px]">
              <div className="vy-label mb-[8px] text-[color:var(--vy-ink-3)]">Where we are</div>
              <p className="vy-body m-0 text-[color:var(--vy-ink-3)]">
                Johannesburg, South Africa. We work with businesses across the country.
              </p>
            </div>
            <div className="pt-[20px]">
              <div className="vy-label mb-[8px] text-[color:var(--vy-ink-3)]">Response time</div>
              <p className="vy-body m-0 text-[color:var(--vy-ink-3)]">
                We reply within one business day. There&rsquo;s no automated reply pretending to
                be one of us.
              </p>
            </div>
          </div>

          <Card padding="lg" id="message">
            <h2 className="vy-h3 mb-[20px] text-[color:var(--vy-ink)]">Send us a message</h2>
            <ContactForm variant="general" />
          </Card>
        </div>
      </Section>
    </Shell>
  );
}

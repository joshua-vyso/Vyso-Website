import type { Metadata } from "next";

import { Button } from "@/components/vyso/Button";
import { Card } from "@/components/vyso/Card";
import { Reveal } from "@/components/vyso/Reveal";
import { Section } from "@/components/vyso/Section";
import { Shell } from "@/components/vyso/Shell";
import { stagger } from "@/components/vyso/stagger";
import { ChromeFrame, WhatsAppBubble } from "@/components/vyso/demo/ChromeFrame";
import { FindingCard } from "@/components/vyso/demo/FindingCard";
import { TrustPoints } from "@/components/vyso/company/TrustPoints";
import { buildSouthAfricaSchema } from "@/components/vyso/company/company-jsonld";
import { FAQ_GROUPS, type FaqItem } from "@/lib/marketing/faq";
import { SITE } from "@/lib/marketing/site";

/* ── /south-africa ────────────────────────────────────────────────────────────
   Rewritten for the 2026 redesign (`.ai/plan_vyso_redesign_2026.md` §7.6):
   AI automation for South African businesses specifically, not a Finch
   feature list translated into rand. Every claim below is either the same
   honesty line already carried on the homepage (`components/vyso/home/
   HomeTools.tsx`: Xero and WhatsApp Business connect directly today,
   everything else is designed around) or a plain description of how South
   African SMEs actually operate, grounded in the brief's own list: WhatsApp
   heavy ordering, Excel heavy record keeping, Sage and Xero as the finance
   layer, rand, VAT, EFT, POPIA, and processes that grew informally rather
   than being designed.

   The AEO answer this page opens with — "is Vyso based in South Africa" — is
   the hero's lead sentence, so an answer engine gets it without following a
   link. The FAQ subset below quotes `lib/marketing/faq.ts` verbatim, by id,
   so a South African claim can never read differently on the two pages that
   make it. */

const TITLE = "Built for South African operations";
const DESCRIPTION =
  "Vyso builds automation for South African businesses running on WhatsApp, Excel, Sage and Xero, priced around the problem and built around POPIA.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE.url}/south-africa` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE.url}/south-africa`,
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

const LOCAL_REALITIES: readonly { title: string; body: string }[] = [
  {
    title: "WhatsApp is where orders happen",
    body: "A lot of South African SMEs take orders over WhatsApp, not through a web form. Vyso reads orders sent to a WhatsApp Business number automatically, instead of asking your team or your customers to switch channels.",
  },
  {
    title: "Spreadsheets hold the business",
    body: "Stock counts, price lists and margins often live in Excel or Google Sheets, built up over years by whoever needed them next. Vyso works with those sheets rather than asking you to abandon them for a new system.",
  },
  {
    title: "Sage and Xero are the finance layer",
    body: "Xero connects directly today: invoices, bills, contacts and balances, kept in sync during onboarding. Sage isn't a live connection yet. We design around it and scope a direct connection if it's your system of record.",
  },
  {
    title: "Rand, VAT and EFT by default",
    body: "Pricing, invoicing and payments happen in rand. VAT treatment is part of every invoice, and EFT is how most business accounts actually get settled. Vyso's systems are built around that reality, not translated from a foreign template.",
  },
  {
    title: "Processes that grew informally",
    body: "Most operational knowledge lives with the people running the business, not in a written manual. We start by learning how your team actually works, not by handing over a process they're expected to adopt.",
  },
  {
    title: "Local support, not an offshore queue",
    body: "Vyso is based in Johannesburg. When something needs a person, you're talking to someone who understands the South African context your business runs in.",
  },
] as const;

/* Quoted, not restated — the same grounded answers `/faq` already carries, so
   a South African claim can never read differently on the two pages that
   make it. */
function southAfricaFaqs(): FaqItem[] {
  const byId = new Map<string, FaqItem>();
  for (const group of FAQ_GROUPS) {
    for (const item of group.questions) byId.set(item.id, item);
  }
  const ids = [
    "where-is-vyso-based",
    "does-vyso-work-outside-south-africa",
    "can-vyso-work-with-whatsapp",
    "can-vyso-connect-to-sage",
    "is-our-data-secure",
  ];
  return ids.map((id) => {
    const item = byId.get(id);
    if (!item) throw new Error(`south-africa: FAQ id "${id}" not found in lib/marketing/faq.ts.`);
    return item;
  });
}

export default function SouthAfricaPage() {
  const faqs = southAfricaFaqs();

  return (
    <Shell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildSouthAfricaSchema(faqs)).replace(/</g, "\\u003c"),
        }}
      />

      <Section
        eyebrow="Vyso in South Africa"
        heading="Built for how South African businesses"
        continuation="actually run, not the workflow a software vendor imagined."
        headingLevel={1}
      >
        <p className="vy-body-lg max-w-[640px] text-[color:var(--vy-ink-2)] text-pretty">
          Yes, Vyso is a South African company. We&rsquo;re based in Johannesburg and we build
          automated operational systems for South African SMEs: businesses running on WhatsApp,
          spreadsheets and finance software like Sage and Xero, pricing and invoicing in rand.
        </p>
        <div className="mt-[28px] flex flex-wrap gap-[16px]">
          <Button href="/operations-audit" event="book_audit_click" eventProps={{ page: "south-africa-hero" }}>
            Get your free Operations Audit
          </Button>
          <Button href="/how-it-works" variant="secondary">
            See how Vyso works
          </Button>
        </div>
      </Section>

      <Section
        id="local-realities"
        eyebrow="Local proof, not local wallpaper"
        heading="Built around how South African operations"
        continuation="actually move, not just labelled for the market."
        lead={'"Built for South Africa" should show up in the currency, the documents, the channel orders arrive on and the way work actually gets done, not just a flag in the corner.'}
        divider
      >
        <ul className="m-0 grid list-none grid-cols-1 gap-[16px] p-0 md:grid-cols-2 lg:grid-cols-3">
          {LOCAL_REALITIES.map((item, i) => (
            <Reveal key={item.title} as="li" delay={stagger(i)}>
              <Card padding="lg" className="h-full">
                <h3 className="vy-h3 mb-[8px] text-[color:var(--vy-ink)]">{item.title}</h3>
                <p className="vy-body text-[color:var(--vy-ink-3)] text-pretty">{item.body}</p>
              </Card>
            </Reveal>
          ))}
        </ul>
      </Section>

      <Section
        id="example"
        eyebrow="What this looks like"
        heading="A VAT line caught before it reached the ledger."
        lead="An illustrative example: a supplier invoice charging VAT at the wrong rate on a zero rated line item, the kind of thing that's easy to miss across dozens of invoices a month."
        divider
      >
        <div className="mx-auto flex max-w-[520px] flex-col gap-[16px]">
          <ChromeFrame variant="whatsapp" title="Fresh Fields Produce" subtitle="supplier" flat>
            <WhatsAppBubble time="14:12">Invoice INV-2291 attached for this week&rsquo;s order.</WhatsAppBubble>
          </ChromeFrame>
          <FindingCard
            state="alert"
            observation="Invoice INV-2291 applied standard rate VAT to a line item that's normally zero rated. Every other line matches the agreed terms."
            impact="One line flagged"
            evidence="INVOICE INV-2291"
            meta="VAT REVIEW"
            actions={["Review the line item", "Query the supplier"]}
          />
        </div>
      </Section>

      <Section
        id="trust"
        eyebrow="Trust, locally"
        heading="Sensible about data,"
        continuation="honest about limits."
        divider
      >
        <TrustPoints />
      </Section>

      <Section
        id="faq"
        eyebrow="Straight answers"
        heading="South African operations,"
        continuation="without vague promises."
        width="narrow"
        divider
      >
        <dl className="m-0 grid grid-cols-1 gap-[26px] md:gap-x-[48px] md:gap-y-[30px]">
          {faqs.map(({ question, answer }) => (
            <div key={question}>
              <dt className="vy-h3 mb-[7px] text-[color:var(--vy-ink)]">{question}</dt>
              <dd className="vy-body m-0 text-[color:var(--vy-ink-3)] text-pretty">{answer}</dd>
            </div>
          ))}
        </dl>
        <Button href="/faq" variant="quiet" className="mt-[24px]">
          Read the full FAQ
        </Button>
      </Section>

      <Section
        id="start"
        ground="dark"
        spacing="loose"
        align="center"
        heading="Start where the return is highest."
        lead="A free Operations Audit tells you honestly where your South African operation is leaking time, in the currency and the tools you already use."
      >
        <div className="flex flex-col items-center justify-center gap-[14px] sm:flex-row sm:gap-[20px]">
          <Button
            href="/operations-audit"
            size="lg"
            event="book_audit_click"
            eventProps={{ page: "south-africa-close" }}
          >
            Get a free Operations Audit
          </Button>
          <Button href="/industries" variant="secondary" size="lg">
            See who we build for
          </Button>
        </div>
      </Section>
    </Shell>
  );
}

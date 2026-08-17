import type { Metadata } from "next";
import Link from "next/link";

import { AuditBand } from "@/components/finch/AuditBand";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";
import { FindingCard } from "@/components/finch/FindingCard";
import { Breadcrumb, Eyebrow } from "@/components/finch/company/CompanyBits";
import { buildSouthAfricaSchema } from "@/components/finch/company/company-jsonld";
import { SouthAfricaMap } from "@/components/finch/company/SouthAfricaMap";
import { FAQ_GROUPS, type FaqItem } from "@/lib/marketing/faq";

const TITLE = "South African operations software — Finch by Vyso";
const DESCRIPTION =
  "Finch runs ZAR pricing, VAT-aware invoices and EFT, cash and card payments for South African food SMEs — R6,000 per location a month.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/south-africa" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://vyso.co.za/south-africa",
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/* ── Local capabilities ────────────────────────────────────────────────────
   Every line below is checked against real code before it's kept — grep
   citations in the comment, not a claim taken on faith from the pre-rebuild
   copy. Nothing here is a rewording of a claim the platform can't back:
   - ZAR pricing:        components/finch/pricing/pricing-data.ts (`PRICE.currency`)
   - VAT treatment:      lib/platform/orderflow-from-doc.ts (`vat_treatment`,
                          `vat_rate`), lib/platform/import-schema.ts
   - EFT/cash/card:      lib/platform/orderflow.ts `PaymentMethod`
                          ('eft' | 'cash' | 'card' | 'other')
   - Rebates/credit terms/customer PO/delivery addresses:
                          lib/platform/orderflow.ts (`rebate_pct`,
                          `credit_limit`, `customer_po`, `delivery_address_id`),
                          lib/platform/orderflow-data.ts (`cd_payment_terms`,
                          `cd_delivery_addresses`)
   - WhatsApp/email/PDF/photo intake:
                          lib/platform/whatsapp-ingest.ts, Doc-U (see
                          lib/marketing/faq.ts's own grounded answer, imported
                          below rather than restated)
   Two claims from the pre-rebuild page were dropped, not carried forward:
   "load-shedding-tolerant" (no code claim to check it against — grep for the
   term returns nothing in `lib/platform`) and a `LocalBusiness`/street-address
   schema (no public address exists to publish, per `lib/marketing/site.ts`). */
const LOCAL_CAPABILITIES = [
  {
    title: "Rands at the centre",
    copy: "Customer pricing, quotes, invoices, payments and account balances stay in ZAR — nothing translated from a foreign-first workflow.",
  },
  {
    title: "VAT-aware documents",
    copy: "Finch captures seller and customer VAT details and applies standard, zero-rated or exempt treatment to tax invoices and credit notes.",
  },
  {
    title: "Local payment reality",
    copy: "Record EFT, cash, card or other payments with a reference, then keep outstanding and overdue balances visible to the team.",
  },
  {
    title: "Customer-specific trade",
    copy: "Price lists, rebates, customer purchase orders, account terms, credit limits and delivery addresses live in the same commercial record.",
  },
  {
    title: "Messy orders, cleaner intake",
    copy: "Upload WhatsApp screenshots, email captures, PDFs or photographed orders so the information can be extracted and reviewed before it moves forward.",
  },
  {
    title: "Implemented with local context",
    copy: "Vyso combines the software with workflow mapping, data preparation, rollout and support for South African operating teams.",
  },
] as const;

const MIGRATION_STEPS = [
  {
    title: "Choose one operational problem",
    copy: "Start with the repeated admin costing the team the most time or creating the most uncertainty.",
  },
  {
    title: "Move only the data the workflow needs",
    copy: "Agree which customer, product and price-list records belong in the first rollout instead of a risky big-bang migration.",
  },
  {
    title: "Run, learn and expand",
    copy: "Put the focused workflow into real use, refine it with the team, and add the next module only once the next need is clear.",
  },
] as const;

/* Imported, not restated — the same grounded answers `/faq` already carries,
   so a South African claim can never read differently on the two pages that
   make it. Sourced across three of `/faq`'s groups (finch, data,
   integrations), picked for local relevance rather than in group order. */
function southAfricaFaqs(): FaqItem[] {
  const byId = new Map<string, FaqItem>();
  for (const group of FAQ_GROUPS) {
    for (const item of group.questions) byId.set(item.id, item);
  }
  const ids = [
    "vat-aware-invoices",
    "eft-cash-card-payments",
    "whatsapp-email-orders",
    "does-finch-make-us-popia-compliant",
    "does-finch-replace-accounting-software",
  ];
  return ids.map((id) => {
    const item = byId.get(id);
    if (!item) throw new Error(`south-africa: FAQ id "${id}" not found in lib/marketing/faq.ts.`);
    return item;
  });
}

const SECTORS = [
  { title: "Food suppliers", copy: "Customer-specific pricing, repeat orders, delivery and accounts.", href: "/industries/food-suppliers" },
  { title: "Farms & producers", copy: "Availability, wholesale buyers and order-to-cash visibility.", href: "/industries/farms" },
  { title: "Restaurants", copy: "Purchasing, waste, staffing and margin routines.", href: "/industries/restaurants" },
] as const;

export default function SouthAfricaPage() {
  const faqs = southAfricaFaqs();

  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildSouthAfricaSchema(faqs)).replace(/</g, "\\u003c"),
        }}
      />

      <FinchNav />

      <main id="main">
        <header className="mx-auto max-w-[1160px] px-[20px] pt-[56px] lg:px-[40px] lg:pt-[100px]">
          <Breadcrumb trail={[{ label: "Home", href: "/" }, { label: "South Africa", href: "/south-africa" }]} />
          <div className="grid grid-cols-1 gap-[40px] lg:grid-cols-[1fr_360px] lg:items-center lg:gap-[56px]">
            <div>
              <Eyebrow>VYSO IN SOUTH AFRICA</Eyebrow>
              <h1 className="m-0 mb-[16px] font-fn-serif text-[38px] font-medium leading-[1.08] tracking-[-0.02em] lg:mb-[20px] lg:text-[54px]">
                Built for how South African operations actually run.
              </h1>
              <p className="m-0 mb-[16px] max-w-[560px] text-[15.5px] leading-[1.65] text-fn-ink-3 text-pretty lg:text-[16px]">
                Finch keeps customer accounts, price lists, quotes, orders, VAT-aware invoices,
                delivery notes and payments out of disconnected WhatsApp chats and spreadsheets and
                into one working flow, in rand.
              </p>
              <p className="m-0 mb-[32px] font-fn-mono text-[11px] tracking-[0.1em] text-fn-muted lg:mb-[40px]">
                JOHANNESBURG HQ · WORKING WITH BUSINESSES NATIONALLY
              </p>
              <div className="flex flex-wrap gap-[14px]">
                <Link
                  href="/operations-audit"
                  className="rounded-[10px] bg-fn-orange-cta px-[24px] py-[13px] text-[14.5px] font-semibold text-[#FFF7F0] transition-colors duration-150 hover:bg-fn-orange hover:text-white"
                >
                  Book your audit
                </Link>
                <Link
                  href="/platform/modules/orderflow"
                  className="rounded-[10px] border border-fn-line-3 bg-fn-surface px-[24px] py-[13px] text-[14.5px] font-semibold text-fn-ink transition-colors duration-150 hover:border-fn-line-hover"
                >
                  Explore OrderFlow
                </Link>
              </div>
            </div>
            <div className="flex justify-center lg:justify-end">
              <SouthAfricaMap />
            </div>
          </div>
        </header>

        <section
          aria-labelledby="local-capabilities-heading"
          className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
        >
          <div className="mb-[32px] max-w-[680px] lg:mb-[44px]">
            <Eyebrow>LOCAL PROOF, NOT LOCAL WALLPAPER</Eyebrow>
            <h2
              id="local-capabilities-heading"
              className="m-0 mb-[12px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[32px]"
            >
              Built around how South African B2B trade actually moves.
            </h2>
            <p className="m-0 text-[15px] leading-[1.65] text-fn-ink-3 text-pretty">
              &ldquo;Built for South Africa&rdquo; should show up in the currency, documents, payment
              methods, customer terms and imperfect order inputs your team handles every day — not
              just a flag in the corner.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 lg:grid-cols-3">
            {LOCAL_CAPABILITIES.map(({ title, copy }) => (
              <article key={title} className="rounded-[10px] border border-fn-line bg-fn-surface px-[20px] py-[22px]">
                <h3 className="m-0 mb-[8px] text-[16px] font-medium text-fn-ink">{title}</h3>
                <p className="m-0 text-[14px] leading-[1.55] text-fn-ink-3">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="boundary-heading"
          className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
        >
          <div className="grid grid-cols-1 gap-[32px] lg:grid-cols-[1fr_460px] lg:items-start lg:gap-[56px]">
            <div>
              <Eyebrow>A CLEAR OPERATING BOUNDARY</Eyebrow>
              <h2
                id="boundary-heading"
                className="m-0 mb-[12px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[32px]"
              >
                Operational control, not a claim to be your accountant.
              </h2>
              <p className="m-0 mb-[16px] text-[15px] leading-[1.65] text-fn-ink-3 text-pretty">
                OrderFlow manages the commercial work before and around accounting: the customer
                request, agreed price, order, delivery document, invoice, payment and account
                history. It is not presented as a VAT return, statutory filing or full
                general-ledger product.
              </p>
              <Link href="/faq#data" className="text-[14.5px] font-medium text-fn-ink-2 transition-colors duration-150 hover:text-fn-orange-deep">
                Read the data &amp; POPIA FAQs →
              </Link>
            </div>

            <div className="rounded-[12px] border border-fn-line bg-fn-surface px-[24px] py-[24px]">
              <h3 className="m-0 mb-[10px] text-[16px] font-medium text-fn-ink">
                Support for compliance work, not a magic badge.
              </h3>
              <p className="m-0 mb-[18px] text-[14px] leading-[1.6] text-fn-ink-3">
                Consistent records, VAT-aware documents and controlled access can support better
                operating discipline. Your business and its advisers remain responsible for tax
                treatment, recordkeeping, privacy duties and other legal obligations.
              </p>
              <p className="m-0 mb-[10px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted">
                OFFICIAL GUIDANCE
              </p>
              <div className="flex flex-col gap-[8px]">
                <a
                  href="https://www.sars.gov.za/types-of-tax/value-added-tax/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13.5px] text-fn-ink-2 underline decoration-fn-line-3 underline-offset-2 transition-colors duration-150 hover:text-fn-orange-deep hover:decoration-fn-orange-deep"
                >
                  SARS VAT guidance ↗
                </a>
                <a
                  href="https://inforegulator.org.za/popia/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13.5px] text-fn-ink-2 underline decoration-fn-line-3 underline-offset-2 transition-colors duration-150 hover:text-fn-orange-deep hover:decoration-fn-orange-deep"
                >
                  Information Regulator (POPIA) ↗
                </a>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="finding-heading"
          className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
        >
          <h2 id="finding-heading" className="sr-only">
            What a South African finding looks like
          </h2>
          <div className="flex justify-center">
            <FindingCard
              agent="PRICE WATCH"
              observation="Cooking oil up 6% at a Johannesburg supplier — three invoices running, same product code."
              impact="≈ R2,340/mo at current order volumes"
              evidence="3 invoices"
              meta="JOHANNESBURG · ILLUSTRATIVE EXAMPLE"
              state="new"
              className="max-w-[460px]"
            />
          </div>
        </section>

        <section
          aria-labelledby="migration-heading"
          className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
        >
          <div className="mb-[32px] max-w-[680px] lg:mb-[44px]">
            <Eyebrow>A LOWER-RISK STARTING POINT</Eyebrow>
            <h2
              id="migration-heading"
              className="m-0 mb-[12px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[32px]"
            >
              Improve one workflow before replacing everything.
            </h2>
            <p className="m-0 text-[15px] leading-[1.65] text-fn-ink-3 text-pretty">
              A local system only helps if the team can put it into practice. Finch starts with a
              defined operational problem and a controlled rollout, not an all-at-once software
              upheaval.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-[16px] md:grid-cols-3">
            {MIGRATION_STEPS.map((step, index) => (
              <article key={step.title} className="rounded-[10px] border border-fn-line bg-fn-surface px-[20px] py-[22px]">
                <p className="m-0 mb-[8px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-muted">
                  STEP {index + 1}
                </p>
                <h3 className="m-0 mb-[8px] text-[16px] font-medium text-fn-ink">{step.title}</h3>
                <p className="m-0 text-[14px] leading-[1.55] text-fn-ink-3">{step.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="south-africa-faq-heading"
          id="faq"
          className="mx-auto max-w-[860px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
        >
          <h2
            id="south-africa-faq-heading"
            className="m-0 mb-[24px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:mb-[32px] lg:text-[30px]"
          >
            South African operations, without vague promises.
          </h2>
          <dl className="m-0 grid grid-cols-1 gap-[26px] md:grid-cols-2 md:gap-x-[48px] md:gap-y-[30px]">
            {faqs.map(({ question, answer }) => (
              <div key={question}>
                <dt className="mb-[7px] font-fn-serif text-[16.5px] font-medium text-fn-ink">{question}</dt>
                <dd className="m-0 text-[14.5px] leading-[1.6] text-fn-ink-3 text-pretty">{answer}</dd>
              </div>
            ))}
          </dl>
          <Link
            href="/faq"
            className="mt-[24px] inline-block text-[14.5px] font-medium text-fn-ink-2 transition-colors duration-150 hover:text-fn-orange-deep"
          >
            Full FAQ →
          </Link>
        </section>

        <section
          aria-labelledby="sectors-heading"
          className="mx-auto max-w-[1160px] px-[20px] pt-[72px] lg:px-[40px] lg:pt-[110px]"
        >
          <div className="mb-[32px] max-w-[680px] lg:mb-[44px]">
            <Eyebrow>CURRENT OPERATING FOCUS</Eyebrow>
            <h2 id="sectors-heading" className="m-0 mb-[12px] font-fn-serif text-[26px] font-medium tracking-[-0.02em] lg:text-[32px]">
              Starting where the workflow is tangible.
            </h2>
            <p className="m-0 text-[15px] leading-[1.65] text-fn-ink-3 text-pretty">
              Finch can serve SMEs across sectors. Our beachhead is food, where pricing, repeat
              orders, delivery documents, payments and margin pressure make connected operations
              especially valuable.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-[16px] md:grid-cols-3">
            {SECTORS.map(({ title, copy, href }) => (
              <Link
                key={title}
                href={href}
                className="group rounded-[10px] border border-fn-line bg-fn-surface px-[20px] py-[22px] transition-colors duration-150 hover:border-fn-line-hover"
              >
                <h3 className="m-0 mb-[8px] text-[16px] font-medium text-fn-ink">{title}</h3>
                <p className="m-0 mb-[14px] text-[14px] leading-[1.55] text-fn-ink-3">{copy}</p>
                <span className="inline-flex items-center gap-[6px] text-[13.5px] font-medium text-fn-ink-2 transition-colors duration-150 group-hover:text-fn-orange-deep">
                  Explore the workflow
                  <span aria-hidden="true" className="transition-transform duration-150 ease-out group-hover:translate-x-[2px]">
                    →
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <AuditBand />
      </main>

      <div className="pt-[40px] lg:pt-[68px]">
        <FinchFooter />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import ContactForm from "@/components/ContactForm";
import { FinchFooter } from "@/components/finch/FinchFooter";
import { FinchNav } from "@/components/finch/FinchNav";

const CANONICAL_URL = "https://vyso.co.za/contact";
const EMAIL = "joshua@vyso.co.za";

const title = "Contact Vyso — Johannesburg | Vyso";
/* 141 chars. The page's job in search is to answer "how do I reach Vyso", so
   the description leads with the address and points the audit intent away. */
const description =
  "Email Vyso in Johannesburg about Finch, pricing or how your operation runs. Booking the one-week Operations Audit? Start on the audit page.";

export const metadata: Metadata = {
  /* Absolute for the same reason as /operations-audit: the sitewide template
     appends "| Vyso", which this title already carries. */
  title: { absolute: title },
  description,
  alternates: { canonical: CANONICAL_URL },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: CANONICAL_URL,
    siteName: "Vyso",
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title, description },
};

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ContactPage",
      "@id": `${CANONICAL_URL}#webpage`,
      url: CANONICAL_URL,
      name: title,
      description,
      inLanguage: "en-ZA",
      about: { "@id": "https://vyso.co.za/#organization" },
      breadcrumb: { "@id": `${CANONICAL_URL}#breadcrumbs` },
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${CANONICAL_URL}#breadcrumbs`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://vyso.co.za" },
        { "@type": "ListItem", position: 2, name: "Contact", item: CANONICAL_URL },
      ],
    },
  ],
};

/* `/contact` in the Finch language — general enquiries only. Anyone who came
   to book the audit is sent to `/operations-audit`, which is the front door and
   the only place the booking form lives. The WebGL shader, the glass cards and
   the waitlist framing are all gone. */
export default function ContactPage() {
  return (
    <div className="finch-site min-h-screen bg-fn-bg font-fn-sans text-fn-ink antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
      <FinchNav />

      <main id="main">
        <header className="mx-auto max-w-[1160px] px-[20px] pt-[44px] lg:px-[40px] lg:pt-[72px]">
          <div
            className="mb-[22px] h-[3px] w-[44px] rounded-[2px] lg:mb-[28px] lg:w-[52px]"
            style={{ background: "var(--fn-grad)" }}
          />
          <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
            CONTACT
          </div>
          <h1 className="m-0 mb-[16px] font-fn-serif text-[38px] font-medium leading-[1.08] tracking-[-0.02em] lg:mb-[20px] lg:text-[58px] lg:leading-[1.05] lg:tracking-[-0.025em]">
            Talk to Vyso.
          </h1>
          <p className="m-0 max-w-[520px] text-[15px] leading-[1.65] text-fn-ink-2 text-pretty lg:text-[17px]">
            Questions about Finch, pricing, or whether any of this fits how your business actually
            runs. Send the messy version — we reply within one business day.
          </p>
        </header>

        <section className="mx-auto max-w-[1160px] px-[20px] pt-[40px] pb-[24px] lg:px-[40px] lg:pt-[72px]">
          <div className="grid grid-cols-1 gap-[32px] border-t border-fn-line pt-[40px] lg:grid-cols-[0.85fr_1.15fr] lg:gap-[72px] lg:pt-[56px]">
            {/* ── Where we are ───────────────────────────────────────────── */}
            <div>
              <div className="border-b border-fn-line-2 pb-[20px]">
                <div className="mb-[8px] font-fn-mono text-[10.5px] tracking-[0.14em] text-fn-muted">
                  EMAIL
                </div>
                <a
                  href={`mailto:${EMAIL}`}
                  className="text-[16px] font-medium text-fn-ink transition-colors duration-150 hover:text-fn-orange-deep"
                >
                  {EMAIL}
                </a>
              </div>

              <div className="border-b border-fn-line-2 py-[20px]">
                <div className="mb-[8px] font-fn-mono text-[10.5px] tracking-[0.14em] text-fn-muted">
                  WHERE WE ARE
                </div>
                <p className="m-0 text-[15px] leading-[1.6] text-fn-ink-2">
                  Johannesburg, South Africa. We work with businesses across the country.
                </p>
              </div>

              {/* The pointer card: most people arriving here want the audit. */}
              <div className="mt-[24px] rounded-[12px] border border-fn-line bg-fn-surface p-[20px] shadow-[var(--fn-shadow-card)] lg:p-[24px]">
                <div className="mb-[10px] font-fn-mono text-[10.5px] tracking-[0.14em] text-fn-muted">
                  WANT THE AUDIT?
                </div>
                <p className="m-0 mb-[14px] text-[15px] leading-[1.6] text-fn-ink-3 text-pretty">
                  The one-week Operations Audit is R2,000, credited to your first month. It is booked
                  on its own page, with the details we need to start.
                </p>
                <Link
                  href="/operations-audit"
                  className="text-[14px] font-semibold text-fn-orange-deep transition-colors duration-150 hover:text-fn-orange-cta"
                >
                  Book your audit <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>

            {/* ── The form ───────────────────────────────────────────────── */}
            <div className="rounded-[12px] border border-fn-line bg-fn-surface p-[20px] shadow-[var(--fn-shadow-card)] lg:p-[32px]">
              <h2 className="m-0 mb-[20px] font-fn-serif text-[22px] font-medium tracking-[-0.02em] lg:text-[24px]">
                Send us a message
              </h2>
              <ContactForm variant="general" />
            </div>
          </div>
        </section>
      </main>

      <FinchFooter />
    </div>
  );
}

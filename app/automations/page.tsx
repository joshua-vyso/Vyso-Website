import type { Metadata } from "next";
import { JsonLd, PageHead, VxShell, breadcrumbs, webPage } from "@/components/vx/VxShell";
import { Artifact } from "@/components/vx/artifacts";
import { LeadEngineGraph } from "@/components/vx/cases/LeadEngineGraph";
import { OrderCapture } from "@/components/vx/cases/OrderCapture";
import { PlatformShowcase } from "@/components/vx/cases/PlatformShowcase";
import { ServiceDenRender } from "@/components/vx/cases/ServiceDenRender";
import { SYSTEMS } from "@/components/vx/content";
import { Reveal, Words } from "@/components/vx/primitives";
import { SITE } from "@/lib/marketing/site";

const DESCRIPTION =
  "What Vyso has actually built: a custom operating system for a Johannesburg wholesaler, an AI lead engine that drafts outreach and follow-ups, an invoicing and CRM tracker, and order capture straight from WhatsApp and Outlook. Plus the five systems behind every build.";

export const metadata: Metadata = {
  title: "Systems we've built — bespoke AI automation",
  description: DESCRIPTION,
  alternates: { canonical: "/automations" },
};

const ANSWER =
  "Vyso builds bespoke AI automation systems. Built so far: a full operating system for a Johannesburg food wholesaler (stock, suppliers, documents, orders, invoicing), a scheduled lead engine that checks replies, drafts follow-ups and discovers new leads into Gmail drafts and Notion, an invoicing and CRM tracker, and order capture that turns WhatsApp messages and emails into confirmed orders. Every build keeps a person in charge of every outward action.";

/* ── The four builds ─────────────────────────────────────────────────────────
   Each case is a real thing that exists: the platform is screenshotted on
   the demo organisation, the lead engine graph is read from the live n8n
   workflow, the tracker and the order capture are drawn from the products
   that run (ServiceDen is a single private account, so it is rendered, not
   screenshotted). No results are claimed; illustrative values are labelled. */
const CASES = [
  {
    num: "01",
    title: "An operating system",
    em: "for a wholesaler.",
    line: "A Johannesburg food wholesaler ran on WhatsApp, email, paper and memory. We built the system that now runs it: stock and suppliers, every document read and filed, customer orders from draft to payment, a daily brief.",
    meta: [
      ["Client", "Food wholesaler, Johannesburg"],
      ["Scope", "Stock · suppliers · documents · orders · invoicing · review queue"],
      ["Runs on", "Outlook, WhatsApp, Xero, the Vyso platform"],
      ["Evidence", "Product screenshots, demo organisation"],
    ],
    render: <PlatformShowcase />,
  },
  {
    num: "02",
    title: "A lead engine",
    em: "that never sends.",
    line: "Every weekday at 06:00 it checks the inbox for genuine replies and bounces, drafts stage-based follow-ups for leads due today, then discovers new leads with web search, scrapes and qualifies them, and drafts first outreach. Fifty nodes. Every email ends as a Gmail draft a person sends.",
    meta: [
      ["Client", "Vyso, internal"],
      ["Scope", "Reply detection · follow-ups · discovery · qualification · CRM"],
      ["Runs on", "n8n, GPT-5.5, Firecrawl, Gmail, Notion"],
      ["Evidence", "Node map read from the live workflow"],
    ],
    render: <LeadEngineGraph />,
  },
  {
    num: "03",
    title: "Invoicing and a CRM",
    em: "in one tracker.",
    line: "Outreach, leads, customers, services, invoices and templates on one screen. Leads move through stages with a next action and a follow-up date; invoices go from draft to sent to paid and land in the books.",
    meta: [
      ["Client", "Vyso, internal (ServiceDen)"],
      ["Scope", "Lead pipeline · customers · services · invoicing · templates"],
      ["Runs on", "The Vyso platform, Xero"],
      ["Evidence", "Rendered from the product; values illustrative"],
    ],
    render: <ServiceDenRender />,
  },
  {
    num: "04",
    title: "Orders captured from",
    em: "WhatsApp and email.",
    line: "Customers order the way they already do. A message or an email with a PO comes in; the system verifies the sender, matches the customer and the products, prices the lines and creates the order for a person to confirm. The invoice follows.",
    meta: [
      ["Client", "Food wholesaler, Johannesburg"],
      ["Scope", "WhatsApp + Outlook intake · customer matching · order creation · invoicing"],
      ["Runs on", "WhatsApp Business, Microsoft Graph, the Vyso platform"],
      ["Evidence", "Rendered from the live ingest pattern; values illustrative"],
    ],
    render: <OrderCapture />,
  },
];

export default function AutomationsPage() {
  return (
    <VxShell closing={{ line: "Yours", em: "next?" }}>
      <JsonLd data={breadcrumbs([["Home", "/"], ["Systems", "/automations"]])} />
      <JsonLd data={webPage({ path: "/automations", name: "Systems we've built", description: DESCRIPTION, type: "CollectionPage" })} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          "@id": `${SITE.url}/automations#built`,
          name: "Systems Vyso has built",
          itemListElement: CASES.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: { "@type": "CreativeWork", name: `${c.title} ${c.em}`, description: c.line, creator: { "@id": `${SITE.url}/#organization` } },
          })),
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Service",
          "@id": `${SITE.url}/automations#service`,
          name: "Bespoke AI automation systems",
          serviceType: "AI workflow automation",
          provider: { "@id": `${SITE.url}/#organization` },
          areaServed: "ZA",
          description: ANSWER,
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Systems",
            itemListElement: SYSTEMS.map((s) => ({
              "@type": "Offer",
              itemOffered: { "@type": "Service", name: `${s.title} ${s.em}`.replace(".", ""), description: s.line },
            })),
          },
        }}
      />

      <PageHead eyebrow="Systems" title="Built. Running." em="Not decks." answer={ANSWER} />

      {/* ── What we built ── */}
      <section className="vx-wrap" aria-labelledby="built-h" style={{ paddingBottom: "clamp(48px, 6vw, 96px)" }}>
        <span id="built-h" className="sr-only">
          What we have built
        </span>
        {CASES.map((c) => (
          <Reveal as="article" key={c.num} className="vx-case" margin="-6% 0px">
            <div>
              <p className="vx-eyebrow">Build {c.num}</p>
              <h2 className="vx-display vx-h2" style={{ marginTop: 18 }}>
                {c.title} <em className="vx-em" style={{ color: "var(--vx-signal-text)", fontWeight: 300 }}>{c.em}</em>
              </h2>
              <p className="vx-lead" style={{ marginTop: 22 }}>
                {c.line}
              </p>
              <dl className="vx-case-meta">
                {c.meta.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="stage">{c.render}</div>
          </Reveal>
        ))}
      </section>

      {/* ── The five systems behind every build ── */}
      <section className="vx-on-ink vx-section" aria-labelledby="five-h">
        <div className="vx-wrap">
          <div className="vx-section-head">
            <div>
              <Reveal>
                <p className="vx-eyebrow">Behind every build</p>
              </Reveal>
              <Words as="h2" className="vx-display vx-h2" text="The same five" em="verbs." />
              <span id="five-h" className="sr-only">
                The five systems
              </span>
            </div>
            <Reveal delay={100}>
              <p className="vx-lead">Every system above is these five, arranged for one operation. Read, check, watch, follow, brief.</p>
            </Reveal>
          </div>
          <ul className="vx-systems" role="list">
            {SYSTEMS.map((s, i) => (
              <Reveal as="li" key={s.id} className={`vx-plate vx-sys ${i < 2 ? "vx-sys-wide" : ""}`} delay={(i % 3) * 90}>
                <div className="vx-sys-head">
                  <div>
                    <p className="vx-sys-num">{s.num}</p>
                    <h3 className="vx-sys-title">
                      {s.title} <em className="vx-em">{s.em}</em>
                    </h3>
                  </div>
                </div>
                <p className="vx-sys-body">{s.line}</p>
                <div className="vx-sys-stage">
                  <Artifact id={s.id} />
                </div>
                <ul className="tasks" style={{ marginTop: 16, display: "grid", gap: 6 }}>
                  {s.tasks.map((t) => (
                    <li key={t} className="vx-mono" style={{ fontSize: "0.66rem", letterSpacing: "0.08em", color: "var(--vx-ondark-2)" }}>
                      · {t}
                    </li>
                  ))}
                </ul>
                <p className="vx-sys-human">
                  <i aria-hidden="true" /> {s.human}
                </p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </VxShell>
  );
}

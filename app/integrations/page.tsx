import type { Metadata } from "next";
import { JsonLd, PageHead, VxShell, breadcrumbs, webPage } from "@/components/vx/VxShell";
import { INTEGRATION_SYSTEMS, INTEGRATION_WORKFLOWS } from "@/components/site/content";
import { LogoWall } from "@/components/vx/LogoWall";
import { Reveal } from "@/components/vx/primitives";

const DESCRIPTION =
  "Vyso systems run through the software a business already uses. Microsoft Outlook, Xero, WhatsApp and Gmail are wired into production workflows today; Google Workspace, Sage, QuickBooks, spreadsheets, databases and internal APIs connect depending on the workflow.";

export const metadata: Metadata = {
  title: "Integrations — your tools stay",
  description: DESCRIPTION,
  alternates: { canonical: "/integrations" },
};

const ANSWER =
  "Vyso integrates with the systems a business already runs on rather than replacing them. In production today: Microsoft Outlook, Xero, WhatsApp and Gmail. Commonly connected: Google Workspace, Microsoft 365, Sage, QuickBooks, Yoco, Loyverse, Notion, n8n, SimplePay, spreadsheets, databases and internal APIs.";

export default function IntegrationsPage() {
  return (
    <VxShell closing={{ line: "Connect", em: "the gaps." }}>
      <JsonLd data={breadcrumbs([["Home", "/"], ["Integrations", "/integrations"]])} />
      <JsonLd data={webPage({ path: "/integrations", name: "Integrations", description: DESCRIPTION })} />
      <PageHead eyebrow="Integrations" title="Your tools stay. The gaps" em="go." answer={ANSWER} />

      <section className="vx-on-ink" style={{ padding: "clamp(40px, 6vw, 96px) 0", overflow: "clip" }} aria-label="Systems Vyso connects to">
        <div className="vx-wrap">
          <Reveal>
            <LogoWall />
          </Reveal>
          <div className="vx-spec" style={{ marginTop: "clamp(40px, 6vw, 80px)" }}>
            <div>
              <h2>In production today</h2>
              <p>{INTEGRATION_SYSTEMS.live.join(" · ")}</p>
            </div>
            <div style={{ gridColumn: "span 3" }}>
              <h2>Commonly connected</h2>
              <p>{INTEGRATION_SYSTEMS.common.join(" · ")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="vx-wrap vx-section-tight" aria-label="Workflow lanes">
        <p className="vx-eyebrow">Three lanes</p>
        <div className="vx-systems" style={{ marginTop: 28, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {INTEGRATION_WORKFLOWS.map((lane, i) => (
            <Reveal as="article" key={lane.id} className="vx-card" delay={i * 90}>
              <h2 className="vx-h4">{lane.title}</h2>
              <ol className="vx-flow" style={{ marginTop: 18 }}>
                {lane.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <p style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {lane.systems.map((s) => (
                  <span key={s} className="vx-chip vx-chip-muted">
                    {s}
                  </span>
                ))}
              </p>
            </Reveal>
          ))}
        </div>
      </section>
    </VxShell>
  );
}

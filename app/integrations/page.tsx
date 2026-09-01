import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PageHero, JsonLd, breadcrumbs } from "@/components/site/PageShell";
import { INTEGRATION_SYSTEMS, INTEGRATION_WORKFLOWS } from "@/components/site/content";

export const metadata: Metadata = {
  title: "Integrations",
  description:
    "Vyso automations run through the systems a business already uses. Xero, Microsoft Outlook, Gmail and WhatsApp are wired into production workflows today; Google Workspace, Sage, QuickBooks, spreadsheets, databases and internal APIs connect depending on your workflow.",
  alternates: { canonical: "/integrations" },
};

export default function IntegrationsPage() {
  return (
    <PageShell>
      <JsonLd data={breadcrumbs([["Home", "/"], ["Integrations", "/integrations"]])} />
      <PageHero
        eyebrow="Integrations"
        title={
          <>
            Your tools stay.{" "}
            <em className="vy-serif font-normal italic text-signal-deep">The gaps between them go.</em>
          </>
        }
        lead="An integration isn't a logo on a wall — it's a workflow that moves work across systems. Vyso connects the software your business already runs on and automates the handoffs between them."
      />

      <section className="mx-auto max-w-[1200px] px-6" aria-label="Workflow lanes">
        <div className="grid gap-5 lg:grid-cols-3">
          {INTEGRATION_WORKFLOWS.map((lane) => (
            <article key={lane.id} className="vy-card flex flex-col p-6 md:p-7">
              <h2 className="font-semibold">{lane.title}</h2>
              <ol className="mt-4 flex-1 space-y-2.5">
                {lane.steps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-2">
                    <span className="vy-mono flex-none text-[11px] leading-[1.7] text-system-deep">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-5 border-t border-line-2/70 pt-4">
                {lane.systems.map((system) => (
                  <span
                    key={system}
                    className="vy-mono mr-2 mt-1 inline-block rounded-md bg-system-tint px-2 py-1 text-[11px] text-system-deep"
                  >
                    {system}
                  </span>
                ))}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-[1200px] px-6" aria-labelledby="systems-heading">
        <div className="grid gap-10 border-t border-line pt-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <h2 id="systems-heading" className="text-2xl font-semibold tracking-[-0.01em]">
              The systems
            </h2>
            <p className="mt-4 max-w-[440px] text-sm leading-relaxed text-ink-2">
              We describe integrations honestly. &ldquo;In production&rdquo; means the connection
              runs in live Vyso builds today. &ldquo;Commonly connected&rdquo; means we wire it in
              depending on your workflow — most systems with an inbox, an export or an API can
              join a build.
            </p>
          </div>
          <div className="space-y-8">
            <div>
              <h3 className="vy-eyebrow text-ink-3">In production today</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {INTEGRATION_SYSTEMS.live.map((system) => (
                  <li
                    key={system}
                    className="rounded-full border border-system-stroke/40 bg-system-tint px-4 py-2 text-sm font-medium text-system-deep"
                  >
                    {system}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="vy-eyebrow text-ink-3">Systems we commonly connect</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {INTEGRATION_SYSTEMS.common.map((system) => (
                  <li
                    key={system}
                    className="rounded-full border border-line-2 bg-white px-4 py-2 text-sm text-ink-2"
                  >
                    {system}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-relaxed text-ink-3">
                Availability depends on your workflow and each system&rsquo;s access options —
                confirmed during the mapping phase, before anything is promised.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-[1200px] px-6 pb-24">
        <div className="rounded-2xl bg-ink px-8 py-12 text-center">
          <h2 className="text-2xl font-semibold text-ondark">
            Not sure whether your systems fit?
          </h2>
          <p className="mx-auto mt-3 max-w-[460px] text-sm leading-relaxed text-ondark-2">
            Tell us what you run on — the mapping phase answers this properly before any build
            begins.
          </p>
          <Link href="/join" className="vy-btn vy-btn-system mt-7 inline-flex">
            Join the waitlist
          </Link>
        </div>
      </section>
    </PageShell>
  );
}

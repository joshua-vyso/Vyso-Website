import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PageHero, JsonLd, breadcrumbs } from "@/components/site/PageShell";
import { CAPABILITY_GROUPS } from "@/components/site/content";
import { SITE } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: "What we automate",
  description:
    "The operational work Vyso automates: reading and organising documents, checking and reconciling numbers, monitoring and alerting, follow-ups and coordination, and daily briefs — with humans approving what matters.",
  alternates: { canonical: "/automations" },
};

/* The concrete task list from the capability system, grouped under the five
   verbs — the specific jobs behind each group's summary. */
const GROUP_TASKS: Record<string, string[]> = {
  read: [
    "Invoice and document processing",
    "Data entry and synchronisation between systems",
    "Compliance-document collection",
    "Inbox triage and request routing",
  ],
  check: [
    "Purchase-order, delivery-note and invoice reconciliation",
    "Supplier price monitoring against invoice history",
    "Exception detection across documents and systems",
  ],
  monitor: [
    "Stock and purchasing alerts",
    "Renewal and deadline monitoring",
    "Supplier price-change alerts",
    "Custom monitoring agents with human-approval steps",
  ],
  followup: [
    "Debtor and payment follow-ups",
    "Quote and lead follow-ups",
    "Customer-enquiry handling and escalation",
    "Internal approvals kept moving",
  ],
  brief: [
    "Operational reporting and daily management briefs",
    "Exception summaries ranked by financial impact",
    "Weekly and month-end roll-ups",
  ],
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": `${SITE.url}/automations#service`,
  name: "Custom AI automation",
  serviceType: "AI workflow automation",
  provider: { "@id": `${SITE.url}/#organization` },
  areaServed: "ZA",
  description:
    "Vyso designs, builds and operates custom AI automations around a business's existing tools: document processing, reconciliation, monitoring and alerts, follow-ups, and daily operational briefs with human approval steps.",
};

export default function AutomationsPage() {
  return (
    <PageShell>
      <JsonLd data={breadcrumbs([["Home", "/"], ["What we automate", "/automations"]])} />
      <JsonLd data={serviceSchema} />
      <PageHero
        eyebrow="What we automate"
        title={
          <>
            The repetitive work,{" "}
            <em className="vy-serif font-normal italic text-signal-deep">named.</em>
          </>
        }
        lead="An AI automation agency finds the repetitive, error-prone work inside a business and builds workflows that do it automatically — connected to the software already in use, watched by people. Here is that work, grouped into the five jobs we build for."
      />

      <div className="mx-auto max-w-[1200px] space-y-6 px-6">
        {CAPABILITY_GROUPS.map((group, index) => (
          <article key={group.id} id={group.id} className="vy-card p-6 md:p-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div>
                <p className="vy-mono text-sm text-signal-deep">0{index + 1}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.015em]">{group.title}</h2>
                <p className="mt-4 leading-relaxed text-ink-2">{group.problem}</p>
                <ul className="mt-6 space-y-2">
                  {GROUP_TASKS[group.id]?.map((task) => (
                    <li key={task} className="flex gap-2.5 text-sm text-ink-2">
                      <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-signal" aria-hidden="true" />
                      {task}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid content-start gap-x-10 gap-y-6 sm:grid-cols-2">
                <div>
                  <h3 className="vy-eyebrow text-ink-3">Vyso automates</h3>
                  <p className="mt-2 text-sm leading-relaxed">{group.automates}</p>
                </div>
                <div>
                  <h3 className="vy-eyebrow text-ink-3">Stays human</h3>
                  <p className="mt-2 text-sm leading-relaxed">{group.human}</p>
                </div>
                <div className="sm:col-span-2">
                  <h3 className="vy-eyebrow text-ink-3">The result</h3>
                  <p className="mt-2 text-sm leading-relaxed">{group.result}</p>
                </div>
                <p className="vy-mono rounded-xl bg-paper-2 px-4 py-3 text-[13px] leading-relaxed text-ink-2 sm:col-span-2">
                  {group.example}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Answer-first: how custom automation actually works. */}
      <section className="mx-auto mt-24 max-w-[1200px] px-6" aria-labelledby="how-heading">
        <div className="grid gap-10 border-t border-line pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <h2 id="how-heading" className="text-3xl font-semibold tracking-[-0.015em]">
            How a custom automation works
          </h2>
          <div className="space-y-5 leading-relaxed text-ink-2">
            <p>
              Every build runs on the same engine — document reading, extraction with confidence
              scoring, reconciliation, monitoring agents and a briefing layer — configured around
              how your business already operates. Nothing is deployed as a take-it-or-leave-it
              product: the workflow is shaped to your suppliers, your customers, your documents
              and your vocabulary.
            </p>
            <p>
              The dividing line is fixed: automations read, check, watch, draft and summarise;
              people approve. A low-confidence document read goes to a review queue instead of
              being committed. A drafted email waits for sign-off. A flagged discrepancy is
              evidence for your team, not an automatic dispute. That line is what makes it safe
              to hand real operational work to software.
            </p>
            <p>
              This is also what separates a custom automation from generic software: off-the-shelf
              tools ask your team to change how they work; a Vyso build wraps around the way they
              already do — and we keep operating it after launch, watching accuracy, handling edge
              cases and extending it as the operation changes.
            </p>
            <p>
              <Link href="/join" className="font-medium text-signal-deep underline decoration-signal-tint underline-offset-4 hover:decoration-signal-deep">
                Join the waitlist
              </Link>{" "}
              and tell us which of these jobs is eating your team&rsquo;s week.
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

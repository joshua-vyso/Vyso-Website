import type { Metadata } from "next";
import Link from "next/link";
import { PageShell, PageHero, JsonLd, breadcrumbs } from "@/components/site/PageShell";
import { PROCESS_STEPS } from "@/components/site/content";
import { SITE } from "@/lib/marketing/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Vyso is a Johannesburg AI automation agency founded by Josh Moreira. We design, build and operate custom AI workflows for operations-heavy businesses — and we run what we build.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <PageShell>
      <JsonLd data={breadcrumbs([["Home", "/"], ["About", "/about"]])} />
      <PageHero
        eyebrow="About Vyso"
        title={
          <>
            We build automations, then{" "}
            <em className="vy-serif font-normal italic text-signal-deep">we run them.</em>
          </>
        }
        lead="Vyso is an AI automation agency in Johannesburg. We started by building for one operations-heavy food business — reading its supplier invoices, watching its prices, reconciling its deliveries — and grew the engine from what actually survives contact with a real operation."
      />

      <section className="mx-auto max-w-[1200px] px-6" aria-labelledby="story-heading">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div className="space-y-5 leading-relaxed text-ink-2">
            <h2 id="story-heading" className="sr-only">
              The story
            </h2>
            <p>
              Most AI pitches start with a technology and go looking for a problem. We started
              inside the problem: a wholesale operation drowning in supplier documents, price
              creep and WhatsApp threads. The automations we built there — extraction with
              confidence scoring, price memory, reconciliation, a daily brief a human approves —
              became the engine every Vyso build now runs on.
            </p>
            <p>
              That history shapes how we work. We don&rsquo;t sell transformation decks. We map
              one operation, find the bottleneck that actually costs money, build the workflow
              around the tools already in use, and then operate it: watching accuracy, handling
              the edge cases, improving it as the business changes. If an automation
              wouldn&rsquo;t pay for itself, we say so before anything is built.
            </p>
            <p>
              The hard line in every build: software proposes, people decide. Client-facing
              messages wait for approval. Uncertain document reads queue for review. Findings
              arrive with their evidence attached. That line is what makes it safe to hand real
              operational work to automation.
            </p>
          </div>
          <aside className="vy-card h-fit p-6 md:p-8">
            <h2 className="vy-eyebrow text-ink-3">Company</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-medium">Founded by</dt>
                <dd className="text-ink-2">Josh Moreira, Johannesburg</dd>
              </div>
              <div>
                <dt className="font-medium">What we are</dt>
                <dd className="text-ink-2">
                  An AI automation agency: custom workflows, designed, built and operated.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Where we work</dt>
                <dd className="text-ink-2">
                  Built and run from Johannesburg, South Africa. Remote-friendly for the rest.
                </dd>
              </div>
              <div>
                <dt className="font-medium">Contact</dt>
                <dd>
                  <a
                    href={`mailto:${SITE.email}`}
                    className="text-signal-deep underline decoration-signal-tint underline-offset-4"
                  >
                    {SITE.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-medium">Data & access</dt>
                <dd className="text-ink-2">
                  Least-privilege access you grant per system and can revoke any time. POPIA
                  applies; your data is never sold, shared or used to train public models.
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-[1200px] px-6 pb-24" aria-labelledby="method-heading">
        <div className="border-t border-line pt-14">
          <h2 id="method-heading" className="text-2xl font-semibold tracking-[-0.01em]">
            How every engagement runs
          </h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-5">
            {PROCESS_STEPS.map((step, index) => (
              <li key={step.title} className="rounded-2xl border border-line bg-white p-5">
                <p className="vy-mono text-sm text-signal-deep">0{index + 1}</p>
                <h3 className="mt-2 font-semibold leading-snug">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-2">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12">
            <Link href="/join" className="vy-btn vy-btn-primary">
              Join the waitlist
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

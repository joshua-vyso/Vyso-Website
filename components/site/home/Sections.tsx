import Link from "next/link";
import { Reveal } from "@/components/site/Reveal";
import { FlowFieldLayer } from "@/components/site/three/FlowFieldLayer";
import {
  CAPABILITY_GROUPS,
  HOME_FAQ,
  INDUSTRIES,
  INTEGRATION_WORKFLOWS,
  PROCESS_STEPS,
  TESTIMONIAL_PLACEHOLDERS,
  type Testimonial,
} from "@/components/site/content";

/* ── Shared bits ───────────────────────────────────────────────────────────── */

export function SectionHead({
  eyebrow,
  title,
  lead,
  onDark = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: string;
  onDark?: boolean;
}) {
  return (
    <Reveal className="max-w-[720px]">
      <p className={`vy-eyebrow ${onDark ? "text-ondark-3" : "text-ink-3"}`}>{eyebrow}</p>
      <h2
        className={`mt-4 text-balance text-[clamp(1.9rem,3.6vw,2.9rem)] font-semibold leading-[1.08] tracking-[-0.015em] ${
          onDark ? "text-ondark" : "text-ink"
        }`}
      >
        {title}
      </h2>
      {lead ? (
        <p className={`mt-5 max-w-[600px] text-pretty leading-relaxed ${onDark ? "text-ondark-2" : "text-ink-2"}`}>
          {lead}
        </p>
      ) : null}
    </Reveal>
  );
}

const Wrap = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`mx-auto max-w-[1200px] px-6 ${className}`}>{children}</div>
);

/* ── 5. Problem statement ──────────────────────────────────────────────────── */

export function ProblemSection() {
  return (
    <section className="py-24 md:py-32" aria-labelledby="problem-heading">
      <Wrap>
        <Reveal>
          <p className="vy-eyebrow text-ink-3">The problem</p>
          <h2
            id="problem-heading"
            className="mt-6 max-w-[900px] text-balance text-[clamp(1.7rem,3.4vw,2.7rem)] font-medium leading-[1.2] tracking-[-0.01em] text-ink"
          >
            Your systems don&rsquo;t talk to each other, so your people do the talking —{" "}
            <em className="vy-serif italic text-ink-2">
              retyping documents, comparing spreadsheets, chasing WhatsApps
            </em>{" "}
            — and the problems that matter surface weeks late.
          </h2>
        </Reveal>
        <Reveal delay={120} className="mt-10">
          <p className="max-w-[620px] leading-relaxed text-ink-2">
            Vyso builds the connective tissue: automations that read what arrives, check it
            against what you already know, watch for what&rsquo;s drifting, and hand your team a
            short list of what actually needs a person.
          </p>
        </Reveal>
      </Wrap>
    </section>
  );
}

/* ── 6. Capabilities ───────────────────────────────────────────────────────── */

export function CapabilitiesSection() {
  return (
    <section className="border-t border-line py-24 md:py-32" aria-labelledby="capabilities-heading" id="automate">
      <Wrap>
        <SectionHead
          eyebrow="What we automate"
          title={
            <span id="capabilities-heading">
              Five kinds of work,{" "}
              <em className="vy-serif font-normal italic">taken off your team&rsquo;s plate.</em>
            </span>
          }
          lead="Not a feature catalogue — the operational jobs that eat hours. Each automation is designed around how your business already does the work."
        />
        <div className="mt-16 space-y-5">
          {CAPABILITY_GROUPS.map((group, index) => (
            <Reveal key={group.id} className="vy-card p-6 md:p-9">
              <div className="grid gap-8 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
                <div>
                  <p className="vy-mono text-sm text-signal-deep">0{index + 1}</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.01em]">{group.title}</h3>
                  <p className="mt-3 leading-relaxed text-ink-2">{group.problem}</p>
                </div>
                <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
                  <div>
                    <h4 className="vy-eyebrow text-ink-3">Vyso automates</h4>
                    <p className="mt-2 text-sm leading-relaxed text-ink">{group.automates}</p>
                  </div>
                  <div>
                    <h4 className="vy-eyebrow text-ink-3">Stays human</h4>
                    <p className="mt-2 text-sm leading-relaxed text-ink">{group.human}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <h4 className="vy-eyebrow text-ink-3">The result</h4>
                    <p className="mt-2 text-sm leading-relaxed text-ink">{group.result}</p>
                  </div>
                  <p className="vy-mono rounded-xl bg-paper-2 px-4 py-3 text-[13px] leading-relaxed text-ink-2 sm:col-span-2">
                    {group.example}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Wrap>
    </section>
  );
}

/* ── 8. How we work ────────────────────────────────────────────────────────── */

export function ProcessSection() {
  return (
    <section className="border-t border-line py-24 md:py-32" aria-labelledby="process-heading">
      <Wrap>
        <SectionHead
          eyebrow="How we work"
          title={<span id="process-heading">From bottleneck to running automation.</span>}
        />
        <ol className="mt-14 grid gap-4 md:grid-cols-5">
          {PROCESS_STEPS.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 70} className="rounded-2xl border border-line bg-white p-5">
              <p className="vy-mono text-sm text-signal-deep">0{index + 1}</p>
              <h3 className="mt-2 font-semibold leading-snug">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </Wrap>
    </section>
  );
}

/* ── 9. Integrations as workflows ──────────────────────────────────────────── */

export function IntegrationsSection() {
  return (
    <section className="border-t border-line py-24 md:py-32" aria-labelledby="integrations-heading">
      <Wrap>
        <SectionHead
          eyebrow="Integrations"
          title={
            <span id="integrations-heading">
              Connected workflows,{" "}
              <em className="vy-serif font-normal italic">not a wall of logos.</em>
            </span>
          }
          lead="Automations run through the systems you already use. Xero, Outlook, Gmail and WhatsApp are wired in today; most other systems connect depending on your workflow."
        />
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {INTEGRATION_WORKFLOWS.map((lane) => (
            <Reveal key={lane.id} className="vy-card flex flex-col p-6">
              <h3 className="font-semibold">{lane.title}</h3>
              <ol className="mt-4 flex-1 space-y-2.5">
                {lane.steps.map((item, index) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-ink-2">
                    <span className="vy-mono flex-none text-[11px] leading-[1.7] text-system-deep">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
              <p className="mt-5 border-t border-line-2/70 pt-4">
                {lane.systems.map((system) => (
                  <span
                    key={system}
                    className="vy-mono mr-2 inline-block rounded-md bg-system-tint px-2 py-1 text-[11px] text-system-deep"
                  >
                    {system}
                  </span>
                ))}
              </p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-8">
          <Link
            href="/integrations"
            className="text-sm font-medium text-system-deep underline decoration-system-stroke/50 underline-offset-4 hover:decoration-system-deep"
          >
            Every system we commonly connect →
          </Link>
        </Reveal>
      </Wrap>
    </section>
  );
}

/* ── 10. Industries ────────────────────────────────────────────────────────── */

export function IndustriesSection() {
  return (
    <section className="border-t border-line py-24 md:py-32" aria-labelledby="industries-heading">
      <Wrap>
        <SectionHead
          eyebrow="Industries"
          title={<span id="industries-heading">Operations we know well enough to be specific about.</span>}
        />
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {INDUSTRIES.map((industry) => (
            <Reveal key={industry.slug}>
              <Link
                href={`/industries/${industry.slug}`}
                className="group flex h-full flex-col rounded-2xl border border-line bg-white p-6 transition-shadow hover:shadow-[var(--vy-shadow-float)]"
              >
                <p className="vy-serif text-lg italic leading-snug text-ink-2">
                  &ldquo;{industry.pain}&rdquo;
                </p>
                <h3 className="mt-5 text-xl font-semibold">{industry.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-2">{industry.teaser}</p>
                <span className="mt-5 text-sm font-medium text-signal-deep">
                  What we automate here{" "}
                  <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Wrap>
    </section>
  );
}

/* ── 11. Testimonials (placeholders) over the Flow Field ───────────────────── */

function PortraitPlaceholder({ name }: { name: string }) {
  /* Swappable portrait slot: when the six real photographs arrive they drop in
     as an <img> here (same box, same radius) with zero layout change. */
  return (
    <span
      className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full border border-inkline bg-[#232019] text-ondark-3"
      aria-hidden="true"
      data-portrait-slot={name}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="9" r="3.4" />
        <path d="M5.5 19.4c1.3-3 3.6-4.5 6.5-4.5s5.2 1.5 6.5 4.5" />
      </svg>
    </span>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="vy-card-dark flex h-full flex-col p-6">
      <span className="vy-mono self-start rounded-md bg-[#2A2418] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-signal-ondark">
        Illustrative client voice
      </span>
      <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-ondark-2">
        &ldquo;{testimonial.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3 border-t border-inkline pt-4">
        <PortraitPlaceholder name={testimonial.company} />
        <div className="text-sm">
          <p className="font-medium text-ondark">{testimonial.name}</p>
          <p className="text-ondark-3">
            {testimonial.role} · {testimonial.company}
          </p>
        </div>
      </figcaption>
    </figure>
  );
}

export function TestimonialsSection() {
  return (
    <section
      className="relative overflow-hidden bg-ink py-24 md:py-32"
      aria-labelledby="testimonials-heading"
    >
      <FlowFieldLayer />
      <Wrap className="relative z-10">
        <SectionHead
          onDark
          eyebrow="Client voices · drafts awaiting verification"
          title={
            <span id="testimonials-heading">
              The kind of difference{" "}
              <em className="vy-serif font-normal italic text-signal-ondark">clients describe.</em>
            </span>
          }
          lead="These six voices are illustrative drafts, not verified endorsements — they show the shape of the feedback we build for. Real names, roles and businesses will replace them as clients go on record."
        />
        <ul className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3" role="list">
          {TESTIMONIAL_PLACEHOLDERS.map((testimonial, index) => (
            <Reveal as="li" key={testimonial.company + index} delay={(index % 3) * 80}>
              <TestimonialCard testimonial={testimonial} />
            </Reveal>
          ))}
        </ul>
      </Wrap>
    </section>
  );
}

/* ── 12. FAQ ───────────────────────────────────────────────────────────────── */

export function FaqSection() {
  return (
    <section className="border-t border-line py-24 md:py-32" aria-labelledby="faq-heading" id="faq">
      <Wrap className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <SectionHead
          eyebrow="Questions"
          title={<span id="faq-heading">Straight answers.</span>}
          lead="The things owners and operations leads ask before joining."
        />
        <div className="divide-y divide-line border-y border-line">
          {HOME_FAQ.map((item) => (
            <details key={item.id} className="group py-1">
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-6 py-4 font-medium text-ink [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  className="vy-mono flex-none text-ink-3 transition-transform group-open:rotate-45"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="max-w-[560px] pb-5 text-sm leading-relaxed text-ink-2">{item.a}</p>
            </details>
          ))}
        </div>
      </Wrap>
    </section>
  );
}

/* ── 13. Final CTA ─────────────────────────────────────────────────────────── */

export function FinalCtaSection({ heading = "Ready when the admin isn't." }: { heading?: string }) {
  return (
    <section className="bg-ink py-24 md:py-32" aria-labelledby="final-cta-heading">
      <Wrap className="text-center">
        <Reveal className="mx-auto max-w-[640px]">
          <p className="vy-eyebrow text-ondark-3">Join the waitlist</p>
          <h2
            id="final-cta-heading"
            className="mt-5 text-balance text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.015em] text-ondark"
          >
            {heading}
          </h2>
          <p className="mx-auto mt-5 max-w-[480px] text-pretty leading-relaxed text-ondark-2">
            We onboard a small number of businesses at a time so every build gets senior
            attention. Tell us what slows you down — joining takes a minute.
          </p>
          <div className="mt-9 flex justify-center">
            <Link href="/join" className="vy-btn vy-btn-system">
              Join the waitlist
            </Link>
          </div>
        </Reveal>
      </Wrap>
    </section>
  );
}

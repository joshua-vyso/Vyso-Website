import { Reveal } from "@/components/site/Reveal";
import { FlowFieldLayer } from "@/components/site/three/FlowFieldLayer";
import { TESTIMONIAL_PLACEHOLDERS, type Testimonial } from "@/components/site/content";

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

/* ── 11. Testimonials (placeholders) over the Flow Field ─────────────────────
   The header is its own export so the homepage's integration finale can raise
   it inside the pinned handoff (extended-pin merge, 2026-09); the grid itself
   — cards, flow field, labels — is unchanged. Pages that want the classic
   self-contained section keep the default `withHeader`. */

export function TestimonialsHead() {
  return (
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
  );
}

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

export function TestimonialsSection({ withHeader = true }: { withHeader?: boolean }) {
  return (
    <section
      className={`relative overflow-hidden ${withHeader ? "bg-ink py-24 md:py-32" : "vy-reviews-blend pb-24 pt-16 md:pb-32"}`}
      aria-labelledby="testimonials-heading"
    >
      <FlowFieldLayer />
      <Wrap className="relative z-10">
        {withHeader ? <TestimonialsHead /> : null}
        <ul className={`grid gap-5 md:grid-cols-2 lg:grid-cols-3 ${withHeader ? "mt-14" : ""}`} role="list">
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


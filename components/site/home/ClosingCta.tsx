import Link from "next/link";
import { Reveal } from "@/components/site/Reveal";

/* ── Closing CTA ─────────────────────────────────────────────────────────────
   A calm, spacious landing after the integration sequence — the particle
   field's black gives way to plain near-black, then the one ask. Uses the
   same primary CTA treatment as the hero and navigation. */

export function ClosingCta() {
  return (
    <section className="border-t border-[#211E19] py-28 md:py-40" aria-labelledby="closing-heading">
      <Reveal className="mx-auto max-w-[640px] px-6 text-center">
        <h2
          id="closing-heading"
          className="text-balance text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.015em] text-ondark"
        >
          Ready to get your{" "}
          <em className="vy-serif font-normal italic text-signal-ondark">time back?</em>
        </h2>
        <p className="mx-auto mt-5 max-w-[440px] text-pretty leading-relaxed text-ondark-2">
          A free audit of where your operation leaks hours and money — and an honest answer on
          whether automation would pay for itself.
        </p>
        <div className="mt-9 flex justify-center">
          <Link href="/join" className="vy-btn vy-btn-primary">
            Book a free audit
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

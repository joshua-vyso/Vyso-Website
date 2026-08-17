"use client";

import { useRef, useState } from "react";
import { MotionConfig } from "motion/react";

import { CyclingFinding } from "@/components/finch/CyclingFinding";
import { FindingCard } from "@/components/finch/FindingCard";
import { FindingStack } from "@/components/finch/FindingStack";
import { Band } from "@/components/finch/ground/Band";
import { FacetPlane } from "@/components/finch/ground/FacetPlane";
import { Glow } from "@/components/finch/ground/Glow";
import { GradientRibbon } from "@/components/finch/ground/GradientRibbon";
import { MotionBudgetProvider } from "@/components/finch/ground/motion-budget";
import { OscillatingGrid } from "@/components/finch/ground/OscillatingGrid";
import { WaveField } from "@/components/finch/ground/WaveField";
import { WaveClockProvider } from "@/components/finch/ground/wave-clock";
import { MagneticButton } from "@/components/finch/text/MagneticButton";
import { Parallax } from "@/components/finch/text/Parallax";
import { SplitReveal, Statement, STATEMENT_CLASS } from "@/components/finch/text/Statement";
import { WaveText } from "@/components/finch/text/WaveText";
import { MotionPreferenceProvider } from "@/components/finch/motion-preference";
import { useLenisEnabled } from "@/components/finch/SmoothScroll";
import { ALL_FINDINGS, HOME_HERO_CYCLE } from "@/lib/marketing/findings";

import { DesignControls } from "./DesignControls";

/* ── The kitchen sink ────────────────────────────────────────────────────────
   Every phase-6a primitive on every ground it is allowed on, with the controls
   and meters needed to judge it (`.ai/plan_phase6a_primitives.md` §6). This is
   a review instrument, not a page: nothing here is composition, and no
   marketing page should copy this file's density — the whole point of §3's
   "one device per band, two moving things per viewport" is that a real page
   looks nothing like this.

   The one rule the sink itself must obey: **the moving-things counter must
   read ≤ 2 anywhere outside the cards grid.** Each band carries exactly one
   device and each device pauses off-screen, so the count is 1 for most of the
   scroll and 2 across a band boundary. If it reads 3, a device has failed to
   pause and that is a bug in the primitive, not in this page.                  */

function Eyebrow({ children, tone = "paper" }: { children: React.ReactNode; tone?: "paper" | "dark" }) {
  return (
    <div
      className={
        "mb-[10px] font-fn-mono text-[10px] tracking-[0.14em] " +
        (tone === "dark" ? "text-fn-blue-mono" : "text-fn-muted-2")
      }
    >
      {children}
    </div>
  );
}

function Why({ children, tone = "paper" }: { children: React.ReactNode; tone?: "paper" | "dark" }) {
  return (
    <p
      className={
        "mb-[28px] max-w-[560px] text-[14px] leading-[1.6] " +
        (tone === "dark" ? "text-fn-blue-text-2" : "text-fn-ink-3")
      }
    >
      {children}
    </p>
  );
}

/* ── 1. Grounds ─────────────────────────────────────────────────────────────
   Eight bands, one device each, in an order that also demonstrates §2's
   "adjacent bands never share a ground". */

/* Each grounds band is at least 84vh and centres its content. Not decoration:
   the sink's own rule is that the moving-things counter reads ≤ 2 outside the
   cards grid, and three 400px bands fit inside a 900px viewport — which put
   three devices on screen at once and made the sink itself over budget. Real
   pages carry more content per band; the sink has three lines, so it has to
   ask for the height explicitly. */
const TALL = "min-h-[84vh] flex flex-col justify-center";

function Grounds({ cursor }: { cursor: boolean }) {
  /* The grid's text mask (§3.1 / §4.3): cells within 80px of this heading dim
     by 40%, which is what makes the type read as *inside* the field. */
  const maskRef = useRef<HTMLHeadingElement | null>(null);

  return (
    <>
      <Band className={TALL} ground="paper" device={<Glow tone="orange" size={320} />} intrinsicHeight={420}>
        <Eyebrow>01 · PAPER + GLOW</Eyebrow>
        <Why>
          The hero ground. One radial gradient drifting on a 12s loop and nothing else — this is the
          entire motion budget Linear, Vercel and Attio spend on a hero (§1.1). No grid, no facets.
        </Why>
        <Statement tone="paper" italicWord="own">
          Your company’s own COO.
        </Statement>
      </Band>

      <Band className={TALL} ground="blue" device={<FacetPlane seed={17} />} intrinsicHeight={520}>
        <Eyebrow tone="dark">02 · BLUE + FACET PLANE</Eyebrow>
        <Why tone="dark">
          Deep blue as the dominant colour, given geometric structure rather than a flat gradient
          (§2, the Prolibu move). 28 facets on desktop, 16 at 375, seeded — same plane every render,
          server and client. The whole plane parallaxes at 1.08× as the band passes.
        </Why>
        <Statement tone="blue">Structure, not a wash.</Statement>
      </Band>

      <Band
        className={TALL}
        ground="ink"
        device={<OscillatingGrid mode="dots" color="--fn-orange" cursor={cursor} maskRef={maskRef} opacity={0.32} />}
        intrinsicHeight={520}
      >
        <Eyebrow tone="dark">03 · INK + OSCILLATING GRID (DOTS, ORANGE)</Eyebrow>
        <Why tone="dark">
          A 24px lattice where each dot’s brightness is a sine of its distance from the wave origin,
          so a crest rolls across the band every ~8s. Cells within 80px of the headline dim 40% —
          look at the field directly under the words.
        </Why>
        <h2 ref={maskRef} className={STATEMENT_CLASS + " text-fn-ink-text"}>
          <SplitReveal text="The field makes room." />
        </h2>
      </Band>

      <Band className={TALL} ground="paper" intrinsicHeight={360}>
        <Eyebrow>04 · PAPER, NO DEVICE</Eyebrow>
        <Why>
          The in-between band. §2 and the research both say a warm-white section between blue and
          ink is a rest, not a reset — and a rest carries no device at all. The moving-things counter
          should read 0 while this band fills the viewport.
        </Why>
      </Band>

      {/* One provider around both the field and the type: they share a clock,
          so the words ride the actual sine the canvas is drawing (§4.1). */}
      <WaveClockProvider amplitude={18}>
        <Band
          className={TALL}
          ground="ink"
          device={<WaveField lines={11} amplitude={18} color="--fn-orange" opacity={0.34} />}
          intrinsicHeight={520}
        >
          <Eyebrow tone="dark">05 · INK + WAVE FIELD, TYPE RIDING IT</Eyebrow>
          <Why tone="dark">
            The signature move. Eleven sine lines at 18px amplitude; each word of the heading takes
            its <em>y</em> from the same equation at its own x-centre, at 5px instead of 18. Watch a
            crest pass under the line — the words lift left to right with it.
          </Why>
          <h2 className={STATEMENT_CLASS + " text-fn-ink-text"}>
            <WaveText>A COO’s day. Done by breakfast.</WaveText>
          </h2>
        </Band>
      </WaveClockProvider>

      <Band
        className={TALL}
        ground="blue"
        device={<OscillatingGrid mode="squares" color="--fn-blue-300" cursor={cursor} pitch={26} opacity={0.36} />}
        intrinsicHeight={480}
      >
        <Eyebrow tone="dark">06 · BLUE + OSCILLATING GRID (SQUARES, LIGHT BLUE)</Eyebrow>
        <Why tone="dark">
          The same primitive in `squares` mode and the blue palette — grid lines brightening in a
          wave instead of dots. Bolder; §3.1 reserves it for a CTA band.
        </Why>
        <Statement tone="blue">One device per band.</Statement>
      </Band>

      <Band className={TALL} ground="ink" intrinsicHeight={480} device={
        /* The ribbon is confined to a 320px strip, never a full band (§3). */
        <div className="absolute inset-x-0 bottom-0 h-[320px]">
          <GradientRibbon />
        </div>
      }>
        <Eyebrow tone="dark">07 · INK + GRADIENT RIBBON (320px STRIP)</Eyebrow>
        <Why tone="dark">
          The site’s one orange→blue moment, for the homepage closing CTA and nowhere else. Canvas
          2D: four soft stops drifting on inline value noise over a base gradient. Under reduced
          motion it becomes the static hairline, not a frozen smear. <strong>Josh: this is the
          canvas-vs-WebGL call.</strong>
        </Why>
        <div className="flex flex-wrap items-center gap-[14px]">
          <MagneticButton href="#cards" tone="dark">Book your audit</MagneticButton>
          <MagneticButton href="#cards" variant="secondary" tone="dark">See the findings</MagneticButton>
        </div>
      </Band>

      <Band className={TALL} ground="paper" intrinsicHeight={320}>
        <Eyebrow>08 · SEAM — THE BAND ABOVE, THE CARD ACROSS</Eyebrow>
        <Why>
          The paper half of the seam. The ink slab below overlaps it by 48px with a 24px top radius,
          and the card straddles the join (§2).
        </Why>
      </Band>

      {/* Not `TALL`: that class centres a band's content, which would defeat
          the whole demo — the card's −120px is measured from the top of the
          band, and a centred row puts it 200px below the seam it is meant to
          cross. Plain min-height instead. */}
      <Band className="min-h-[62vh]" ground="ink" seam device={<Glow tone="blue" size={280} />} intrinsicHeight={460}>
        {/* Card on the LEFT: the sticky control panel lives in the top-right,
            and the one thing this band exists to show is the card crossing the
            seam. */}
        <div className="grid gap-[36px] lg:grid-cols-[460px_1fr] lg:items-start">
          <div className="lg:-mt-[120px]">
            <FindingCard finding="margin-slip" variant="standard" className="w-full" />
          </div>
          <div>
            <Eyebrow tone="dark">08b · INK, SEAMED</Eyebrow>
            <Why tone="dark">
              The slab’s corners are rounded and the device is clipped to them. The card to the left
              sits −120px, across the seam.
            </Why>
          </div>
        </div>
      </Band>
    </>
  );
}

/* ── 2. Text motion ─────────────────────────────────────────────────────── */

function TextMotion() {
  return (
    <Band ground="paper" intrinsicHeight={900}>
      <Eyebrow>09 · TEXT MOTION</Eyebrow>
      <Why>
        The four mechanisms from §4 that do not need a wave under them. Each is ≤ 10px of
        displacement; §4’s “never” list rules out warping, per-letter jitter and text that follows
        the cursor.
      </Why>

      <div className="mb-[56px]">
        <div className="mb-[8px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-faint">
          STATEMENT · ITALIC WORD · SPLIT REVEAL (10px RISE, 30ms STAGGER)
        </div>
        <Statement tone="paper" italicWord="everything">
          R6,000. Everything included.
        </Statement>
      </div>

      <div className="mb-[56px]">
        <div className="mb-[8px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-faint">
          SPLIT REVEAL AT BODY SIZE
        </div>
        <p className="max-w-[560px] text-[19px] leading-[1.5] text-fn-ink-2">
          <SplitReveal text="Overnight I read twelve invoices and checked prices across six suppliers." />
        </p>
      </div>

      <div className="mb-[56px]">
        <div className="mb-[8px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-faint">
          PARALLAX · THREE PLANES (1.10 / 1.00 / 0.94) — SCROLL PAST SLOWLY
        </div>
        <div className="relative h-[260px] overflow-hidden rounded-[10px] border border-fn-line bg-fn-surface-2">
          <Parallax speed={1.1} className="absolute inset-x-0 top-[30px] text-center">
            <span className="font-fn-mono text-[11px] tracking-[0.14em] text-fn-blue-deep">BACKGROUND · 1.10×</span>
          </Parallax>
          <Parallax speed={1} className="absolute inset-x-0 top-[120px] text-center">
            <span className="font-fn-mono text-[11px] tracking-[0.14em] text-fn-ink-3">CARD · 1.00×</span>
          </Parallax>
          <Parallax speed={0.94} className="absolute inset-x-0 top-[200px] text-center">
            <span className="font-fn-mono text-[11px] tracking-[0.14em] text-fn-orange-deep">HEADLINE · 0.94×</span>
          </Parallax>
        </div>
      </div>

      <div>
        <div className="mb-[8px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-faint">
          MAGNETIC BUTTONS · ≤ 10px PULL WITHIN 120px (DESKTOP POINTER ONLY)
        </div>
        <div className="flex flex-wrap items-center gap-[14px]">
          <MagneticButton href="#cards">Book your audit</MagneticButton>
          <MagneticButton href="#cards" variant="secondary">See pricing</MagneticButton>
        </div>
      </div>
    </Band>
  );
}

/* ── 3. Cards ───────────────────────────────────────────────────────────── */

function Cards() {
  return (
    <>
      <Band ground="paper" id="cards" intrinsicHeight={1400}>
        <Eyebrow>10 · THE FINDING LIBRARY · ALL 24 CARDS</Eyebrow>
        <Why>
          Every card the site is allowed to show, from `lib/marketing/findings.ts`, rendered
          `standard`. Impacts run R6,400 to R223,000 a year and each carries its volume basis in the
          mono line — that basis is what makes a five-figure number checkable rather than boastful
          (§5). The two deliberately small ones (R756, R9,800) are flagged; they exist as contrast,
          never as a headline. This grid is the one place the moving-things counter is allowed
          above 2 — the micro-visuals are enter-once reveals, not loops.
        </Why>
        <div className="grid gap-[24px] md:grid-cols-2 xl:grid-cols-3">
          {ALL_FINDINGS.map((finding) => (
            <div key={finding.id}>
              <div className="mb-[8px] flex items-center gap-[8px] font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-faint">
                <span>{finding.id}</span>
                {finding.small ? <span className="text-fn-orange-deep">SMALL</span> : null}
                {finding.industries.length > 0 ? <span>{finding.industries.join(",")}</span> : null}
              </div>
              <FindingCard finding={finding} variant="standard" className="w-full" />
            </div>
          ))}
        </div>
      </Band>

      <Band ground="paper" intrinsicHeight={900}>
        <Eyebrow>11 · THE FOUR VARIANTS</Eyebrow>
        <Why>
          `compact` for bubbles, `standard` everywhere, `wide` with the evidence micro-visual
          (reused from the homepage agent roster, not redrawn), and `ink` for dark bands — the same
          components under a re-pointed palette, so a change to a card is a change to both.
        </Why>
        <div className="flex flex-wrap items-start gap-[28px]">
          <div>
            <div className="mb-[8px] font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-faint">COMPACT</div>
            <FindingCard finding="recon-drums" variant="compact" />
          </div>
          <div>
            <div className="mb-[8px] font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-faint">STANDARD</div>
            <FindingCard finding="butternut-price" variant="standard" />
          </div>
          <div>
            <div className="mb-[8px] font-fn-mono text-[9.5px] tracking-[0.1em] text-fn-faint">WIDE</div>
            <FindingCard finding="cooking-oil-price" variant="wide" />
          </div>
        </div>
      </Band>

      <Band className="min-h-[80vh] flex flex-col justify-center" ground="ink" device={<OscillatingGrid mode="dots" color="--fn-orange" opacity={0.22} pitch={26} />} intrinsicHeight={620}>
        <Eyebrow tone="dark">12 · THE `ink` VARIANT, ON AN INK BAND</Eyebrow>
        <Why tone="dark">
          `#1B1915` fill, `#2A2722` hairline, orange <em>text</em> at `#FFB27A` (8:1 — plain
          `#FF7727` is a glow colour, not a text colour) and the evidence chip as translucent blue
          rather than the paper tint. The dots behind it are dimmed to 22%; a card needs to win.
        </Why>
        <div className="flex flex-wrap items-start gap-[28px]">
          <FindingCard finding="debtors-past-60" variant="ink" />
          <FindingCard finding="stock-oil-cover" variant="ink" />
        </div>
      </Band>

      <Band ground="paper" intrinsicHeight={800}>
        <div className="grid gap-[56px] lg:grid-cols-2">
          <div>
            <Eyebrow>13 · CYCLING HERO CARD</Eyebrow>
            <Why>
              Three findings, crossfade plus a 6px lift every 6s, paused on hover or focus, first
              card only under reduced motion — and the first card is in the server HTML, so a hero
              with no JS is still a hero. This is what stops the butternut card being on every page.
            </Why>
            <CyclingFinding ids={HOME_HERO_CYCLE} />
          </div>
          <div>
            <Eyebrow>14 · FINDING STACK (FANNED DECK)</Eyebrow>
            <Why>
              The `stack` variant. Not a new component — `industries/FindingDeck.tsx` already fans
              three cards and straightens them, and its prop type is structurally the library’s
              `Finding`, so this is the deck with ids instead of inline copy.
            </Why>
            <FindingStack ids={["diesel-depots-price", "delivery-route-km", "recon-crates"]} />
          </div>
        </div>
      </Band>
    </>
  );
}

/* ── The sink ───────────────────────────────────────────────────────────── */

export function DesignSink() {
  const [forceStatic, setForceStatic] = useState(false);
  const [cursor, setCursor] = useState(true);
  const lenis = useLenisEnabled();

  return (
    /* Three layers, because the emulation needs all three to be real:
       `MotionPreferenceProvider` is what every primitive actually reads (see
       `motion-preference.tsx` — `MotionConfig` alone does NOT reach
       `useReducedMotion()`, which is measurable here: with only the
       `MotionConfig`, flipping the toggle left every canvas running);
       `MotionConfig` covers the `motion`-driven reveals inside the finding
       cards; the class covers CSS animations. */
    <MotionConfig reducedMotion={forceStatic ? "always" : "user"}>
      <MotionPreferenceProvider forceStatic={forceStatic}>
      <MotionBudgetProvider>
        <div className={forceStatic ? "fn-force-static" : undefined}>
          <DesignControls
            toggles={{ forceStatic, cursor, lenis }}
            onChange={(next) => {
              setForceStatic(next.forceStatic);
              setCursor(next.cursor);
            }}
          />
          <Grounds cursor={cursor && !forceStatic} />
          <TextMotion />
          <Cards />
          <Band ground="paper" intrinsicHeight={240}>
            <Eyebrow>END</Eyebrow>
            <Why>
              Check this page at 1440 and at 375. At 375 the facet plane simplifies to 16, the
              canvases scale to the narrower band and Statements sit at 52px. Then turn on REDUCED
              MOTION and confirm every device stops on a real picture rather than a blank.
            </Why>
          </Band>
        </div>
      </MotionBudgetProvider>
      </MotionPreferenceProvider>
    </MotionConfig>
  );
}

export default DesignSink;

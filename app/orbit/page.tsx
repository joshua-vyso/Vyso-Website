import type { Metadata } from "next";
import Link from "next/link";

import { Band } from "@/components/finch/ground/Band";
import { FacetPlane } from "@/components/finch/ground/FacetPlane";
import { Glow } from "@/components/finch/ground/Glow";
import { OscillatingGrid } from "@/components/finch/ground/OscillatingGrid";
import {
  Claim,
  Eyebrow,
  FaqList,
  SectionHeading,
  StatusNote,
  Step,
  TradeStrip,
  WaitlistBand,
  WaitlistCta,
} from "@/components/orbit/OrbitBits";
import { OrbitSequence } from "@/components/orbit/OrbitSequence";
import { WhatsAppPhone } from "@/components/orbit/WhatsAppPhone";
import { OrbitShell } from "@/components/orbit/OrbitShell";
import {
  breadcrumbNode,
  faqNode,
  jsonLd,
  orbitGraph,
  orbitProductNode,
  webPageNode,
} from "@/components/orbit/orbit-jsonld";
import { SITE } from "@/lib/marketing/site";
import { ALL_ORBIT_FAQS, ORBIT_FAQ_TEASER } from "@/lib/orbit/faq";
import { ORBIT_PLAN } from "@/lib/orbit/pricing";
import { HERO_GLIMPSE } from "@/lib/orbit/sequences";
import { ORBIT } from "@/lib/orbit/site";

/* ── `/orbit` ────────────────────────────────────────────────────────────────
   The subsite's front door, and the page every other Orbit page links back to.

   ── Ground sequence ─────────────────────────────────────────────────────────
   hero (ink · glow) → sequence (ink, second fill · the sequence is the motion)
   → what it does (blue · facets) → how it works (ink · grid dots) → built on
   Vyso (blue) → price (ink, second fill) → questions (ink · grid dots) →
   waitlist (ink, second fill · grid squares).

   Two deviations from `.ai/vyso_v3_design.md` §2, both deliberate and both
   consequences of a subsite with no paper ground:

   - **"Adjacent bands never share a ground" is honoured by fill, not by name.**
     Every band here is `ground="ink"` or `ground="blue"` — those are the only
     two the design system has, and Orbit has no paper. So consecutive ink
     bands alternate between `--ob-bg` and `--ob-bg-2`, which is the same rule
     doing the same job: no two touching bands look alike. `ground` stays
     accurate for the nav's sake even where `className` sets the fill.
   - **No `underNav`.** `Band`'s `underNav` pulls a dark hero up by
     `FinchNav`'s measured height (76/92px). `OrbitNav` is 62/78px tall, so
     that pull would clip 14px off the top of the hero. It is not needed here
     anyway: `.orbit-site` paints `--ob-bg` on the shell, so the nav is already
     standing on the hero's own colour and there is no seam to hide.           */

const TITLE = "Orbit — run your trade from WhatsApp";
const DESCRIPTION = ORBIT.description;
const URL = ORBIT.url;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/orbit" },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const DOES: [string, string][] = [
  ["Captures jobs", "One message — what you did, where, and what you charged — becomes a job with a value against it."],
  ["Drafts invoices", "Ask for an invoice and it comes back filled in from the job. You read it and you send it."],
  ["Tracks what you're owed", "Ask “who still owes me” and get an answer from your own records, not a guess."],
  ["Keeps materials straight", "Tell it what you bought and which job it was for, before you leave the counter."],
  ["Sends an end-of-day summary", "What the day earned, what it cost, and what is still waiting to be sent."],
];

const STEPS: [string, string][] = [
  ["You text what happened", "At the end of the job, in the app you already have open. Lower case, no punctuation, however you actually type."],
  ["Orbit records it and replies", "It reads the work, the place and the money, makes the job, and tells you what it has understood — so a mistake is one message away from fixed."],
  ["You say “invoice it”", "The draft comes back with the customer, the amount and the terms on it. Orbit drafts, you send."],
];

function buildSchema() {
  return orbitGraph([
    orbitProductNode(),
    webPageNode(URL, TITLE, DESCRIPTION),
    breadcrumbNode(URL, [
      ["Vyso", "/"],
      ["Orbit", "/orbit"],
    ]),
    faqNode(URL, ORBIT_FAQ_TEASER),
  ]);
}

export default function OrbitHomePage() {
  return (
    <OrbitShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(buildSchema()) }} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Band
        ground="ink"
        className="bg-ob-bg"
        paddingClassName="pt-[24px] pb-[56px] lg:pt-[40px] lg:pb-[96px]"
        device={<Glow tone="blue" size={420} className="left-[22%] top-[38%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2" />}
      >
        <div className="grid grid-cols-1 items-center gap-[40px] lg:grid-cols-[1.12fr_0.88fr] lg:gap-[56px]">
          <div>
            <StatusNote className="mb-[26px]" />
            <h1 className="m-0 mb-[20px] font-fn-serif text-[42px] font-medium leading-[1.06] tracking-[-0.025em] text-balance text-ob-text lg:text-[68px]">
              Run your trade from WhatsApp.
            </h1>
            <p className="m-0 mb-[28px] max-w-[560px] text-[16px] leading-[1.65] text-ob-text-2 lg:text-[18.5px]">
              Text Orbit what you did and what you charged. It tracks the job, drafts the invoice
              and keeps your books — on the Vyso operations platform already running South African
              businesses.
            </p>
            <WaitlistCta
              note={`${ORBIT.price.display} ${ORBIT.price.unit}`}
              secondary={{ href: "/orbit/how-it-works", label: "See how it works" }}
            />
          </div>
          {/* The premise, in two bubbles. The full exchange — and the record it
              makes inside Vyso — is the section below; a hero that played the
              whole thing would leave the sequence with nothing to reveal. */}
          <div className="flex justify-center lg:justify-end">
            <WhatsAppPhone script={HERO_GLIMPSE} />
          </div>
        </div>
      </Band>

      {/* ── The sequence ─────────────────────────────────────────────────── */}
      <Band ground="ink" className="bg-ob-bg-2" paddingClassName="pt-[48px] pb-[56px] lg:pt-[80px] lg:pb-[96px]">
        <div className="mb-[36px] max-w-[720px] lg:mb-[52px]">
          <Eyebrow>One message, start to finish</Eyebrow>
          <h2 className="m-0 font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] text-ob-text lg:text-[38px]">
            From “charged 3800” to a drafted invoice, without leaving the chat.
          </h2>
        </div>
        <OrbitSequence />
      </Band>

      {/* ── What Orbit does ──────────────────────────────────────────────── */}
      <Band ground="blue" device={<FacetPlane />}>
        <SectionHeading
          eyebrow="What Orbit does"
          title="Five things, done from a chat thread."
          lead="Nothing here needs a laptop, an office or a spare evening. Orbit is being built so the record of your work is made by the person who did it, at the moment they finished."
          className="mb-[40px] lg:mb-[56px]"
        />
        <ul className="m-0 grid list-none grid-cols-1 gap-[26px] p-0 md:grid-cols-2 lg:grid-cols-3 lg:gap-[36px]">
          {DOES.map(([title, body]) => (
            <li key={title} className="border-t border-white/20 pt-[16px]">
              <h3 className="m-0 mb-[8px] text-[16.5px] font-semibold tracking-[-0.01em] text-fn-blue-text">{title}</h3>
              <p className="m-0 text-[14.5px] leading-[1.6] text-fn-blue-text-2">{body}</p>
            </li>
          ))}
        </ul>
      </Band>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <Band
        ground="ink"
        className="bg-ob-bg"
        device={<OscillatingGrid mode="dots" color="--ob-blue" colorFallback="#0369FD" opacity={0.28} pitch={24} />}
      >
        <SectionHeading
          eyebrow="How it works"
          title="Three steps, and you already know the first one."
          className="mb-[40px] lg:mb-[56px]"
        />
        <div className="grid grid-cols-1 gap-[32px] md:grid-cols-3 md:gap-[40px]">
          {STEPS.map(([title, body], i) => (
            <Step key={title} index={i + 1} title={title}>
              {body}
            </Step>
          ))}
        </div>
        <div className="mt-[40px]">
          <Link
            href="/orbit/how-it-works"
            className="text-[14.5px] font-medium text-ob-text-2 underline decoration-ob-line underline-offset-[5px] transition-colors duration-150 hover:text-fn-orange-on-ink hover:decoration-fn-orange-on-ink"
          >
            The longer version, with three more conversations →
          </Link>
        </div>
      </Band>

      {/* ── Trades ───────────────────────────────────────────────────────── */}
      <Band ground="ink" className="bg-ob-bg-2" paddingClassName="py-[52px] lg:py-[84px]">
        <SectionHeading
          eyebrow="Who it's for"
          title="Built for one- and two-person trade businesses."
          lead="Ten trades, each with its own page, because a roofer's week is not a tiler's week and the reasons money goes missing are different in both."
          className="mb-[28px]"
        />
        <TradeStrip />
      </Band>

      {/* ── Built on Vyso ────────────────────────────────────────────────── */}
      <Band ground="blue" device={<Glow tone="orange" size={380} className="right-[16%] top-[40%] h-[380px] w-[380px] -translate-y-1/2" />}>
        <div className="max-w-[760px]">
          <Eyebrow>Built on Vyso</Eyebrow>
          <Claim tone="blue">Not a new company with a chatbot.</Claim>
          <p className="m-0 mt-[22px] max-w-[620px] text-[15.5px] leading-[1.7] text-fn-blue-text-2 lg:text-[17px]">
            {ORBIT.builtOn}
          </p>
          <p className="m-0 mt-[18px] max-w-[620px] text-[15.5px] leading-[1.7] text-fn-blue-text-2 lg:text-[17px]">
            Vyso is a Johannesburg company. Its platform is used by South African food
            businesses today — including{" "}
            <Link href="/case-studies/turn-n-slice" className="underline decoration-white/35 underline-offset-[5px] transition-colors duration-150 hover:decoration-white">
              Turn &rsquo;n Slice
            </Link>
            , which is replacing QuickBooks with Vyso&rsquo;s own invoicing. Orbit puts a
            WhatsApp front door on the same machinery, for a different trade.
          </p>
          <p className="m-0 mt-[18px] font-fn-mono text-[11.5px] tracking-[0.08em] text-fn-blue-mono uppercase">
            {ORBIT.draftsOnly}
          </p>
        </div>
      </Band>

      {/* ── Price ────────────────────────────────────────────────────────── */}
      <Band ground="ink" className="bg-ob-bg-2">
        <div className="grid grid-cols-1 gap-[36px] lg:grid-cols-[0.9fr_1.1fr] lg:gap-[64px]">
          <div>
            <Eyebrow>Price</Eyebrow>
            <p className="m-0 flex items-baseline gap-[10px]">
              <span className="font-fn-serif text-[68px] font-medium leading-[1] tracking-[-0.03em] text-ob-text lg:text-[92px]">
                {ORBIT.price.display}
              </span>
              <span className="text-[16px] text-ob-mono">/ month</span>
            </p>
            <p className="m-0 mt-[10px] text-[14.5px] text-ob-text-2">{ORBIT.price.unit}</p>
            <p className="m-0 mt-[6px] font-fn-mono text-[10.5px] tracking-[0.1em] text-ob-mono uppercase">
              {ORBIT.price.vatNote}
            </p>
          </div>
          <div>
            <h2 className="m-0 mb-[16px] font-fn-serif text-[26px] font-medium leading-[1.2] tracking-[-0.02em] text-ob-text lg:text-[32px]">
              One plan. No tiers, no per-invoice fee, no setup cost.
            </h2>
            <ul className="m-0 flex list-none flex-col gap-[9px] p-0">
              {ORBIT_PLAN.included.slice(0, 5).map((item) => (
                <li key={item} className="flex gap-[10px] text-[14.5px] leading-[1.55] text-ob-text-2">
                  <span aria-hidden className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-fn-orange" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="m-0 mt-[18px]">
              <Link
                href="/orbit/pricing"
                className="text-[14.5px] font-medium text-ob-text-2 underline decoration-ob-line underline-offset-[5px] transition-colors duration-150 hover:text-fn-orange-on-ink hover:decoration-fn-orange-on-ink"
              >
                Everything in the plan, and what is not in it yet →
              </Link>
            </p>
          </div>
        </div>
      </Band>

      {/* ── FAQ teaser ───────────────────────────────────────────────────── */}
      <Band
        ground="ink"
        className="bg-ob-bg"
        device={<OscillatingGrid mode="dots" color="--fn-orange" colorFallback="#FF7727" opacity={0.2} pitch={26} />}
      >
        <SectionHeading eyebrow="Straight answers" title="The four questions everyone asks first." className="mb-[28px]" />
        <div className="max-w-[860px]">
          <FaqList items={ORBIT_FAQ_TEASER} />
          <p className="m-0 mt-[22px]">
            <Link
              href="/orbit/faq"
              className="text-[14.5px] font-medium text-ob-text-2 underline decoration-ob-line underline-offset-[5px] transition-colors duration-150 hover:text-fn-orange-on-ink hover:decoration-fn-orange-on-ink"
            >
              All {ALL_ORBIT_FAQS.length} questions →
            </Link>
          </p>
        </div>
      </Band>

      <WaitlistBand />
    </OrbitShell>
  );
}

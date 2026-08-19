import type { Metadata } from "next";
import Link from "next/link";

import { Band } from "@/components/finch/ground/Band";
import { FacetPlane } from "@/components/finch/ground/FacetPlane";
import { Glow } from "@/components/finch/ground/Glow";
import { OscillatingGrid } from "@/components/finch/ground/OscillatingGrid";
import {
  Breadcrumb,
  Claim,
  Eyebrow,
  SectionHeading,
  StatusNote,
  WaitlistBand,
} from "@/components/orbit/OrbitBits";
import { OrbitShell } from "@/components/orbit/OrbitShell";
import { WhatsAppPhone } from "@/components/orbit/WhatsAppPhone";
import {
  breadcrumbNode,
  howToNode,
  jsonLd,
  orbitGraph,
  webPageNode,
} from "@/components/orbit/orbit-jsonld";
import { SITE } from "@/lib/marketing/site";
import { CORRECTION, END_OF_DAY, JOB_TO_INVOICE, MATERIALS } from "@/lib/orbit/sequences";
import { ORBIT } from "@/lib/orbit/site";

/* ── `/orbit/how-it-works` ───────────────────────────────────────────────────
   The long-form explanation, and the page the homepage's three-step summary
   defers to. Four conversations rather than one: the job, the materials and
   the debtor question, the end-of-day summary, and a correction — because the
   correction is the one everybody actually worries about and the one a marketing
   page usually hides.

   `HowTo` JSON-LD, built from the same three steps the page renders. `HowTo` is
   the most abused type in schema.org and it is legitimate here for exactly one
   reason: this page describes a sequence of actions a *person* performs, which
   is what the type is for. It carries no `totalTime` and no `estimatedCost`,
   both of which would have to be invented.                                     */

const TITLE = "How Orbit works — jobs and invoices by chat";
const DESCRIPTION =
  "How Orbit works: you text a job into WhatsApp, Orbit records it on the Vyso platform, drafts the invoice and answers what you are owed. You send.";
const URL = `${ORBIT.url}/how-it-works`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/orbit/how-it-works" },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "article",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const STEPS = [
  {
    name: "Text Orbit what you did",
    text: "At the end of the job, send one message saying what you did, where, and what you charged — for example “fixed tiling at job on 1st avenue. charged 3800.” Lower case and abbreviations are fine.",
  },
  {
    name: "Orbit records it and replies",
    text: "Orbit reads the work, the place, the customer and the money, makes a job on the Vyso operations platform, and replies with what it understood so a mistake is one message away from being fixed.",
  },
  {
    name: "Ask for the invoice, then send it yourself",
    text: "Say “invoice it” and Orbit prepares a draft with the customer, the amount and the terms already on it. You read the draft and send it — Orbit never sends to a customer on your behalf.",
  },
];

const UNDERSTANDS: [string, string][] = [
  ["The work", "What you did, in the words you would use to a customer. “Re-tiled the main bathroom”, “db board fault find”, “sealed the valley”."],
  ["The place", "An address, a suburb, a site name or a customer name. Whatever you already use to tell one job from another."],
  ["The money", "What you charged, and how it was made up — a rate and hours, a rate and square metres, a fixed price, a callout plus labour."],
  ["Materials", "What you bought, what it cost and which job it was for. Told to Orbit at the counter rather than reconstructed from a slip weeks later."],
  ["Who owes you", "What has been paid and what has not, so “who still owes me” is a question with an answer."],
  ["Corrections", "“No, that was 3500 not 3800.” The job moves, and so does any draft made from it."],
];

const SENDS_BACK: [string, string][] = [
  ["A confirmation", "What it understood, immediately, as a short structured reply. It is faster to correct a wrong reading than to discover one in a month."],
  ["A draft invoice", "When you ask for one. Filled in from the job, ready to check."],
  ["An answer", "To “who still owes me”, “what did I charge them last time”, “what have I spent this week”."],
  ["An end-of-day summary", "Jobs done, charged, materials, and anything still waiting to be sent."],
];

function buildSchema() {
  return orbitGraph([
    webPageNode(URL, TITLE, DESCRIPTION),
    howToNode(URL, STEPS),
    breadcrumbNode(URL, [
      ["Vyso", "/"],
      ["Orbit", "/orbit"],
      ["How it works", "/orbit/how-it-works"],
    ]),
  ]);
}

export default function OrbitHowItWorksPage() {
  return (
    <OrbitShell active="how-it-works">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(buildSchema()) }} />

      <Band
        ground="ink"
        className="bg-ob-bg"
        paddingClassName="pt-[24px] pb-[52px] lg:pt-[36px] lg:pb-[88px]"
        device={<Glow tone="blue" size={380} className="left-[24%] top-[40%] h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2" />}
      >
        <Breadcrumb trail={[["Vyso", "/"], ["Orbit", "/orbit"], ["How it works", "/orbit/how-it-works"]]} />
        <div className="grid grid-cols-1 items-center gap-[44px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-[64px]">
          <div>
            <h1 className="m-0 mb-[20px] font-fn-serif text-[38px] font-medium leading-[1.08] tracking-[-0.025em] text-balance text-ob-text lg:text-[60px]">
              How Orbit works.
            </h1>
            <p className="m-0 mb-[24px] max-w-[560px] text-[16px] leading-[1.68] text-ob-text-2 lg:text-[18px]">
              You send a message. Orbit makes a record, keeps the money side straight and hands
              you a draft invoice. There is no app, no dashboard and nothing to keep up to date —
              the message you were half-writing anyway is the whole input.
            </p>
            <StatusNote />
          </div>
          <div className="flex justify-center lg:justify-end">
            <WhatsAppPhone script={JOB_TO_INVOICE} />
          </div>
        </div>
      </Band>

      {/* ── The three steps, at length ───────────────────────────────────── */}
      <Band ground="blue" device={<FacetPlane />}>
        <SectionHeading
          eyebrow="The flow"
          title="Three steps, and you already do the first one."
          className="mb-[40px] lg:mb-[56px]"
        />
        <ol className="m-0 grid list-none grid-cols-1 gap-[32px] p-0 md:grid-cols-3 md:gap-[40px]">
          {STEPS.map((step, i) => (
            <li key={step.name} className="border-t border-white/20 pt-[18px]">
              <span aria-hidden className="mb-[10px] block font-fn-mono text-[11px] tracking-[0.14em] text-fn-blue-mono">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="m-0 mb-[10px] font-fn-serif text-[21px] font-medium leading-[1.25] tracking-[-0.015em] text-fn-blue-text lg:text-[23px]">
                {step.name}
              </h3>
              <p className="m-0 text-[14.5px] leading-[1.65] text-fn-blue-text-2">{step.text}</p>
            </li>
          ))}
        </ol>
      </Band>

      {/* ── What Orbit understands ───────────────────────────────────────── */}
      <Band
        ground="ink"
        className="bg-ob-bg"
        device={<OscillatingGrid mode="dots" color="--ob-blue" colorFallback="#0369FD" opacity={0.26} pitch={24} />}
      >
        <div className="grid grid-cols-1 gap-[44px] lg:grid-cols-[0.95fr_1.05fr] lg:gap-[64px]">
          <div>
            <SectionHeading
              eyebrow="What Orbit reads"
              title="Six things, out of one sentence."
              lead="Orbit is being built for the way people type on a phone at the end of a working day — not for a form with nine fields and a date picker."
            />
            <ul className="m-0 mt-[28px] flex list-none flex-col gap-[18px] p-0">
              {UNDERSTANDS.map(([title, body]) => (
                <li key={title} className="border-t border-ob-line pt-[14px]">
                  <h3 className="m-0 mb-[6px] text-[15.5px] font-semibold text-ob-text">{title}</h3>
                  <p className="m-0 text-[14px] leading-[1.6] text-ob-text-2">{body}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-center gap-[16px] lg:items-end">
            <WhatsAppPhone script={MATERIALS} />
            <p className="m-0 font-fn-mono text-[9.5px] tracking-[0.1em] text-ob-mono uppercase">
              {MATERIALS.caption}
            </p>
          </div>
        </div>
      </Band>

      {/* ── What Orbit sends back ────────────────────────────────────────── */}
      <Band ground="ink" className="bg-ob-bg-2">
        <div className="grid grid-cols-1 gap-[44px] lg:grid-cols-[1.05fr_0.95fr] lg:gap-[64px]">
          <div className="order-2 flex flex-col items-center gap-[16px] lg:order-1 lg:items-start">
            <WhatsAppPhone script={END_OF_DAY} />
            <p className="m-0 font-fn-mono text-[9.5px] tracking-[0.1em] text-ob-mono uppercase">
              {END_OF_DAY.caption}
            </p>
          </div>
          <div className="order-1 lg:order-2">
            <SectionHeading
              eyebrow="What comes back"
              title="Four kinds of reply, and none of them go to your customer."
              lead="Everything Orbit produces lands in your chat first. The rule is the same one every Vyso product runs on: the software prepares, a person decides."
            />
            <ul className="m-0 mt-[28px] flex list-none flex-col gap-[18px] p-0">
              {SENDS_BACK.map(([title, body]) => (
                <li key={title} className="border-t border-ob-line pt-[14px]">
                  <h3 className="m-0 mb-[6px] text-[15.5px] font-semibold text-ob-text">{title}</h3>
                  <p className="m-0 text-[14px] leading-[1.6] text-ob-text-2">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Band>

      {/* ── Corrections ──────────────────────────────────────────────────── */}
      <Band
        ground="ink"
        className="bg-ob-bg"
        device={<OscillatingGrid mode="dots" color="--fn-orange" colorFallback="#FF7727" opacity={0.2} pitch={26} />}
      >
        <div className="grid grid-cols-1 gap-[44px] lg:grid-cols-[1fr_0.85fr] lg:gap-[64px]">
          <div>
            <Eyebrow>When you get it wrong</Eyebrow>
            <Claim>You say the wrong number. That&rsquo;s fine.</Claim>
            <p className="m-0 mt-[22px] max-w-[560px] text-[15.5px] leading-[1.7] text-ob-text-2 lg:text-[17px]">
              The reason people do not write things down on site is that writing them down feels
              permanent, and being wrong on paper is worse than being vague in your head. So Orbit
              is being built to be corrected in the same sentence you would use out loud — and a
              correction moves the job and every draft made from it, because nothing has been sent.
            </p>
            <p className="m-0 mt-[18px] max-w-[560px] text-[15.5px] leading-[1.7] text-ob-text-2 lg:text-[17px]">
              This is the practical half of {ORBIT.draftsOnly.toLowerCase().replace(/\.$/, "")}. A
              draft can be wrong. An invoice a customer has already received cannot be, without a
              phone call you did not want to make.
            </p>
          </div>
          <div className="flex flex-col items-center gap-[16px] lg:items-end">
            <WhatsAppPhone script={CORRECTION} />
            <p className="m-0 font-fn-mono text-[9.5px] tracking-[0.1em] text-ob-mono uppercase">
              {CORRECTION.caption}
            </p>
          </div>
        </div>
      </Band>

      {/* ── Where the data lives ─────────────────────────────────────────── */}
      <Band ground="blue" device={<Glow tone="orange" size={360} className="right-[18%] top-[42%] h-[360px] w-[360px] -translate-y-1/2" />}>
        <div className="max-w-[760px]">
          <Eyebrow>Where it lives</Eyebrow>
          <Claim tone="blue">WhatsApp is the door, not the filing cabinet.</Claim>
          <p className="m-0 mt-[22px] max-w-[620px] text-[15.5px] leading-[1.7] text-fn-blue-text-2 lg:text-[17px]">
            {ORBIT.builtOn}
          </p>
          <p className="m-0 mt-[18px] max-w-[620px] text-[15.5px] leading-[1.7] text-fn-blue-text-2 lg:text-[17px]">
            Your jobs, customers and invoices are yours. Vyso does not sell customer data and does
            not use one business&rsquo;s records to advise another. The company&rsquo;s published
            positions are at{" "}
            <Link href="/privacy" className="underline decoration-white/35 underline-offset-[5px] hover:decoration-white">
              privacy
            </Link>{" "}
            and{" "}
            <Link href="/popia" className="underline decoration-white/35 underline-offset-[5px] hover:decoration-white">
              POPIA
            </Link>
            , and those pages are the authority rather than this one.
          </p>
        </div>
      </Band>

      {/* ── Not yet ──────────────────────────────────────────────────────── */}
      <Band ground="ink" className="bg-ob-bg-2">
        <SectionHeading
          eyebrow="Not yet"
          title="What Orbit is not being built to do first."
          lead="Everything above is the intent for the first release. These are on the roadmap, and this page will keep calling them roadmap until they are not."
          className="mb-[24px]"
        />
        <ul className="m-0 flex max-w-[760px] list-none flex-wrap gap-[10px] p-0">
          {["Quoting", "Payments in the chat", "Reading photos of slips", "More than one person per account", "Afrikaans and isiZulu", "Scheduling and dispatch"].map(
            (item) => (
              <li
                key={item}
                className="inline-flex rounded-full border border-ob-line px-[14px] py-[8px] text-[13.5px] text-ob-mono"
              >
                {item}
              </li>
            ),
          )}
        </ul>
      </Band>

      <WaitlistBand
        claim="Ready when it opens?"
        lead="Orbit is in development. The waitlist is free, it commits you to nothing, and the people on it hear first."
      />
    </OrbitShell>
  );
}

import type { Metadata } from "next";

import { Shell } from "@/components/vyso/Shell";
import { HomeBespoke } from "@/components/vyso/home/HomeBespoke";
import { HomeCase } from "@/components/vyso/home/HomeCase";
import { HomeClose } from "@/components/vyso/home/HomeClose";
import { HomeDifferentiation } from "@/components/vyso/home/HomeDifferentiation";
import { HomeExamples } from "@/components/vyso/home/HomeExamples";
import { HomeFounder } from "@/components/vyso/home/HomeFounder";
import { HomeHero } from "@/components/vyso/home/HomeHero";
import { HomeProcess } from "@/components/vyso/home/HomeProcess";
import { HomeTools } from "@/components/vyso/home/HomeTools";
import { SITE } from "@/lib/marketing/site";

/* ── / ───────────────────────────────────────────────────────────────────────
   The redesigned homepage (`.ai/plan_vyso_redesign_2026.md` §7.1, Phase 1).
   What stood here was the agency page built on the Finch marketing surface;
   this is the same company said properly, on the `--vy-*` system.

   ── The five-second read ────────────────────────────────────────────────────
   "Vyso automates operational work and catches problems proactively." The hero
   says it in a sentence and shows it in a timeline, and every section below is
   one more angle on the same claim. One idea per section, a hairline between
   neighbours, and no section that exists to fill a scroll.

     hero            the claim, and the picture of the claim
     difference      automate, understand, act
     examples        four things worth catching
     tools           what it runs on, and what is honestly not connected yet
     bespoke         the diagram: in, layer, out
     process         five steps, starting with the free audit
     founder         why the company exists, said once
     case            Turn ’n Slice, with the numbers still blank
     close           the one dark band, and the audit

   ── The three unenforced rules, and where they are spent ────────────────────
   1. ONE `h1`: `HomeHero`. Every other section heads at `h2` through `Section`
      (its default), and the headings inside them are `h3`.
   2. ONE dark section: `HomeClose`. Everything above it stands on paper.
   3. The shadow: `ChromeFrame` in the hero, once. Every `Card` is flat.

   ── Composition ─────────────────────────────────────────────────────────────
   Every section is a SERVER component. The only client leaves on this page are
   `EventTimeline` (the hero demo), `Reveal` (the scroll entrances) and the
   nav's `MobileMenu` — all leaves, so every heading, sentence, timestamp and
   rand figure below is plain HTML in the first response. On a site whose pitch
   is "we notice things", a demo an answer engine cannot read would be worth
   nothing.

   The `Shell` is what switches the page onto `.vyso-site`; a page that forgets
   it renders in the old marketing theme. `active` stays `"none"` because the
   home page is the wordmark, not a nav item. */

const TITLE = "Vyso | Automation that knows what happens next";

/* The brief's support line, trimmed by one adverb to fit the 155-character
   meta-description budget (160 → 148). Nothing else about it changed. */
const DESCRIPTION =
  "Vyso builds tailored operational systems that automate repetitive work, connect your business data and tell you when something needs your attention.";

export const metadata: Metadata = {
  /* `absolute` because the root layout's template would otherwise append
     " | Vyso" to a title that already opens with it. */
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    /* Written out rather than left to the layout's "/", which `metadataBase`
       resolves with a trailing slash. `app/sitemap.ts` publishes the root as
       `https://vyso.co.za`, and a canonical that disagrees with the sitemap
       about a trailing slash is a self-inflicted duplicate. */
    canonical: SITE.url,
  },
  /* Restated in full: Next replaces the `openGraph` object rather than merging
     into the layout's, so anything omitted here would simply be dropped. No
     `images` key, in either block — `app/opengraph-image.tsx` emits both
     `og:image` and `twitter:image` through the file convention, and a
     hard-coded array here would override it. */
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE.url,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function Home() {
  return (
    <Shell>
      <HomeHero />
      <HomeDifferentiation />
      <HomeExamples />
      <HomeTools />
      <HomeBespoke />
      <HomeProcess />
      <HomeFounder />
      <HomeCase />
      <HomeClose />
    </Shell>
  );
}

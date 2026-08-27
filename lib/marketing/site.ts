/* ── Site-wide constants ──────────────────────────────────────────────────────
   Single source of truth for the facts that repeat across the root layout
   (metadata + JSON-LD graph) and any page that needs the same entity details
   without re-typing them. Nothing here is invented: name/url/email match the
   values already hard-coded in `app/layout.tsx` before this file existed; the
   description is the entity statement from `.ai/vyso_v2.md` §7.4, trimmed to
   the ≤155-char meta-description budget; the founder is the settled fact from
   §0/§2.3 ("Founder (Josh Moreira, Johannesburg)"); Johannesburg/ZA is the only
   location claim the site makes anywhere (no street address exists to publish,
   per the phase-1 decision "no LocalBusiness/address schema"). */

export const SITE = {
  name: "Vyso",
  url: "https://vyso.co.za",
  email: "joshua@vyso.co.za",

  /* `.ai/plan_vyso_redesign_2026.md` §2/§8: the entity statement is now the
     positioning's own support line, because that sentence is what the site is
     built to prove and what every page repeats. It is the brief's line with one
     adverb ("proactively") removed, which is what brings it from 160 to 148
     characters, inside the 155 the meta-description budget allows.

     Deliberately category-first rather than location-first: Johannesburg and
     South Africa are stated in the Organization node's `address` and
     `areaServed` and in the ProfessionalService node beside it (both in
     `app/layout.tsx`), which is where a knowledge panel reads them from. */
  description:
    "Vyso builds tailored operational systems that automate repetitive work, connect your business data and tell you when something needs your attention.",

  locale: "en-ZA",

  address: {
    addressLocality: "Johannesburg",
    addressCountry: "ZA",
  },

  founder: {
    name: "Josh Moreira",
    jobTitle: "Founder",
  },

  /* TODO(user): add public profile URLs once they exist (LinkedIn, X, GitHub
     org, Crunchbase, YouTube — per `.ai/vyso_v2.md` §7.3). The JSON-LD graph
     in `app/layout.tsx` omits `Organization.sameAs` entirely while this stays
     empty, rather than publish a `sameAs: []`, which would misrepresent an
     absence of profiles as a checked-and-empty list. */
  sameAs: [] as string[],
} as const;

export default SITE;

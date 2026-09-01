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

  /* The §7.4 entity statement, trimmed to fit a meta description (≤155 chars):
     "Vyso is a Johannesburg-based company whose product, Finch, is an AI
     operations assistant — a company's own COO — for South African food and
     produce SMEs, at R6,000 per location per month." → dropped "-based" and
     the "own COO" aside (carried elsewhere in the copy, e.g. the homepage H1)
     to land at 154 characters without changing any fact. */
  /* Agency repositioning (2026-09, `.ai/positioning_agency_2026.md`): Vyso is
     the AI automation agency; Finch is an example build, not the entity. */
  description:
    "Vyso is a Johannesburg AI automation agency. We design, build and run custom AI workflows around the tools a business already uses — with humans approving what matters.",

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

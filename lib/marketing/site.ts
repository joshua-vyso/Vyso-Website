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

  /* `.ai/plan_home_only.md`, change 2: the entity statement leads with what
     Vyso *is* — an AI automation agency — because that is both the truth and
     the query the home page is written to answer ("AI automation agency South
     Africa"). It also carried the old published monthly price, which nothing on
     the site quotes any more. Counted: 149 characters, inside the 155 the
     meta-description budget allows. */
  description:
    "Vyso is an AI automation agency in Johannesburg building operational automation for South African SMEs: orders, invoices, stock, quotes and debtors.",

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

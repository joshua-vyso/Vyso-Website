# Plan: Vyso site rebrand + restructure (Finch launch)

> Place at `.ai/plan_site_rebrand.md`. Fable: verify everything below against the
> actual repo before approving — the page inventory here comes from the live site
> and may not match the codebase 1:1. Do not begin implementation until the user
> approves this plan AND the deletion list in Step 2.

## Goal

Rebrand vyso.co.za around the new positioning — Vyso (the company) builds **Finch:
your company's own COO at a tenth of the cost** — with new copy, new pricing, a
restructured page tree, and a full visual overhaul (white background, burnt orange +
light blue, Attio/Stripe/Firecrawl-grade craft, zero glassmorphism). Also add two
quiet experimental vertical pages (security companies, insurance brokers) for
outreach testing WITHOUT diluting the food/produce focus of the main site.

## Positioning facts (settled — do not re-litigate in implementation)

- Vyso = the company (audits, Academy, the brand on the invoice). Finch = the
  product/offering (the digital COO, incl. the companion app). Finch only ever
  appears inside Vyso's frame — one brand story, two levels.
- Offer structure: Vyso Academy (workshops, "coming soon") · Operations Audit
  (R2,000, credited to first month — the front door) · Finch (R6,000 per location
  per month, everything included, agents+modules activated in priority order from
  the audit roadmap).
- Founding terms, now public: setup waived · first month free · rate locked for as
  long as you stay.
- Expanded mandates (multi-entity, custom integrations): "priced on scope" — one
  line, not a tier.
- Primary vertical: South African food & produce SMEs. This does not change.

## Acceptance criteria

1. Homepage leads with the Finch hero (copy in Step 4), a finding-card hero visual
   labelled "Illustrative example" (swap for a real redacted finding when Price
   Watch ships), and the scroll sequence storyboard (Step 5). Module grid demoted
   to an "Under the hood" strip near the footer.
2. Pricing page reduced to the single-offer copy in Step 4. Old Start/Create/Scale
   tiers and all setup-fee references removed sitewide (grep for "R10,000",
   "R30,000", "R50,000", "setup").
3. Waitlist form: tier dropdown deleted; primary CTA sitewide becomes "Book your
   audit".
4. Zero glassmorphism remains: no `backdrop-filter`/`backdrop-blur`, no translucent
   card backgrounds, no glow borders (grep the codebase; acceptance = zero hits
   outside of any chart tooltips).
5. Colour discipline enforced via tokens: burnt orange ONLY for agent-activity
   accents + primary CTA; light blue ONLY for evidence/data moments. No gradients
   except the orange→blue signature, used at most once per page.
6. Page tree matches the approved Step 2/3 lists; every removed page has a 301
   redirect to its nearest surviving equivalent (next.config redirects).
7. Experimental pages exist at /industries/security-companies and
   /industries/insurance-brokers: indexed, linked from the industries index page
   ONLY — not in header nav, not on the homepage.
8. All copy claims are true today: no named agents presented as live except
   document intelligence (Doc-U); agent roster framed as "what Finch watches",
   with Price Watch marked as rolling out. No fabricated testimonials, stats, or
   client counts. Roberto/Turn 'n Slice remains the only quoted client.
9. Animations: Framer Motion, scroll-linked, 150–250ms micro-interactions,
   `ease-out`, all gated behind `prefers-reduced-motion`. Lighthouse performance
   ≥ 90 mobile on homepage; CLS < 0.1 (scroll sequences must reserve layout).
10. Build passes: type-check, lint, `next build` clean. No broken internal links
    (run a link checker over the built output).

## Step 1 — Inventory (before any changes)

Crawl the repo's route tree (app router pages) and produce the real page list in
`.ai/implementation.md`, diffed against the list below. Flag any page that exists
in the repo but not in this plan.

## Step 2 — Removals/consolidations (PROPOSED — user must approve this list)

- /pricing-faq → merge surviving Q&A into /pricing; 301.
- /compare/vyso-vs-spreadsheets + /compare/vyso-vs-erp-systems → consolidate into
  one /compare page reframed as "Finch vs hiring / vs ERP / vs DIY"; 301s.
- /solutions/* (reduce-money-leakage, procurement-automation, reporting-automation,
  operations-dashboard) → replaced by the agents section on the homepage + /finch
  product page; 301 each to the closest anchor. Keep /solutions as a redirect only.
- /platform/vyso-for-smes → fold into /finch; 301.
- /platform#orderflow module deep-links → /finch#under-the-hood.
- Old tier references on /founding-client → page stays, rewritten to the new
  founding terms.
- Fable: propose additional removals from the Step 1 inventory (thin/duplicate
  pages), but delete NOTHING without the user approving the final list.

## Step 3 — Additions

- **/finch** — the product page: what a COO does daily, the agent roster ("what
  Finch watches": prices, reconciliation, debtors, stock, the weekly brief), the
  app (brief-in-your-pocket), "we put your current tools into Finch" integrations
  framing, honest rollout status per agent.
- **/academy** — one section: what it will be, R2,500/seat workshop concept,
  email capture ("interested? tell us"). Clearly "coming soon". Footer-linked.
- **/industries/security-companies** (experimental) — same Finch mechanics in
  their vocabulary: guard rostering vs contract hours, client-site profitability,
  supplier/vehicle cost creep, incident-report intake via Doc-U, invoice-to-
  contract reconciliation. Honest framing: "Finch is built for operations-heavy
  SMEs; here's what it watches in a security business." No fake case studies.
- **/industries/insurance-brokers** (experimental) — renewal tracking, commission-
  statement reconciliation (Doc-U is genuinely strong here), client follow-up
  cadence, document-heavy admin. Same honesty rules.
- Both experimental pages carry the standard CTA (book audit) and a shared
  analytics event so outreach performance is measurable per vertical.

## Step 4 — Copy (homepage hero + pricing; Fable expands remaining sections in the
same voice: calm, specific, operator-to-operator, ZAR everywhere)

Hero:
  H1: Meet Finch. Your company's own COO — at a tenth of the cost.
  Sub: Your business runs on WhatsApp, spreadsheets and gut feel. Finch's AI
  agents watch your invoices, stock, suppliers and margins — catch money leaking,
  and tell you what to do about it. Built by Vyso for South African food
  businesses. R6,000 per location, everything included.
  CTA: Book your audit → secondary: See how Finch works

Pricing page, in full:
  R6,000 per location, per month. Everything included.
  Every module and agent, activated in priority order from your operations audit.
  Monthly ops review with your Vyso lead. Cancel with 30 days' notice.
  Founding clients: setup waived · first month free · rate locked for as long as
  you stay.
  Every engagement starts with a one-week Operations Audit — R2,000, credited to
  your first month.
  Multi-entity groups and custom integrations: expanded mandates priced on scope.

## Step 5 — The scroll sequence (homepage centrepiece)

One continuous scroll-linked section, five beats, each reserving fixed layout:
  1. A supplier invoice drifts in (real-looking, redacted SA produce invoice).
  2. Doc-U extraction: line items highlight in light blue, structured rows appear.
  3. Price history chart draws itself for one item across months.
  4. A finding card assembles piece by piece — observation text, rand impact
     stamps in burnt orange, evidence chip ("3 invoices"), action buttons.
  5. The card slides into a phone frame as a Finch WhatsApp-style brief:
     "Morning. 3 things need your attention — one's worth R4,200."
Finding card is the atomic visual reused across the site (hero, features,
industries pages with vertical-specific example content).

## Constraints / do not touch

- No changes to the app itself, auth, Supabase schema, or Doc-U.
- No new dependencies beyond Framer Motion (if not already present).
- Turn 'n Slice case study page: copy refresh only, no claim changes.
- Do not remove /login.

## Edge cases

- Old URLs in the wild (LinkedIn posts, emails) → the 301 map must cover every
  removed route; test with the link checker against the OLD sitemap.
- OG images still say "Operations, connected." → regenerate for Finch hero.
- prefers-reduced-motion → scroll sequence degrades to static beats, no jumps.
- Meta/SEO: titles + descriptions rewritten for the COO positioning; keep
  local-SEO pages (/south-africa) intact.

## Verification

```bash
npm run type-check && npm run lint && npm run build
grep -rn "backdrop-blur\|backdrop-filter" src/ | wc -l   # expect 0
grep -rn "R10,000\|R30,000\|R50,000" src/ | wc -l        # expect 0
npx linkinator http://localhost:3000 --recurse            # zero broken links
npx lighthouse http://localhost:3000 --preset=perf        # perf ≥ 90 mobile
```

Record all deviations and the approved deletion list in `.ai/implementation.md`.

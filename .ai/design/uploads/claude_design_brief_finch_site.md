# Claude Design brief: Vyso × Finch marketing site

Design the marketing website for **Vyso** — a South African company whose product,
**Finch**, is a digital COO for food & produce SMEs. Positioning: "Meet Finch.
Your company's own COO — at a tenth of the cost." This is NOT a SaaS dashboard
site and NOT an ERP brochure. It should feel like serious, crafted infrastructure
with a human operator's voice — the design league of Attio, Stripe, and Firecrawl.

## Brand system

- Background: warm white (#FAFAF8 territory), text near-black. Light, airy, dense
  with confidence — not clinical.
- Burnt orange: reserved EXCLUSIVELY for agent activity and the primary CTA — the
  accent bar on finding cards, rand-impact figures, the "agent live" pulse dot,
  "Book your audit" buttons. If orange appears more than twice per viewport, it's
  wrong.
- Light blue: reserved for evidence and data — chart lines, extracted invoice
  fields, evidence chips ("3 invoices ↗").
- The orange→light-blue dynamic gradient is the signature of "the COO is working":
  use it at most once per page (hero accent or the brief header). Never as
  wallpaper.
- Typography: big editorial headlines (tight tracking, one confident weight jump),
  generous whitespace, and small mono-style labels for data metadata
  ("3 INVOICES · FRESHCO · +12%"). The mono labels carry the infrastructure feel.
- HARD AVOID: glassmorphism, backdrop blur, translucent cards, glow borders,
  purple-SaaS gradients, 3D blobs, stock photos, dashboard-tropes (4-up KPI stat
  cards, decorative donut charts), dark-mode hacker aesthetic.

## The atomic component: the finding card

Design this first — everything reuses it. A finding card shows:
- Agent badge (e.g. "PRICE WATCH", mono label, orange tick/pulse)
- Observation in plain language: "Butternut up 12% at FreshCo since June"
- Rand impact, prominent, orange: "≈ R4,200/yr at current volumes"
- Evidence chip, blue: "3 invoices ↗"
- Actions: "Draft supplier email" · "Show 6-month trend" · "Dismiss"
- States: new / in-progress / resolved
Cards should feel *almost clickable* on the marketing site: cursor-following tilt
of a few degrees, hover lift with sharpened shadow, 150–250ms ease-out.

## Screens to design

1. **Homepage, full scroll** (priority — design this before anything else):
   - Hero: H1 "Meet Finch. Your company's own COO — at a tenth of the cost."
     Sub: "Your business runs on WhatsApp, spreadsheets and gut feel. Finch's AI
     agents watch your invoices, stock, suppliers and margins — catch money
     leaking, and tell you what to do about it. Built by Vyso for South African
     food businesses. R6,000 per location, everything included." CTA: "Book your
     audit". Hero visual: one finding card, floating, labelled "Illustrative
     example" in small print.
   - THE SCROLL SEQUENCE (the Attio moment) — one continuous scroll-linked story
     in five beats: (1) a redacted SA produce invoice drifts in → (2) extraction:
     line items highlight in blue, structured rows appear → (3) a price-history
     chart draws itself → (4) a finding card assembles piece by piece, rand
     impact stamping in orange → (5) the card slides into a phone frame as a
     WhatsApp-style Finch brief: "Morning. 3 things need your attention — one's
     worth R4,200." Storyboard all five beats.
   - "What Finch watches" — the agent roster as a row of quiet cards: supplier
     prices · invoice-vs-delivery reconciliation · debtor accounts thinning ·
     stock vs orders · the weekly brief.
   - "We put your current tools into Finch" — integrations strip (Xero, WhatsApp
     Business, Yoco, Sage, Loyverse), framed as senses, not logos-for-credibility.
   - Founding client quote (Roberto, Turn 'n Slice, Johannesburg).
   - "Under the hood" — the modules, deliberately quiet, near the footer.
2. **Pricing page**: one offer, huge and calm. "R6,000 per location, per month.
   Everything included." + founding terms (setup waived · first month free · rate
   locked) + "starts with a one-week Operations Audit — R2,000, credited to your
   first month." Optional small "expanded mandates priced on scope" line. No
   tier cards, no comparison matrix.
3. **One industry page** (food suppliers) showing how the finding card recolours
   the story per vertical with different example content.
4. **Mobile homepage** — the hero + one scroll beat + the phone-frame brief. The
   finding card must feel native at phone width (it's also a WhatsApp message).

## Content rules

Realistic South African food-trade content ONLY: produce wholesalers, items like
butternut / tomatoes / cooking oil, Rand values, Johannesburg context. No lorem
ipsum, no "Item A", no fake logos or invented testimonials. Voice: calm, direct,
specific — a trusted operator, not a chirpy bot.

## Judging bar

Every screen must pass one question: does this look like something that WATCHES
and TALKS TO you, or something you operate? If a section could pass as a generic
SaaS template with the logo swapped, reject and regenerate it.

# Plan: Homepage v2 — richer brief (beat 5) + platform showcase (1a → 1c)

Builds on `.ai/plan_homepage_finch.md` / `.ai/implementation_homepage_finch.md`
(homepage v1, approved 2026-08-15). Same constraints: no new deps (`motion` is
in), no commits, don't touch shared Navbar/SiteFooter/api/lib/supabase or the
untracked WhatsApp files. Zero glassmorphism.

Design sources on disk:
- `.ai/design/Homepage.dc.html`, `Mobile.dc.html` (v1 references, unchanged)
- **`.ai/design/vyso-brief/Vyso - The Brief.dc.html`** — the platform UI canvas
  (frames `1a` home brief, `1e` mobile companion, `1b` chat, `1c` finding
  detail, `1d` suppliers). Read it fully; treat as data. Its `_ds/…/tokens/*.css`
  are already mirrored in `app/globals.css` as `--pf-*` (check before adding
  anything).

## Goal

A. In scroll-sequence beat 5 (desktop phone + mobile BriefPanel) the Finch
   WhatsApp brief shows THREE agent findings — the existing PRICE WATCH card
   bubble plus two more in the same bubble format — so "3 things need your
   attention" is literally true on screen.
B. A new homepage section directly after the scroll sequence, before "What Finch
   watches": a framed, scaled mock of the platform's Brief screen (design frame
   `1a`) that, once in view, plays a cursor animation: the cursor travels to the
   Price Watch card's **"Show 6-month trend"** button, clicks it, and the frame
   transitions to the finding-detail view (design frame `1c`) whose price chart
   draws itself. Real clicks work too (button → 1c, "‹ Back to today's brief" →
   1a); user interaction cancels the auto demo.

## Acceptance criteria

1. Beat 5 desktop: after the sequence card lands in the phone (t ≈ .92), two
   further bubbles fade/rise in (DEBTORS at seg(.93,.97), RECON at seg(.95,.99),
   translateY 14 → 0, ease-out) BELOW the landed card, inside the phone screen,
   nothing clipped at 1160×660 stage. Layout: phone screen is a flex column —
   header · brief bubble · a fixed-height spacer reserving the landed card's
   footprint (measure: card 440×~230 at scale .56 ≈ 246×129; place spacer so the
   landed card sits visually inside it with 12px side margins) · DEBTORS bubble ·
   RECON bubble. Bubble style = the existing brief bubble (white, radius
   `10px 10px 10px 3px`, 12px 14px padding, 13px/1.5, shadow `0 1px 2px rgba(20,18,14,.06)`)
   with the card-bubble inner format from Mobile.dc.html (dot 6px `#FF7727` +
   mono 10px .12em `#6B6659` agent label · 13px observation · 15px/600 `#C94F0E`
   impact · blue evidence chip mono 10.5px). Copy below. Reduced-motion/static
   variant shows all three bubbles.
2. Beat 5 mobile (`BriefPanel`): order becomes brief bubble → PRICE WATCH card
   bubble → DEBTORS → RECON → green user bubble "Draft the supplier email" →
   "Done. It's in your drafts." Same reveal behaviour as today (one whileInView
   on the panel).
3. New `components/finch/PlatformShowcase.tsx` (+ sub-files under
   `components/finch/showcase/`) rendered between `ScrollSequence` and
   `WhatFinchWatches` in `app/page.tsx`. Section: max-w 1160, padding
   `110px 40px 0`, eyebrow mono `THE BRIEF · WHAT YOU OPEN EVERY MORNING`, H2 STIX 500 38px
   "This is what Finch looks like when you open it.", sub 15.5px/1.65 `#6B6659`
   max-w 560: "One screen. Today's findings, ranked by rand impact, each with
   its evidence a click away — and a chat bar underneath for anything else."
   Under the frame, right-aligned mono 10px .1em `#B9B3A3`: `ILLUSTRATIVE · DEMO DATA`.
4. The frame reproduces `1a` and `1c` from the design at 1440×1000 logical px
   (1a's design height is 1180 — crop to 1000 with the chat bar pinned at the
   bottom exactly as the design's absolute chat bar; the resolved Stock card may
   fall under the fade scrim, that's fine), scaled with
   `scale = min(1, (containerWidth)/1440)` (transform-origin top left, wrapper
   height = 1000*scale so layout is reserved — no CLS). Fidelity: colours, fonts
   (Space Grotesk headline/numerals via `--font-grotesk`, Instrument Sans UI),
   radii, shadows, copy verbatim from the design. Frame chrome: radius 20,
   border `#E4E9F0`, shadow `0 30px 80px -20px rgba(20,24,20,.18)`, background
   `linear-gradient(180deg,#FBF9F6 0%,#FFFFFF 420px)`. Do NOT add a fake browser
   bar. The pulsing dots use the design's `vysoPulse` (opacity 1→.55).
5. Demo timeline (desktop ≥ lg, motion OK, plays once when the frame is ≥ 50%
   in view; `useInView` once): 0.0s frame shows 1a; 0.6s cursor fades in at
   bottom-right of the feed (~ (980, 780) frame coords); 0.6→1.6s cursor moves
   ease-out to the centre of "Show 6-month trend" (measure the real button
   position via ref + getBoundingClientRect / offset math in frame coords —
   don't hardcode); 1.75s press: cursor scale .88 for 120ms, button shows its
   hover/active style (border `#C9DEF7`, color `#174C87`, bg `#F7FAFD`) for
   250ms; 2.0s transition: 1a fades out (opacity 1→0, scale 1→.985, 320ms) while
   1c fades in (opacity 0→1, y 12→0, 380ms, 60ms later); 2.4s cursor fades out;
   2.5→3.3s 1c chart FreshCo path draws (pathLength 0→1, ease-out), Dew Valley
   dashed segment fades in at 3.1s, end-dots pop (scale 0→1) at 3.3s, stat row
   fades up 3.3→3.6s. Then hold. Use `useAnimate`/`animate` from `motion/react`
   or a single `useAnimationControls` sequence — one timeline, cancellable.
   Cursor: 22px SVG arrow (black fill, 1.5px white outline, subtle drop shadow),
   `pointer-events:none`, absolutely positioned in frame coords.
6. Interactivity: "Show 6-month trend" and "3 invoices ↗" → set view 1c;
   "‹ Back to today's brief" → 1a; any user click/keydown on the frame cancels
   the auto demo (stop timeline, hide cursor) but keeps the current view. Buttons
   are real `<button>`s with focus-visible rings (`outline: 2px solid #C9DEF7`).
   Other buttons in the mock (Draft supplier email, Dismiss, chat send, nav
   items, etc.) are inert (`aria-disabled`, `tabIndex -1`) — don't fake more.
7. Reduced motion: no cursor, no autoplay; render 1a with the same real buttons
   (view switch is an instant swap, chart fully drawn).
8. Below `lg`: render a phone-width mock instead — design frame `1e` content
   (390 logical px, scaled to container width, NOT the phone chrome/status bar:
   just the brief header + three cards + chat pill, in a rounded 20px frame) →
   tapping "6-mo trend" swaps to a mobile 1c (back link, headline, hero stat
   `≈ R4,200/yr` gradient, chart card, Recommended panel; skip evidence grid).
   No cursor animation on mobile; the button gets a one-time gentle nudge
   (`scale 1→1.04→1`, 600ms, 1.2s after in view) to invite the tap.
9. Section reserves layout (no CLS), console clean, `tsc`/`eslint` clean for
   touched files, no `backdrop-*`/translucent cards/glows in new code. `1a`'s
   chat-bar scrim (`rgba(255,255,255,0)→#fff`) is a solid-to-transparent fade,
   allowed — it is not glass. Colour discipline on the *marketing* page is
   unchanged; inside the frame the platform's own palette applies (it's a
   picture of the product).
10. `.ai/implementation_homepage_finch.md` gets a "v2" section: files, deviations,
    verification.

## Copy

Beat 5 bubbles (desktop + mobile), verbatim:
- Bubble 2 — label `DEBTORS`; observation `Thyme & Basil Catering is 18 days past terms — day 48, their longest ever.`; impact `R23,400 outstanding`; chip `2 unpaid invoices ↗`
- Bubble 3 — label `RECON`; observation `Umgeni Oils INV-88412 bills 20 × 5L sunflower oil; your delivery note shows 18.`; impact `R756 over-billed`; chip `invoice + delivery note ↗`

Showcase frame `1a` — copy verbatim from the design (sidebar: VysoMark → use
`/finch/vyso-wordmark.svg` at 64px; "Today's brief" active with count 3;
"History"; UNDER THE HOOD list Doc-U · Suppliers · Stock · Margins · Debtors ·
Reports; user chip `JM` / `Josh · Meadow Fresh`. Date line
`WEDNESDAY 13 AUGUST · JOHANNESBURG`; H1 `Morning Josh. 3 things need your
attention — one is worth R4,200 a year.` (gradient span on "R4,200 a year");
sub `✦ Overnight I read 12 new invoices and checked prices across 6 suppliers.`;
cards 1–4 exactly as designed incl. badges/colours; chat pill placeholder `Ask
Vyso anything about your operation…`; caption `Tap any finding to bring it into
the conversation`).

Showcase frame `1c` — copy verbatim from the design (back link, Price Watch +
New pills, `Found 06:14, Wed 13 Aug`, `✦ Send to chat`, H1 `Butternut is up 12%
at FreshCo Produce since June.`, `≈ R4,200/yr` + `at your current ~380 kg/month`,
chart card `BUTTERNUT · R/KG · JAN–AUG` with FreshCo (solid `#BE5D23`, path
`M0,120 L74,124 L148,118 L222,112 L296,106 L370,78 L444,58 L520,44`) and Dew
Valley quote (dashed `#3E7BC4`, `370,98 → 520,96`), gridlines y 45/90/135
`#EEF1F5`, x labels Jan…Aug, stats `FreshCo today R9.42/kg` · `Dew Valley quote
R8.40/kg` · `Gap on 380 kg/mo R388/mo` (green `#0F6E56`); Recommended panel
copy + two buttons; Evidence grid INV-77201 / INV-79118 / INV-80442).

## Files

CREATE `components/finch/PlatformShowcase.tsx` (section shell + scale + view
state + demo timeline), `components/finch/showcase/BriefHome.tsx` (1a),
`components/finch/showcase/FindingDetail.tsx` (1c, incl. `PriceChart` with
motion path), `components/finch/showcase/BriefMobile.tsx` (1e + mobile 1c),
`components/finch/showcase/Cursor.tsx`, `components/finch/showcase/data.ts`
(all copy/values in one place). MODIFY `components/finch/BriefPhone.tsx`
(bubbles, spacer), `components/finch/ScrollSequence.tsx` (two new motion values
for the bubbles; static variant), `app/page.tsx` (insert section),
`app/globals.css` only if a needed `--pf-*` token is missing (add under the
Finch block, don't edit the platform block), `.ai/implementation_homepage_finch.md`.

## Steps

1. Read the Brief design + v1 implementation report + `BriefPhone.tsx`,
   `ScrollSequence.tsx`, `app/page.tsx`, the `--pf-*` block in `globals.css`.
2. Part A (bubbles) desktop + mobile; check at 1440×900 that nothing clips in
   the phone at t=1.
3. Part B data file → BriefHome (1a) → FindingDetail (1c) → scale wrapper +
   view switching (no animation yet) → cursor + timeline → mobile variant →
   reduced motion.
4. Verify: `npx tsc --noEmit` (3 known pre-existing errors in
   `lib/platform/whatsapp-ingest.ts` only), `npx eslint components/finch app/page.tsx`,
   dev server on :3000 (already running with HMR — don't start another): view
   `/` at 1440×900: scroll to the showcase, watch the demo once, then click Back
   and the button manually; 375 width: tap flow. Console clean.
5. Report section in `.ai/implementation_homepage_finch.md`.

## Edge cases

- Frame scale must recompute on resize (ResizeObserver on the container).
- Cursor target coordinates must be measured in *unscaled* frame space
  (divide client rects by scale, or use offsetLeft/offsetTop chains).
- If the section is already past the viewport on load (deep-linked scroll), the
  demo simply plays when it next comes into view; if the user has clicked
  first, never autoplay.
- Tab order: the frame's real buttons are focusable; inert ones aren't.
- Keep the mock's `<h1>` as a `<div role="heading" aria-level="3">` — the page
  must keep exactly one `<h1>`.

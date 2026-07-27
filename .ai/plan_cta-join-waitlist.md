# Plan: Sweep marketing CTAs to "Join Waitlist" + hide create-account (keep code)

## Goal
Every visible contact-style CTA on the marketing site reads **"Join Waitlist"**. The visible option to create an account is hidden behind a flag, with all auth/onboarding code preserved. No DB or API changes (a previous waitlist sweep with DB capture was reverted — do NOT reintroduce waitlist capture; CTAs keep pointing at `/contact`).

## Acceptance criteria
- Top-right nav button, mobile menu CTA, mega-menu contact link, all page-level contact CTAs read "Join Waitlist".
- "Log in" links and the authenticated "Go to dashboard" CTA are UNCHANGED (clients still log in).
- `/login` no longer shows "New to Vyso? Create an account", gated by a `SIGNUP_ENABLED = false` constant; signup/verify pane code untouched.
- No route, API, or component deletions. `npx tsc --noEmit` passes.

## Files you OWN (no other agent touches these)
`components/Navbar.tsx`, `components/sections/ContactSection.tsx`, `app/contact/page.tsx`, `components/marketing/PublicMarketing.tsx`, `app/platform/page.tsx`, `app/platform/finch/page.tsx`, `app/platform/vyso-for-smes/page.tsx`, `app/south-africa/page.tsx`, `app/founding-client/page.tsx`, `app/industries/[slug]/page.tsx`, `app/case-studies/turn-n-slice/page.tsx`, `app/login/page.tsx`, `components/HeroSection.tsx` (verify-only).

## Files you must NOT touch (owned by other concurrent agents)
`components/sections/PricingSection.tsx`, `components/ContactForm.tsx`, `app/faq/page.tsx`, `app/pricing/page.tsx`, `components/platform/ModulesOverlay.tsx`, `tsconfig.json`, `app/sitemap.ts`, `app/robots.ts`, anything under `desktop/`. Also do not touch `app/about/`, `app/apps/`, `app/services/` (dead, redirected routes), `app/api/**`, `components/platform/MarketingAuth.tsx` (login CTAs stay as-is), onboarding components, or supabase/.

## Exact edits
1. `components/Navbar.tsx`
   - L489–502 desktop pill button: text "Contact us" → **"Join Waitlist"** (keep `href="/contact"`, keep LiquidButton/GradientText structure).
   - Mobile menu (~L626): "Contact us →" → "Join Waitlist →" (keep href).
   - Platform mega-menu Explore column (~L443): "Talk to Vyso" → "Join Waitlist" (keep href `/contact`).
   - Keep `<NavLoginLink />` (L488) and mobile "Log in →" exactly as they are.
2. `components/sections/ContactSection.tsx` (home-page bottom form section)
   - L74 eyebrow "Get in touch" → "Join the waitlist".
   - L101 "Send an enquiry and we'll get back within 24 hours." → "Add your details and we'll get back within 24 hours."
   - L139 card heading "Send an enquiry" → "Join the waitlist".
   - Keep headline, badge, mailto link.
3. `app/contact/page.tsx`
   - L128 eyebrow "Get in touch" → "Join the waitlist".
   - L189 heading "Send an enquiry" → "Join the waitlist".
   - Leave metadata/canonical/JSON-LD alone.
4. `components/marketing/PublicMarketing.tsx`
   - `MarketingCta` default `primaryLabel` "Talk to Vyso" → **"Join Waitlist"** (L72). Default href stays `/contact`.
5. Page-level CTA labels — change ONLY labels whose href is `/contact`; leave links to `/founding-client`, `/pricing`, `/platform*`, `/faq`, anchors, and "Explore/Read/View" navigation untouched:
   - `app/platform/page.tsx` L491–497: primary label → "Join Waitlist" (if it passes an explicit label; if it relies on the default, nothing needed).
   - `app/platform/finch/page.tsx` L234–241: secondary "Talk to us" → "Join Waitlist" (href /contact). Primary "Become a founding client" (→ /founding-client) stays.
   - `app/platform/vyso-for-smes/page.tsx` L184–186 "Discuss your workflow →" → "Join Waitlist →"; L282–288 primary "Book an audit conversation" → "Join Waitlist".
   - `app/south-africa/page.tsx` L198–200 "Discuss your workflow →" → "Join Waitlist →"; L392–398 primary "Discuss your workflow" → "Join Waitlist".
   - `app/founding-client/page.tsx` L125–127 "Apply to become a founding client →" → "Join Waitlist →" (href /contact); L248–255 primary "Start the conversation" → "Join Waitlist".
   - `app/industries/[slug]/page.tsx` L256–258 "Discuss your operation →" → "Join Waitlist →"; L360–366 primary "Talk to Vyso" → "Join Waitlist".
   - `app/case-studies/turn-n-slice/page.tsx` L215–221 primary "Discuss your invoicing workflow" → "Join Waitlist".
6. `app/login/page.tsx` — hide create-account, preserve code:
   - Add near the top (after imports, before the component): `const SIGNUP_ENABLED = false; // set true to restore self-serve signup`
   - Wrap the "New to Vyso? … Create an account" block (currently L378–387) so it renders only when `SIGNUP_ENABLED` is true.
   - Change NOTHING else in this file: the signup pane, verify pane, headings, `supabase.auth.signUp` logic all stay (they become unreachable, which is the point).
7. `components/HeroSection.tsx` — verify only: "See how it works" (anchor) and `<HeroAuthCta />` stay unchanged.

## Edge cases
- Line numbers are from a recent audit; verify with a quick read before each edit.
- Some labels include a trailing "→" glyph rendered separately — preserve arrow markup.
- Do not change `aria-label`s referencing navigation semantics unless they repeat the old label text (if an aria-label says e.g. "Contact us", update it to match).

## Verification
- `cd "/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website" && npx tsc --noEmit`
- `grep -rn "Talk to us\|Talk to Vyso\|Get in touch\|Send an enquiry\|Contact us" components app --include='*.tsx' | grep -v "app/about\|app/apps\|app/services\|app/api\|faq\|Pricing\|ContactForm"` → should return no visible-CTA hits in your owned files.
- Do NOT run `git add`/`git commit`.

## Output
Write outcomes/deviations to `.ai/implementation_cta-join-waitlist.md`.

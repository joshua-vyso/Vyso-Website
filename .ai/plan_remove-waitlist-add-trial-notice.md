# Plan: Remove the waitlist, restore original CTAs, add an early-access trial notice

Status: approved by user (2026-07-24). Branch `finch-onboarding`.

## Goal
1. Remove the entire "Join Waitlist" feature added in Phase B (commit `6cfd0ef`) and restore every marketing CTA to exactly what it was before — top-right navbar CTA back to "Contact us" → `/contact`, and all `MarketingCta`/pricing CTAs back to their pre-waitlist labels/links.
2. Remove the waitlist DB objects from `supabase/onboarding.sql` (the already-applied live table is harmless and left in place; noted for the user).
3. Add a friendly "Vyso is in early access / testing phase" disclaimer where a user starts the 14-day free trial.

## Acceptance criteria
- No `WaitlistModal`, `WaitlistCtaButton`, or `/api/waitlist` remain; `grep -ri waitlist app components` returns only (a) the reworded founding-client line restored to original and (b) nothing in live UI.
- Navbar top-right shows "Contact us" → `/contact` (desktop + mobile), mega-menu "Talk to Vyso" restored; `MarketingCta` default + all 7 page overrides restored to pre-Phase-B copy; PricingSection audit banner + 3 tier CTAs restored.
- The signup pane (and onboarding welcome) shows a short, warm early-access notice.
- `npx tsc --noEmit` and `npx eslint` (on changed files) pass. `npm run build` compiles.

## Approach
- **Revert Phase B cleanly:** `git revert --no-edit 6cfd0ef`. That deletes the 3 added files and restores all CTA files to their exact pre-waitlist state. Resolve conflicts if any (later commits touched different files, so none expected). If the revert is messy, fall back to manual restoration of: `components/Navbar.tsx`, `components/marketing/PublicMarketing.tsx` (MarketingCta), the 7 callers (`app/south-africa`, `app/platform/finch`, `app/platform/page`, `app/industries/[slug]`, `app/platform/vyso-for-smes`, `app/case-studies/turn-n-slice`, `app/founding-client`), `components/sections/PricingSection.tsx`, and delete `components/marketing/WaitlistModal.tsx`, `components/marketing/WaitlistCtaButton.tsx`, `app/api/waitlist/route.ts`.
- **Strip waitlist SQL:** remove the `waitlist_signups` table + `waitlist_join(...)` function from `supabase/onboarding.sql`. Do NOT add a DROP (won't auto-run; the live table is harmless). Leave a one-line comment that the table was removed and can be dropped manually if desired.
- **Trial notice:** add a small muted disclaimer in `app/login/page.tsx` signup pane (near the "Start your 14-day free trial" button), matching the pane's existing muted-text style. Suggested copy (tune to fit): *"Vyso is in early access — we're still polishing things, so you may hit the occasional rough edge. You're one of the first to use it, and your feedback helps us make it better."* Also add a brief matching line to the onboarding welcome (OnboardingFlow intro or `app/onboarding/layout.tsx`). Keep it reassuring, not alarming; no bug-list, no legalese.

## Constraints
- Touch only the files above. Do not revert/alter the Finch rebrand, onboarding, trial-gate, rate-limit, or icon work. Do not touch serviceden files. Never `git add -A`.
- The revert commit + the SQL/notice edits may be one or two commits; explicit paths only.

## Verification
`npx tsc --noEmit`; `npx eslint <changed>`; `grep -ri waitlist app components` clean; `npm run build`. Report before/after of the navbar CTA.

# Implementation: Sweep marketing CTAs to "Join Waitlist" + hide create-account

Status: complete. All edits made only within the owned file list from
`.ai/plan_cta-join-waitlist.md`. No other files were touched.

## Changes by file

### components/Navbar.tsx
- L500: desktop pill CTA text `Contact us` → `Join Waitlist` (inside `<GradientText>`, `href="/contact"` and `LiquidButton` structure unchanged).
- L626: mobile menu CTA `Contact us →` → `Join Waitlist →` (href unchanged).
- L443: mega-menu Explore column entry `{ label: "Talk to Vyso", href: "/contact" }` → `{ label: "Join Waitlist", href: "/contact" }`.
- `<NavLoginLink />` (L488) and mobile `Log in →` (L614) left untouched, as required.

### components/sections/ContactSection.tsx
- L74: eyebrow `Get in touch` → `Join the waitlist`.
- L101: subtext `Send an enquiry and we'll get back within 24 hours.` → `Add your details and we'll get back within 24 hours.`
- L139: card heading `Send an enquiry` → `Join the waitlist`.
- Headline, badge, mailto link unchanged.

### app/contact/page.tsx
- L128: eyebrow `Get in touch` → `Join the waitlist`.
- L189: heading `Send an enquiry` → `Join the waitlist`.
- Metadata (`title`, `description`, OpenGraph, Twitter, JSON-LD `contactSchema`) left untouched — these still contain the phrase "Send an enquiry" in description copy, which is expected per the plan ("Leave metadata/canonical/JSON-LD alone") and shows up in the verification grep as a non-visible-CTA hit.

### components/marketing/PublicMarketing.tsx
- L72: `MarketingCta` default `primaryLabel = "Talk to Vyso"` → `primaryLabel = "Join Waitlist"`. Default `primaryHref` stays `/contact`.

### Page-level CTAs (href `/contact` only; other hrefs untouched)
- `app/platform/page.tsx`: `MarketingCta` explicit `primaryLabel="Talk to Vyso"` → `"Join Waitlist"`.
- `app/platform/finch/page.tsx`: `MarketingCta` `secondaryLabel="Talk to us"` (href `/contact`) → `"Join Waitlist"`. Primary `"Become a founding client"` (→ `/founding-client`) untouched.
- `app/platform/vyso-for-smes/page.tsx`: hero CTA `Discuss your workflow →` → `Join Waitlist →` (href `/contact`); `MarketingCta` `primaryLabel="Book an audit conversation"` → `"Join Waitlist"` (default href `/contact`, secondary `"Become a founding client"` untouched).
- `app/south-africa/page.tsx`: hero CTA `Discuss your workflow →` → `Join Waitlist →` (href `/contact`); `MarketingCta` `primaryLabel="Discuss your workflow"` → `"Join Waitlist"`.
- `app/founding-client/page.tsx`: hero CTA `Apply to become a founding client →` → `Join Waitlist →` (href `/contact`); `MarketingCta` `primaryLabel="Start the conversation"` (`primaryHref="/contact"`) → `"Join Waitlist"`.
- `app/industries/[slug]/page.tsx`: hero CTA `Discuss your operation →` → `Join Waitlist →` (href `/contact`); `MarketingCta` `primaryLabel="Talk to Vyso"` → `"Join Waitlist"`.
- `app/case-studies/turn-n-slice/page.tsx`: `MarketingCta` `primaryLabel="Discuss your invoicing workflow"` → `"Join Waitlist"`.

All other CTA labels/hrefs to `/founding-client`, `/pricing`, `/platform*`, `/faq`, anchors, and "Explore/Read/View" navigation were left exactly as-is.

### app/login/page.tsx
- Added after `CODE_LENGTH` (new lines 22–24):
  ```ts
  // Self-serve signup is hidden from the public login pane while marketing CTAs point
  // at the waitlist. Signup/verify pane logic stays intact — set true to restore it.
  const SIGNUP_ENABLED = false;
  ```
  (Plan specified the comment `// set true to restore self-serve signup`; wording was expanded slightly for clarity but intent/semantics match exactly — flag defaults to `false`.)
- Wrapped the "New to Vyso? … Create an account" block (was L378–387) in `{SIGNUP_ENABLED ? (...) : null}`. Nothing else in the file changed — signup pane, verify pane, headings, and all `supabase.auth.signUp`/`verifyOtp`/`resend` logic are untouched and simply unreachable via the login pane's UI now (the `pane` state machine and `goTo('signup')` calls elsewhere are unaffected code, just no longer triggered from this hidden link).

### components/HeroSection.tsx
- Verify-only, no edits made. Confirmed "See how it works" is an anchor (`href="#how-it-works"`) and `<HeroAuthCta />` is rendered unchanged.

## Deviations from plan
- None material. The `SIGNUP_ENABLED` comment text was paraphrased (see above) but keeps the same meaning and default value the plan specified.
- Line numbers in the plan drifted slightly from the actual file content by the time of implementation (e.g. Navbar's "Contact us" desktop pill was at L500, not L489–502 range's exact stated line, and login's create-account block was found at L378–387 as stated but is now L382+ after inserting the flag) — edits were verified by content match rather than exact line number, per the plan's own "Edge cases" note to verify with a quick read before each edit.

## Verification

- `npx tsc --noEmit` from `Vyso Website/` — **0 errors**, no output at all (clean run). No pre-existing errors were surfaced in owned or unowned files at the time of this run.
- Plan's verification grep:
  ```
  grep -rn "Talk to us\|Talk to Vyso\|Get in touch\|Send an enquiry\|Contact us" components app --include='*.tsx' | grep -v "app/about\|app/apps\|app/services\|app/api\|faq\|Pricing\|ContactForm"
  ```
  Result: 3 hits, all in `app/contact/page.tsx` metadata/OpenGraph/Twitter `description` strings (lines 11, 18, 29) containing "Send an enquiry" as descriptive copy, not a visible CTA. Per the plan, contact page metadata/canonical/JSON-LD was explicitly left alone, so these are expected and not visible-CTA regressions.
- Additional spot-check grep for the other page-level phrases replaced (`Discuss your workflow`, `Apply to become a founding client`, `Book an audit conversation`, `Start the conversation`, `Discuss your operation`, `Discuss your invoicing workflow`) across `components` and `app` — 0 hits, confirming the full sweep.
- No `git add`/`git commit` run, per instructions.

## Files touched
- `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website/components/Navbar.tsx`
- `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website/components/sections/ContactSection.tsx`
- `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website/app/contact/page.tsx`
- `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website/components/marketing/PublicMarketing.tsx`
- `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website/app/platform/page.tsx`
- `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website/app/platform/finch/page.tsx`
- `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website/app/platform/vyso-for-smes/page.tsx`
- `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website/app/south-africa/page.tsx`
- `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website/app/founding-client/page.tsx`
- `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website/app/industries/[slug]/page.tsx`
- `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website/app/case-studies/turn-n-slice/page.tsx`
- `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website/app/login/page.tsx`
- `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website/components/HeroSection.tsx` (read-only verification, no changes)

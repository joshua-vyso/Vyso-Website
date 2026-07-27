# Implementation: Pricing tier update + scope guard + FAQ refresh

Executed exactly per `.ai/plan_pricing-scope-faq.md`. Only the four owned files were touched. No other files (Navbar, contact page/section, PublicMarketing, login, ModulesOverlay, sitemap/robots, desktop/, dead routes, app/api/**, and `app/platform/vyso-for-smes/page.tsx`) were edited.

## Files changed

### 1. `components/sections/PricingSection.tsx`
- `TIERS` array (L153–212 after edit):
  - Start: setup R10,000, retainer R8,000/month, CTA "Join Waitlist", features expanded to 7 items (added "Basic workflow documentation" and "Monthly automation health check").
  - Create: setup R30,000, retainer R10,000/month (additional-module note removed), CTA "Join Waitlist", features expanded to 8 items (added Finch, dashboard, user roles, documentation/handover lines).
  - Scale: setup R50,000, retainer R15,000/month, note "+R3,000/month per additional module" kept, CTA "Join Waitlist", features expanded to 10 items (added Finch across modules, cross-module dashboard, advanced permissions, quarterly optimisation session; integrations sub-line extended to "accounting, POS, banking, CRMs, supplier systems").
- `AuditBanner` CTA "Discuss the audit" → "Join Waitlist" (href unchanged, `/contact`).
- Added scope-guard paragraph after the dot indicators, inside the section, centred, `fontSize: "13px"`, `color: "#aaa"` (matches the muted colour used for the discovery-call line elsewhere in the file): "Additional modules, major new workflows, or third-party systems outside the agreed setup are scoped separately — we'll always agree scope before anything new is built."
- L344-area "Starts with a free 15-min discovery call" left untouched as instructed.

### 2. `app/pricing/page.tsx`
- Meta `description` updated to: "View Vyso pricing: a one-week operations audit for R2,000, plus Start, Create and Scale plans from R10,000 setup and R8,000 per month."
- JSON-LD offers updated: Start 10000/8000, Create 30000/10000, Scale 50000/15000; Additional module (3000) and Audit (2000) left unchanged; `priceCurrency: "ZAR"` and structure preserved.

### 3. `components/ContactForm.tsx`
- Tier dropdown options updated: "Start — R10,000 setup + R8,000/month", "Create — R30,000 setup + R10,000/month", "Scale — R50,000 setup + R15,000/month". Audit and "Not sure yet" options unchanged.
- Submit button label "Send Enquiry" → "Join Waitlist"; loading label "Sending..." → "Joining...".
- Success-state reset button "Send in another enquiry" → "Send another enquiry".
- Footnote below submit button (call-booking copy) left unchanged.

### 4. `app/faq/page.tsx`
- Pricing group ("id: pricing"): "How much does Vyso cost?" answer rewritten with new prices (audit R2,000; Start R10,000+R8,000/mo; Create R30,000+R10,000/mo; Scale R50,000+R15,000/mo with additional modules at R3,000/mo each).
- Old "How are additional modules priced?" entry removed; the 10 new entries were inserted as a block immediately after "How much does Vyso cost?" and before the pre-existing "Which plan should we choose?" question, in the exact order and exact copy specified in the plan:
  1. What's included in the Start tier?
  2. What's included in the Create tier?
  3. What's included in the Scale tier?
  4. What counts as an additional module, and how are they priced? (replaces the old additional-modules question — no duplicate left)
  5. Is Finch included?
  6. What does the monthly retainer cover?
  7. What happens after setup?
  8. What if we need more than what's included?
  9. Are third-party integrations included?
  10. Can we start with Start and upgrade later?
- All other existing FAQ questions (all other groups, plus "Which plan should we choose?" in Pricing) left untouched.
- CTA "Contact us →" → "Join Waitlist →" (href unchanged, `/contact`).
- `ALL_QUESTIONS`/`faqSchema` JSON-LD is derived via `FAQ_GROUPS.flatMap(...)`, so it automatically includes the 10 new Q&As — verified by inspection, no code change needed there.

## Deviations from plan
None material. One placement judgment call: the plan's instructions ("replace old question in place" + "insert 10 new entries after 'How much does Vyso cost?'") were reconciled by inserting the full 10-item block directly after "How much does Vyso cost?" and before "Which plan should we choose?", with the replacement question ("What counts as an additional module...") taking its specified position (4th) within that block rather than staying at the old question's original list position. This satisfies both "no duplicate" and "insert after the cost question" without inventing new copy.

Scope-guard paragraph styling (`fontSize: "13px"`, `color: "#aaa"`) was chosen to match the existing muted caption pattern in the file (e.g., the "Starts with a free 15-min discovery call" line uses `#aaa`/`0.68rem`; audit banner footnote also uses `#aaa`), since the plan only specified "e.g. `text-[13px]` muted colour used elsewhere in the file" as a guideline, not an exact value.

## Verification

- `npx tsc --noEmit` — completed with **zero output**, i.e. no errors anywhere in the project (not even pre-existing ones in files outside this task's ownership).
- `grep -rn "R5,000\|R20,000\|R6,000/month\|R8,000/month\|R3,000/month" components/sections/PricingSection.tsx components/ContactForm.tsx app/pricing/page.tsx app/faq/page.tsx`:
  - No stale `R5,000`, `R20,000`, or `R6,000/month` found.
  - `R8,000/month` appears only once, as Start's retainer in the ContactForm dropdown (correct — no longer Scale's).
  - `R3,000/month` appears only once, as Scale's additional-module note in PricingSection (correct — no longer Create's or Start's).
- JSON-LD price literals in `app/pricing/page.tsx` confirmed: Start 10000/8000, Create 30000/10000, Scale 50000/15000, Additional module 3000, Audit 2000 — no stale 5000/20000/30000-as-Scale-setup/3000-as-Start-retainer/6000/8000-as-Scale-retainer values remain.
- Confirmed `app/platform/vyso-for-smes/page.tsx` (not owned, edit-if-needed-only) still reads "Each additional module is R3,000 per month" — unchanged and correct, so per the plan it was left untouched.

No `git add`/`git commit` run.

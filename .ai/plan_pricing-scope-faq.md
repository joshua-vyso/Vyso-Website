# Plan: Pricing tier update + scope guard + FAQ refresh

## Goal
Update Start/Create/Scale pricing and scope everywhere prices appear, add a scope-guard line, refresh the FAQ with new tier/scope questions without duplicating existing entries, and sweep the CTA labels inside the files this plan owns to "Join Waitlist".

## New pricing (authoritative)
- **Start:** R10,000 setup once-off · R8,000/month retainer
- **Create:** R30,000 setup once-off · R10,000/month retainer (NO additional-module note on this tier anymore)
- **Scale:** R50,000 setup once-off · R15,000/month retainer · +R3,000/month per additional module
- Audit stays R2,000 once-off (unchanged).

## Files you OWN (no other agent touches these)
`components/sections/PricingSection.tsx`, `components/ContactForm.tsx`, `app/faq/page.tsx`, `app/pricing/page.tsx`, `app/platform/vyso-for-smes/page.tsx` line 245 area ONLY (single sentence check — coordinate: another agent owns the rest of that file; ONLY edit if the "R3,000" sentence needs changing, which it does NOT since additional-module price is unchanged — so in practice do not touch that file).

## Files you must NOT touch
Everything else — especially `components/Navbar.tsx`, `app/contact/page.tsx`, `components/sections/ContactSection.tsx`, `components/marketing/PublicMarketing.tsx`, `app/login/page.tsx`, `components/platform/ModulesOverlay.tsx`, `app/sitemap.ts`, `app/robots.ts`, `desktop/`, dead routes (`app/about`, `app/apps`, `app/services`), `app/api/**`.

## 1. `components/sections/PricingSection.tsx` (TIERS at L153–205, AuditBanner L53–150)
Update the `TIERS` array:

**Start** — setup "R10,000", retainer "R8,000/month". CTA label → "Join Waitlist" (href stays `/contact`). Keep tagline "We automate what your current tools can already do." Features (order as listed; keep the existing feature/sub-bullet shape):
1. "Workflow automation in your existing stack" — sub: "WhatsApp, Google Sheets, Outlook, etc."
2. "Up to 5 automations included"
3. "Maintenance — breakages fixed proactively"
4. "New automations on a monthly delivery cycle"
5. "30-day support period post-setup"
6. "Basic workflow documentation"
7. "Monthly automation health check"
(Positioning: automating what the client already uses — no Vyso modules or Finch mentioned in this tier.)

**Create** — setup "R30,000", retainer "R10,000/month". REMOVE the "+R3,000/month per additional module" note from this tier. CTA → "Join Waitlist". Keep tagline "We replace those tools with a module that owns your data." Features:
1. "One productised Vyso module of your choice"
2. "Migration of Start automations into the module"
3. "Finch companion app included for that module"
4. "Team onboarding and 60-day support"
5. "One round of post-launch revisions"
6. "Basic dashboard and reporting view"
7. "User roles and access setup"
8. "Workflow documentation and handover"

**Scale** — setup "R50,000", retainer "R15,000/month", note "+R3,000/month per additional module" (keep). CTA → "Join Waitlist". Keep tagline "We connect your modules into a full ops platform." Features:
1. "Everything in Create"
2. "Add modules as your operation grows"
3. "Finch companion app across modules"
4. "Two-way integrations with outside systems" — sub: "accounting, POS, banking, CRMs, supplier systems"
5. "Ongoing support for agreed workflows"
6. "Monthly ops reports"
7. "Priority development"
8. "Cross-module dashboard and reporting"
9. "Advanced permissions and team workflows"
10. "Quarterly optimisation session"

**AuditBanner:** CTA label "Discuss the audit" (L139) → "Join Waitlist" (href stays `/contact`). Prices unchanged.

**Scope guard:** after the tier grid (below the three cards, inside the section, before it closes), add a single centred muted line matching section typography (e.g. `text-[13px]` muted colour used elsewhere in the file):
> "Additional modules, major new workflows, or third-party systems outside the agreed setup are scoped separately — we'll always agree scope before anything new is built."

**L344** "Starts with a free 15-min discovery call" under each CTA — keep (still true).

## 2. `app/pricing/page.tsx`
- L8–9 meta description: update prices → "View Vyso pricing: a one-week operations audit for R2,000, plus Start, Create and Scale plans from R10,000 setup and R8,000 per month."
- JSON-LD offers (L34–95): Start 10000 setup / 8000 monthly; Create 30000 / 10000; Scale 50000 / 15000; Additional module 3000 (unchanged); Audit 2000 (unchanged). Keep `priceCurrency: "ZAR"` and structure.

## 3. `components/ContactForm.tsx`
- Tier dropdown labels (L185–189):
  - "Start — R10,000 setup + R8,000/month"
  - "Create — R30,000 setup + R10,000/month"
  - "Scale — R50,000 setup + R15,000/month"
  - Audit and "Not sure yet" unchanged.
- Submit button L255 "Send Enquiry" → **"Join Waitlist"**. Loading state "Sending..." → "Joining...". Success-state reset button L98 "Send in another enquiry" → "Send another enquiry".
- L261–262 footnote: keep (call booking still applies).

## 4. `app/faq/page.tsx` (FAQ_GROUPS L51–207)
### Update existing entries
- "How much does Vyso cost?" (L128): rewrite answer with new prices: audit R2,000 once-off; Start R10,000 setup + R8,000/month; Create R30,000 setup + R10,000/month; Scale R50,000 setup + R15,000/month, with additional modules on Scale at R3,000/month each. Keep the same concise tone.
- REPLACE "How are additional modules priced?" (L133) with the merged question below ("What counts as an additional module…") — update in place, do not leave both.
- Leave all other existing questions untouched (they don't overlap with the new set).
- CTA at L432–434 "Contact us →" → "Join Waitlist →" (href stays `/contact`).

### Add new entries to the "Pricing" group (Group 3), in this order, after "How much does Vyso cost?" — exact copy below (adjust only if the file's answer format requires JSX):

1. **"What's included in the Start tier?"** — "Start focuses on automating the tools you already use — WhatsApp, Google Sheets, Outlook and similar. It includes up to five automations, proactive maintenance, new automations on a monthly delivery cycle, basic workflow documentation, a monthly automation health check and a 30-day support period after setup. Start doesn't include Vyso modules or Finch — it's about making your existing stack work harder."
2. **"What's included in the Create tier?"** — "Create moves a key workflow out of scattered tools and into one productised Vyso module of your choice. Your Start automations are migrated into the module, and Finch — our companion app — is included for that module. You also get team onboarding, a 60-day support period, one round of post-launch revisions, a basic dashboard and reporting view, user roles and access setup, and full documentation and handover."
3. **"What's included in the Scale tier?"** — "Scale is the full operating platform. It includes everything in Create, plus the ability to add modules as your operation grows, Finch across all your modules, two-way integrations with outside systems such as accounting, POS, banking, CRMs and supplier systems, cross-module dashboards and reporting, advanced permissions and team workflows, monthly ops reports, priority development and a quarterly optimisation session. Additional modules are R3,000 per month each."
4. **"What counts as an additional module, and how are they priced?"** (replaces the old additional-modules question) — "Each Vyso module covers one operational area — orders, suppliers, shifts, wastage and so on. Create includes one module; Scale lets you add more at R3,000 per month each. A new operational area handled by its own module counts as an additional module."
5. **"Is Finch included?"** — "Finch is the companion app that helps your team interact with their workflows — capture updates, approve actions, receive notifications and use Vyso from a lighter, mobile-friendly interface. It's included in Create for your chosen module, and works across all your modules in Scale. It isn't part of Start, because Start automates your existing tools rather than running on Vyso modules — and Finch is built to work on top of those modules."
6. **"What does the monthly retainer cover?"** — "The retainer keeps your setup running and improving: proactive maintenance and fixes, support for the agreed workflows, new automations on the monthly cycle in Start, and ongoing reporting and optimisation in the higher tiers. It isn't a general development budget — larger additions are scoped separately."
7. **"What happens after setup?"** — "Every tier includes a support period after setup — 30 days on Start, 60 days on Create, and ongoing support on Scale. From there the monthly retainer takes over: we keep things running, fix breakages proactively and keep delivering improvements on the agreed cycle."
8. **"What if we need more than what's included?"** — "Additional modules, major new workflows, or third-party systems outside the agreed setup are scoped separately. We'll always agree the scope with you before anything new is built, so there are no surprise invoices."
9. **"Are third-party integrations included?"** — "Scale includes two-way integrations with outside systems such as accounting, POS, banking, CRMs and supplier systems. In Start and Create your existing tools are part of the automation work, but new third-party integrations outside the agreed setup are scoped separately."
10. **"Can we start with Start and upgrade later?"** — "Yes — that's the intended path for many teams. Start proves the value inside your current tools; when you're ready, Create migrates those automations into a Vyso module so nothing you've invested is lost, and Scale adds modules from there."

The `FAQPage` JSON-LD is built from `ALL_QUESTIONS` (L209/L250–261) so it should pick these up automatically — verify it does.

## Constraints
- Keep tone consistent with existing copy (client-friendly, plain, confident; en-dashes/em-dashes as the file already uses).
- Do not add a new FAQ group unless the file structure makes the Pricing group unwieldy; if you must, name it "Plans and scope" and keep JSON-LD coverage intact.
- Do NOT run `git add`/`git commit`.
- Repo note (AGENTS.md): Next.js 16.2.7 with breaking changes — for these copy/data edits you shouldn't need Next APIs; if you do, read `node_modules/next/dist/docs/` first.

## Verification
- `cd "/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website" && npx tsc --noEmit`
- `grep -rn "R5,000\|R20,000\|R6,000/month\|R8,000/month\|R3,000/month" components/sections/PricingSection.tsx components/ContactForm.tsx app/pricing/page.tsx app/faq/page.tsx` — confirm no stale amounts remain (R8,000/month is now Start's retainer — make sure it no longer appears as Scale's, and R3,000 only as the per-module price).
- Confirm old prices (5000/20000/30000-as-Scale-setup/3000-as-Start-retainer/6000/8000-as-Scale-retainer) are gone from JSON-LD.

## Output
Write outcomes/deviations to `.ai/implementation_pricing-scope-faq.md`.

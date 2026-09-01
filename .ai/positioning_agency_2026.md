# Vyso positioning & messaging system — agency redesign 2026

## Positioning
**Territory:** AI automation for the work that slows your business down.
**One-liner (hero):** Vyso designs, builds and runs AI automations around the way your business already works — connecting your tools, watching routine operations, and moving repetitive work forward while your team approves what matters.

Vyso is an **AI automation agency**: it maps a client's operation, finds the highest-value bottleneck, builds a custom workflow across the client's existing software/inboxes/documents, then runs, monitors and improves it. Finch is demoted to *an example of what a Vyso build looks like* ("the operational brief" demo).

## Voice
Assured, plain-spoken, commercially aware, lightly conversational, South African where useful. Numbers and named tools over abstractions. Banned: "unlock the power of AI", "revolutionise", "cutting-edge", "seamless digital transformation", "AI-powered innovation", "future of work". No invented metrics, customers, or integration claims.

## Message hierarchy (homepage)
1. H1: **AI automation for the work that slows your business down.**
2. Sub: We design, build and run custom AI workflows around the tools you already use — reading documents, checking numbers, chasing follow-ups, and briefing you every morning. Your team stays in charge of every decision that matters.
3. CTA: **Join the waitlist** → `/join` (the only conversion goal site-wide).
4. Problem: disconnected systems, repetitive admin, things noticed too late.
5. Capability groups (the five verbs): **Read & organise · Check & reconcile · Monitor & alert · Follow up & coordinate · Brief & report** — each: problem → what Vyso automates → what stays human → practical result → realistic example.
6. Proof: the operational brief demo (illustrative demo data, labelled) — invoice arrives → extraction → price comparison → discrepancy → brief entry → human approves.
7. Process: Map the operation → Find the highest-value bottleneck → Build the workflow → Test with the team → Run, monitor, improve.
8. Integrations as workflows, not logo walls. Status-honest: Xero + WhatsApp are live today; Gmail limited; Outlook/Microsoft Graph powers live email ingestion; everything else "systems we commonly connect, depending on your workflow".
9. Industries: food & hospitality, construction, insurance.
10. Testimonials: 6 placeholders, labelled **Illustrative client voice** (not verified endorsements).
11. Compact FAQ (visible; FAQPage JSON-LD).
12. Final waitlist CTA + clean footer.

## Sitemap (lean)
`/` · `/automations` · `/industries` · `/industries/food-hospitality` · `/industries/construction` · `/industries/insurance` · `/integrations` · `/about` · `/join` · `/privacy` · `/terms` · `/popia` · `/login` (product login, noindex, kept). No `/insights` (no sustainable content system yet — noted in handoff).

## Redirect map (all permanent, added to next.config.ts; nothing 404s)
| From | To |
|---|---|
| /pricing, /operations-audit, /operations-audit/score, /operations-audit/calculator, /founding-client, /academy | /join |
| /contact, /south-africa | /about |
| /faq, /learn, /learn/:slug*, /resources, /resources/:slug*, /compare, /compare/:slug*, /platform/modules, /platform/modules/:slug* | /automations |
| /solutions, /solutions/:slug* | /industries |
| /case-studies, /case-studies/turn-n-slice | /industries/food-hospitality |
| /orbit/waitlist | /join |
| /orbit, /orbit/:path* | / |
| Existing redirect targets updated: /services→/join, /roi-calculator→/join, /pricing-faq→/join, /apps→/ (fixes double-redirect), /compare/vyso-vs-* → /automations |

Turn 'n Slice: page + all marketing links removed; redirect above; no current-case-study claims anywhere. (Platform-side TnS references in `lib/platform/**` untouched — real org data, out of scope.)

## Notes
- §17 authenticated capture: password login is a prohibited action for this agent even with supplied demo credentials; the public brief demo is instead rebuilt from the platform's own source (`app/app/page.tsx`, `components/platform/brief/FindingCard.tsx`) and the existing marketing brief components — structurally faithful, no auth needed, labelled "Illustrative demo data".
- Waitlist backend: `/api/waitlist` on the existing Resend + rate-limit pattern (`app/api/contact/route.ts` idiom). No DB table (house rule: Josh pastes all SQL) — duplicate submissions are idempotent-friendly; a durable store is listed as a launch dependency if wanted.

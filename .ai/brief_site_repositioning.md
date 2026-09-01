# Owner brief: overhaul vyso.co.za (verbatim, 2026-08-27)

You are overhauling the marketing site for Vyso (vyso.co.za). This is a repositioning, not a redesign for its own sake.

## 1. Context you need
Vyso is a Johannesburg company. Until now the site sold a product called Finch ("your company's own COO at a tenth of the cost, R6,000 per location"). That framing is dead. Three months of outreach produced mostly cost-based rejections because the site read as an ERP with AI at a fixed price.
Vyso is now an AI automation agency for South African SMEs. It builds operational automation around the way a business already works, on a shared backbone called Vyso Core. Every system built for one client becomes available to the next. The first target segment is hotels and hospitality groups. Small food businesses (caterers, restaurants, food suppliers) remain in scope. Tradespeople get a waitlist page only.
Finch still exists. It is now the name of the catering and wholesale product experience built on Core, and it gets its own subpage. It is no longer the home page or the headline.
Design references the owner has chosen: stripe.com, attio.com, folk.app, kinso. Read as: generous white space, large tight display type, one restrained accent, product UI as the hero image, subtle borders, rounded cards, no gradients, no decorative illustration, sentence case everywhere.

## 2. Hard rules for all copy
- Never use em dashes or en dashes anywhere in copy. Use commas, full stops or colons. Search the codebase for "—" and "–" in any content file and remove them.
- South African English spelling (optimise, organise, colour, centre).
- Currency is always "R" followed by the number with a comma thousands separator: R5,000, R12,000. Never "ZAR".
- Sentence case for headings and buttons.
- Never mention internal module names anywhere customer-facing: OrderFlow, PricePilot, Doc-U, ProcurePulse, SupplySync, Service Den, Vyso Core. If any of these appear on a page, remove or replace them with plain language. "Doc-U" may survive only inside the /finch product demo if it is already part of the UI mock, and even there prefer "document capture".
- The word "COO" must not appear anywhere. Neither must "tenth of the cost", "per location", "R6,000" or "everything included". Grep for all of them at the end.
- Never use the words "agency", "ERP" or "platform" in customer-facing copy. Describe what happens for the customer, not what Vyso is.
- Do not invent client results. Anywhere a number about Turn n Slice is needed, insert the placeholder `[TNS_NUMBER]` and list every placeholder in your final report so the owner can fill them in.
- Do not claim integrations that are not already on the current /integrations page.

## 3. Site map after the overhaul
```
/                         new home page (router)
/industries               index of vertical pages
/industries/hotels        flagship vertical page (new; 301 from /industries/hospitality)
/industries/catering-companies   keep, light rewrite
/industries/restaurants   keep, light rewrite
/industries/food-suppliers keep, light rewrite
/industries/wholesale     keep, light rewrite
/industries/farms         keep, light rewrite
/finch                    the current home page content, moved and edited
/pricing                  rewritten
/how-we-work              new
/operations-audit         keep, align copy and price
/orbit                    keep, convert to an honest waitlist page
/learn, /learn/*          keep
/about, /contact, /faq, /south-africa   keep, scrub banned phrases
/case-studies             keep, scrub banned phrases, placeholders for numbers
/integrations             keep, scrub banned phrases
/login                    do not touch
/privacy, /terms, /popia  do not touch except banned-phrase scrub
```
Delete these routes and add permanent (301) redirects:
```
/academy                          -> /
/compare                          -> /pricing
/resources                        -> /learn
/platform/modules                 -> /finch
/industries/security-companies    -> /industries
/industries/insurance-brokers     -> /industries
/founding-client                  -> /pricing
/industries/hospitality           -> /industries/hotels
```
Add the redirects at the framework level (next.config redirects if this is Next.js, otherwise the equivalent). Update the sitemap and remove deleted routes from it. Keep robots as is.

## 4. Global navigation and footer
Header nav, left to right: Vyso wordmark (link to /), Industries, How we work, Pricing, Finch, then the primary button "Book your audit" linking to /operations-audit. Remove "Learn", "Orbit" and "Log in" from the header. Log in moves to the footer.
Footer, four columns:
- Vyso: Home, How we work, Pricing, About, Contact
- Industries: Hotels, Catering, Restaurants, Food suppliers, Wholesale, Farms
- Products: Finch, Orbit (waitlist)
- More: Learn, Case studies, FAQ, Integrations, Log in, Privacy, Terms, POPIA
Footer line: "Vyso. Built in Johannesburg." plus the contact email that is already there.

## 5. Home page (/)
The home page is a router. Its only job is to get a visitor to the right vertical page or to the audit in one scroll. It does not try to sell any single industry.
### Hero
Headline (exact): **Your business is running on WhatsApp and spreadsheets. That ends here.**
Sub-line (exact): We build the operational automation your business is missing, around the way you already work. Orders, supplier invoices, stock, quotes, debtors, whatever runs your day, automated without replacing the tools your team already uses.
Primary button: Book your audit (R2,000) -> /operations-audit
Secondary link: See how we work -> /how-we-work
Hero visual: one product screenshot or UI mock, right of the text on desktop and below it on mobile. Reuse the existing morning brief mock from the current home page, but relabel anything that says "Finch" as "Vyso" on this page only, and remove the bird. Keep it static, no autoplay carousel.
### Router section
Eyebrow: Who we work with
Heading: Which one looks like yours?
Five tiles in a grid. Hotels is visually primary (larger, or first with accent border). Each tile has a heading, one line in that business's own vocabulary, and links to its page.
1. Hotels and hospitality groups -> /industries/hotels
   Line: Supplier invoices, GRVs, stock and F&B cost across every outlet, watched daily.
2. Catering companies -> /industries/catering-companies
   Line: Quoted food cost against what the event actually cost, every time.
3. Restaurants -> /industries/restaurants
   Line: Supplier prices creeping while the menu stands still. Caught the week it happens.
4. Food suppliers and wholesalers -> /industries/food-suppliers
   Line: Orders in, invoices out, deliveries reconciled, debtors chased.
5. Tradespeople -> /orbit
   Line: Jobs, quotes and invoices from WhatsApp. Join the waitlist.
Below the grid, one line: Something else? If your business runs on people, paper and WhatsApp, we can probably help. Link "Talk to us" -> /contact.
### How we work (short version)
Eyebrow: How we work
Four steps in a row, numbered because they are a real sequence:
1. Audit week. R2,000. We sit inside your operation for a week and find where money and time leak.
2. Map. We write down how your team actually does the work, not how a system thinks they should.
3. Build. We build around that, on tools you already use. Fixed price, agreed before we start.
4. Run. We keep it running, watch it daily, and fix what breaks. One monthly fee.
Link: The full story -> /how-we-work
### Proof
Eyebrow: Built for a produce wholesaler
Reuse the existing invoice-to-decision demo (the FreshCo invoice, extraction, price memory, finding, brief). Frame it with one line: This is the invoice capture and price watch system we built for a Johannesburg produce wholesaler. It reads every supplier invoice overnight and flags the ones worth a phone call.
Testimonial: keep the Roberto quote but add a numbers line beneath it with placeholders: [TNS_NUMBER] invoices captured a month. [TNS_NUMBER] hours a week back. Owner to confirm.
### Close
Heading: Start with a one-week operations audit.
Line: R2,000, credited against your first build. We tell you where the money is leaking whether you sign or not.
Button: Book your audit

## 6. Hotels page (/industries/hotels)
This is the flagship page and carries the most weight. Write it as if the reader is the F&B manager, procurement manager or group finance manager of a two to twelve property group. Use their vocabulary. Do not mention any PMS or POS by name unless it is already on /integrations.
### Hero
Eyebrow: Hotels and hospitality groups
Headline: F&B cost you can see by outlet, by supplier, by week. Not at month-end.
Sub-line: Vyso captures every supplier invoice and GRV across your properties, watches prices line by line, and tells your team which ones to query before they are paid.
Button: Book your audit
### What leaks, in their words
Heading: Where the money goes in a hotel group
Six short cards, each a finding phrased as something a manager would actually be told:
- Price creep. Same supplier, same item, up 9% across three outlets since April. Nobody was told.
- GRV against invoice. Receiving signed for 18 cases. The invoice bills 20. It was paid.
- Duplicate invoices. Two properties paid the same supplier invoice under different references.
- Off-contract buying. The kitchen at one property buys from a local supplier at 15% above the group rate.
- Stock cover. Cooking oil at 31 days cover in one outlet, out of stock in another, same week.
- Month-end. Two weeks of reconciliation that could be two hours, because every document was captured on the day.
### What we build for hotels
Heading: The systems hotel groups start with
Explain that these are the jobs a group usually automates first, that each is priced as one system (link to /pricing), and that the audit tells them which to start with.
- Supplier invoice capture and price watch, across all properties
- GRV reconciliation against invoice and purchase order
- Group price book and off-contract alerts
- Stock and buying list per outlet
- Debtors watch for conference and events billing
- Month-end pack, assembled from what was captured
### How it reaches the team
Heading: Your team does not open a new system
Explain: findings arrive as a morning brief on WhatsApp or email to the person who owns them. Head chef sees stock. Procurement sees price creep. Finance sees GRV mismatches. The dashboard exists for whoever wants it. Nothing to retrain on.
### Founding offer
Eyebrow: Founding hotel groups
Copy: We are taking on three hotel groups on founding terms: 20% off the build, run fee frozen for twelve months, in exchange for a case study with real numbers. (Owner to confirm this offer before launch. Mark with `[CONFIRM_FOUNDING_OFFER]` in a code comment.)
### Close
Same audit close as home, with one hotel-specific line: The audit week works across properties. We pick the two outlets that will show us the most.

## 7. How we work page (/how-we-work)
Long-form version of the four steps. Each step gets: what happens, how long it takes, what the customer gets at the end, what it costs.
1. Audit. One week. R2,000, credited against the first build. Output: a written roadmap of three to six things leaking money or time, each with a fixed build price and a monthly run price. They can take one, take all, or keep the document and walk away.
2. Map. Part of the build. We document how the team actually does the job today, who owns it, and what arrives and leaves. Output: a one-page process map per system, signed off before we build.
3. Build. Two to ten working days per system, depending on integrations. Fixed price from the roadmap. 50% on signing, 50% on go-live. Output: the system live, the owner trained, the first week watched together.
4. Run. Monthly. Hosting, monitoring, fixes, support, the daily brief, and a set number of hours for small changes. Anything bigger is a roadmap item at a price they have already seen.
Add a section titled "What we do not do": we do not replace your accounting system, we do not migrate you off tools that work, we do not build custom software with no ceiling. If a request is not on the roadmap, it gets a price first.

## 8. Pricing page (/pricing)
Remove all existing tiers. Replace with three sections in this order: the audit, the ladder, what counts as a system.
### The audit
R2,000. One week. Credited against your first build. This is where your prices come from: every item on your roadmap has a fixed build price and a monthly run price before you commit to anything.
### The ladder
Render as a clean table. Mobile: stacked cards, one per row.
| Systems live | Build, once | Run, monthly | Small changes included |
|---|---|---|---|
| 1 | R5,000 | R3,000 | 2 hours a month |
| 2 to 3 | R12,000 | R6,000 | 4 hours a month |
| 4 | R20,000 | R8,000 | 6 hours a month |
| Each system after 4 | + R4,000 | + R2,000 | 6 hours a month |
Under the table, three short paragraphs:
- Build covers mapping, configuration, integration with tools you already use, go-live and training. It is paid 50% on signing and 50% on go-live.
- Run covers hosting, monitoring, fixes, support, the daily brief and the hours shown for small changes. Anything larger than that is a roadmap item, quoted before we start.
- These prices are for systems we already have. If you need something we have not built before, we quote it separately, build it once, and it becomes a standard system for the next business. (This line is important. Keep it.)
### What counts as a system
Heading: A system is a job you would otherwise hire someone to do.
Body: It has something coming in (invoices, orders, delivery notes, a schedule), something going out that a person acts on (a list, an alert, a document, a record), and one person in your business who owns the result. If you can name the input, the output and the person, it is a system.
Two columns.
Counts as a system:
- Supplier invoices captured and prices watched
- Deliveries reconciled against invoices and orders
- Debtors watched and chased
- Stock tracked and a buying list produced
- Orders taken and turned into records
- Quotes and jobs tracked
- Month-end pack assembled
Does not count as a new system:
- Another supplier, outlet, user or property on a system that already runs. That is volume, and it may move you up a row.
- A new report over data a system already holds. That is your included hours.
- An integration feeding a system you already have. Usually a small build item.
- The daily brief, WhatsApp delivery, or asking questions of your data. Always included in run.
Add a small FAQ at the bottom with three questions: What if I only want one thing? (Then you pay for one system.) What if I want something you have not built? (We quote it first.) Can I stop? (Run is month to month after the first three months. Owner to confirm the notice period; mark `[CONFIRM_NOTICE_PERIOD]`.)
Close with the audit button.

## 9. Finch page (/finch)
Move the current home page content here. Then edit:
- Page title: Finch by Vyso. Operations intelligence for catering and wholesale.
- Headline: replace the COO line with: Every supplier invoice read overnight. Every price move caught. One morning brief.
- Remove every instance of R6,000, per location, everything included, COO, tenth of the cost.
- Keep the invoice-to-decision demo, the morning brief mock, the "what Finch watches" agents section, the integrations section and the Roberto quote.
- Rename "Under the hood" to "How it works" and rewrite the four cards in plain language: Reads your documents. Remembers what everything cost. Matches invoiced to delivered to paid. Writes the brief.
- Add one line near the top: Finch is the catering and wholesale experience built by Vyso. Pricing is per system, see /pricing.
- Keep the bird on this page only.

## 10. Orbit page (/orbit)
Convert to an honest waitlist page. Keep it indexed with its own title and description and its own OG image so it does not inherit the site default.
- Title: Orbit by Vyso. Run your trade business from WhatsApp. Waitlist.
- Headline: Jobs, quotes and invoices, from the WhatsApp you already use.
- A clear line near the top: Orbit is not live yet. We are building the waitlist to decide when. No payment, no obligation.
- Three example interactions (job created, quote sent, week's profit) as short chat bubbles.
- Waitlist form: name, trade (select: plumber, electrician, HVAC, builder, landscaper, solar installer, other), team size (select: just me, 2 to 5, 6 to 15, more), WhatsApp number. Store submissions using whatever form handling the site already has; if none exists, wire to a simple API route that writes to the existing database or emails the owner. Do not add a third-party form service without asking.
- No pricing on the page.
- Link back to / in the header.

## 11. Other pages
- /industries: index of six tiles (hotels first and largest), same lines as the home router. Remove the two "experimental" tiles.
- Remaining industry pages: keep structure, scrub banned phrases, replace any per-location pricing with "Priced per system, see pricing", add a link to /pricing.
- /operations-audit: confirm the price is R2,000, credited against the first build (not "first month"). Update every mention.
- /case-studies, /about, /faq, /south-africa, /contact, /integrations: scrub banned phrases and module names only.

## 12. Meta, OG and structured data
Every page gets its own title and description. Site default title suffix: " | Vyso". Regenerate the default OG image with the new hero line and no bird. /finch and /orbit get their own OG images. Update JSON-LD Organization description if present. Check `og:site_name` is "Vyso".
Default description: Vyso builds operational automation around the way your business already works. Supplier invoices, stock, orders and debtors, watched daily. Johannesburg.

## 13. Design direction for new pages
Match the existing design tokens where they already fit the references. Where the current site is denser or darker than Stripe or Attio, loosen it: more white space, larger line height, fewer boxes. One accent colour, used for the primary button and the hotels tile only. Cards have a 1px border and a 12px radius. No gradients, no glassmorphism, no floating shapes. Display type large and tight, body type comfortable. Mobile first, and check every new page at 375px. Do not introduce a new component library. Reuse the existing components and extend them.

## 14. Working method (owner-approved plan lives in .ai/plan_site_repositioning.md)
- One commit per phase with a clear message. Run the build and lint after each phase. Do not proceed to the next phase with a failing build.
- Do not touch /login, the app, auth, or anything under the product itself. This is the marketing site only.
- If anything in this brief conflicts with what you find in the codebase, stop and ask rather than guessing.

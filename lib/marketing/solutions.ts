/* ── /solutions content ──────────────────────────────────────────────────────
   Phase 2c of `.ai/plan_vyso_redesign_2026.md` (§5, §7.4): a full rewrite for
   the eight solution pages the redesign settles on. Nothing here carries over
   from the Finch-era file this replaces — different company, different
   slugs, different demo grammar (`EventTimeline` / `FindingCard`, not
   "agents"), different honesty framing (integrations, not module status
   chips).

   Server-safe by construction, same discipline as the file it replaces and as
   `lib/marketing/findings.ts`: a plain data module, no `"use client"` import,
   nothing beyond string/array/object literals and the two tiny helpers at the
   bottom. `EventTimeline`'s and `FindingCard`'s prop shapes are mirrored
   locally (`SolutionTimelineEvent`, `SolutionFinding`) rather than imported,
   so this file never depends on a component module — the page composes the
   real components and TypeScript's structural typing checks the shapes match.

   Every demo scenario is grounded in `lib/marketing/findings.ts`'s roster
   (`.ai/plan_vyso_redesign_2026.md` §7.4: "every scenario grounded in the
   wholesale/distribution domain knowledge already in findings.ts") — either
   quoting a finding's own observation/impact/evidence near-verbatim, or
   building a new scenario in the same domain and the same magnitude
   discipline (a stated volume basis, a rand figure that survives being
   checked). Every rand figure on every page is OPERATIONAL: what a
   distributor invoices a customer, what a supplier charges, what a delivery
   was short. Vyso's own fees appear nowhere in this file.

   ── Two things outside this file that a change here touches ────────────────
   1. `lib/marketing/llms.ts` reads `SOLUTION_LIST` and each solution's
      `.name` / `.slug` / `.summary`, and `HUB.title` — all three still exist
      with the same names, so Phase 3's llms/sitemap pass has real, current
      data to regenerate from without needing this file touched again.
   2. `components/finch/industries/IndustrySections.tsx` does
      `SOLUTIONS[slug].shortName`, where `slug` is
      `lib/marketing/industries.ts`'s OWN `SolutionSlug` union (it does not
      import this file's type). At the time this phase ran, Phase 2d's
      in-progress rewrite of `industries.ts` had already narrowed that union
      to the same eight slugs `SOLUTION_ORDER` below uses — so nothing in the
      current tree still needs the retired `"operations-dashboard"` key. As a
      defensive margin against ordering (Phase 2d's file was mid-edit,
      uncommitted, while this phase ran), `SOLUTIONS` still carries a
      compatibility alias for it — see the registry comment below. It costs
      nothing and can be deleted once Phase 2d's industries rewrite lands and
      Phase 4's redirect (plan §6) makes the URL itself unreachable.          */

export type SolutionSlug =
  | "whatsapp-order-automation"
  | "invoice-automation"
  | "spreadsheet-automation"
  | "procurement-automation"
  | "inventory-automation"
  | "reporting-automation"
  | "document-processing"
  | "reduce-money-leakage";

export type RelatedLink = { label: string; href: string };

export type SolutionFaq = { question: string; answer: string };

export type SolutionStep = { title: string; copy: string };

/* ── The demo ─────────────────────────────────────────────────────────────
   Mirrors `components/vyso/demo/EventTimeline.tsx`'s `TimelineEvent` and
   `components/vyso/demo/FindingCard.tsx`'s props exactly (structurally —
   see the file header for why this is not an import). Each solution picks
   whichever grammar its workflow actually looks like: a sequence of things
   happening (`timeline`) or a set of things noticed (`findings`). */

export type SolutionTimelineEventKind = "event" | "check" | "alert" | "recommendation";

export type SolutionTimelineEvent = {
  time: string;
  kind: SolutionTimelineEventKind;
  title: string;
  body?: string;
  meta?: string;
};

export type SolutionFindingState = "alert" | "watching" | "resolved";

export type SolutionFinding = {
  source?: string;
  state: SolutionFindingState;
  observation: string;
  impact?: string;
  evidence?: string;
  meta?: string;
  actions?: readonly string[];
};

export type SolutionDemo =
  | {
      kind: "timeline";
      /** Accessible name — `EventTimeline`'s `label`. Always page-specific. */
      label: string;
      frameTitle: string;
      frameMeta?: string;
      chromeVariant?: "window" | "whatsapp";
      chromeSubtitle?: string;
      replay?: boolean;
      script: readonly SolutionTimelineEvent[];
    }
  | {
      kind: "findings";
      items: readonly SolutionFinding[];
    };

/* ── The OG feed ──────────────────────────────────────────────────────────
   Mirrors `lib/og/vyso.tsx`'s `VysoOgEvent` shape, for the same reason as
   the demo types above: `app/solutions/[slug]/opengraph-image.tsx` imports
   `renderVysoOgImage` from that module and passes it this page's own data,
   never a copy of the page's copy. */

export type SolutionOg = {
  eyebrow: string;
  title: string;
  continuation?: string;
  lead?: string;
  frameTitle: string;
  feed: readonly { time: string; text: string; accent?: boolean; label?: string }[];
};

export type Solution = {
  slug: SolutionSlug;
  /** Nav/footer/card name. */
  name: string;
  /** Breadcrumb + related-solutions label — usually the same as `name`. */
  shortName: string;
  /** The hub card's one-liner. Also what `lib/marketing/llms.ts` prints. */
  summary: string;
  /** Metadata title. Plain string — the layout supplies `%s | Vyso`. */
  title: string;
  /** Metadata description, ≤155 characters. */
  description: string;
  eyebrow: string;
  /** Two-tier h1: strong clause. */
  heading: string;
  /** Two-tier h1: light continuation clause, same sentence. */
  continuation: string;
  /** The AEO answer: the page's first 1-2 sentences, directly quotable. */
  problemAnswer: string;
  /** "Vyso's approach" — one short intro sentence, then the steps below. */
  approachIntro: string;
  approachSteps: readonly SolutionStep[];
  demo: SolutionDemo;
  demoCaption?: string;
  outcomes: readonly string[];
  /** The "we design systems around tools like…" honesty paragraph, grounded
      per-page in `lib/marketing/integrations.ts`. */
  integrationsNote: string;
  /** Links to `/case-studies/turn-n-slice` — true wherever the workflow is
      genuinely part of what was built there (plan §7.4). */
  caseStudy: boolean;
  learnArticle: RelatedLink;
  related: readonly SolutionSlug[];
  faqs: readonly SolutionFaq[];
  og: SolutionOg;
};

/* ── The eight solutions ──────────────────────────────────────────────────
   Presentation order matches plan §7.4's list. */

const whatsappOrderAutomation: Solution = {
  slug: "whatsapp-order-automation",
  name: "WhatsApp order automation",
  shortName: "WhatsApp orders",
  summary:
    "Orders arrive on WhatsApp already in South African SMEs. Vyso reads them as they land, captures the line items and checks stock before anyone retypes a thing.",
  title: "WhatsApp order automation for South African SMEs",
  description:
    "Vyso reads orders as they arrive on WhatsApp, captures the line items automatically and checks stock, so nothing gets retyped by hand.",
  eyebrow: "WHAT VYSO AUTOMATES · WHATSAPP ORDERS",
  heading: "The order shouldn't need retyping",
  continuation: "just because it arrived on WhatsApp.",
  problemAnswer:
    "Most South African SMEs already take orders over WhatsApp, then someone retypes each one into an order book, a spreadsheet or an invoice by hand. Vyso reads the order as it arrives, captures the line items automatically and checks it against stock before anyone has to ask.",
  approachIntro:
    "Vyso doesn't ask your customers to use a new app. It reads the WhatsApp number you already order through.",
  approachSteps: [
    {
      title: "The message is read as it arrives",
      copy: "Quantities, products and the requested delivery date are read out of the customer's own words, not a form they have to fill in.",
    },
    {
      title: "It's checked, not just filed",
      copy: "Stock on hand and the order book are checked in the same moment, including whether this looks like an order that has already been placed.",
    },
    {
      title: "A person decides anything that isn't routine",
      copy: "A clean order gets confirmed back to the customer. Anything unusual, a possible duplicate, a shortage, a first-time buyer, waits for someone to look at it first.",
    },
  ],
  demo: {
    kind: "timeline",
    label: "Example: a WhatsApp order that looks like a repeat",
    frameTitle: "Highveld Bistro",
    chromeVariant: "whatsapp",
    chromeSubtitle: "online",
    replay: true,
    script: [
      {
        time: "14:02",
        kind: "event",
        title: "An order arrives on WhatsApp",
        body: "Hi, please can we get 15 crates for Thursday morning?",
        meta: "WHATSAPP",
      },
      {
        time: "14:02",
        kind: "event",
        title: "The order is captured automatically",
        body: "Line items, quantity and the requested delivery date are read off the message.",
        meta: "6 LINE ITEMS",
      },
      {
        time: "14:03",
        kind: "check",
        title: "Checked against the order book",
        body: "The same customer placed a 15-crate order for Thursday thirty eight minutes earlier.",
        meta: "ORDER 5518 VS ORDER 5512",
      },
      {
        time: "14:03",
        kind: "alert",
        title: "Possible duplicate order",
        body: "Same customer, same size, same delivery date, thirty eight minutes apart.",
        meta: "AWAITING CONFIRMATION",
      },
      {
        time: "14:04",
        kind: "recommendation",
        title: "Confirm with the customer before dispatch",
        body: "A reply is drafted asking whether this is a second order or a repeat of the first. Nothing is invoiced until it's confirmed.",
        meta: "1 REPLY DRAFTED, NOT SENT",
      },
    ],
  },
  outcomes: [
    "Orders are captured the moment they arrive, not at the end of the day when someone gets to the spreadsheet.",
    "A likely duplicate or an unusual order is held for a person to check, rather than confirmed and dispatched automatically.",
    "Customers get an acknowledgement straight away, on the number they already messaged.",
    "Nobody spends part of their morning copying WhatsApp messages into an order book.",
  ],
  integrationsNote:
    "WhatsApp Business is one of two systems we connect directly today, alongside Xero. Orders sent to your existing WhatsApp Business number are read and can be confirmed automatically, without your customers installing anything new. Beyond that, we design the rest of the order flow around whatever you already use to invoice and track stock.",
  caseStudy: true,
  learnArticle: {
    label: "15 signs your business has operational chaos",
    href: "/learn/15-signs-your-business-has-operational-chaos",
  },
  related: ["invoice-automation", "inventory-automation", "reduce-money-leakage"],
  faqs: [
    {
      question: "Do our customers need to install anything?",
      answer:
        "No. They keep messaging the WhatsApp number they already order through. Vyso reads the messages that arrive there; nothing changes on the customer's side.",
    },
    {
      question: "What if an order is phrased awkwardly, or has a typo in it?",
      answer:
        "Orders arrive as ordinary conversation, not a strict format, and Vyso is built to read them that way. Anything it isn't confident about is held for a person to check rather than guessed at.",
    },
    {
      question: "Can staff see and correct an order before it's confirmed?",
      answer:
        "Yes. A captured order is a draft until it's confirmed, and anything flagged as unusual, a possible duplicate, a shortage, waits for a person by design.",
    },
    {
      question: "Does this replace our WhatsApp Business number?",
      answer:
        "No, it reads it. The number, the conversation history and the relationship with the customer stay exactly where they are.",
    },
  ],
  og: {
    eyebrow: "WHATSAPP ORDER AUTOMATION",
    title: "The order shouldn't need retyping",
    continuation: "just because it arrived on WhatsApp.",
    lead: "Vyso reads orders as they arrive and checks them before anyone retypes a thing.",
    frameTitle: "Highveld Bistro",
    feed: [
      { time: "14:02", text: "Please can we get 15 crates for Thursday morning?" },
      { time: "14:02", text: "Order captured automatically, 6 line items." },
      {
        time: "14:03",
        text: "Same order placed 38 minutes earlier. Possible duplicate.",
        accent: true,
        label: "NEEDS ATTENTION",
      },
    ],
  },
};

const invoiceAutomation: Solution = {
  slug: "invoice-automation",
  name: "Invoice automation",
  shortName: "Invoice automation",
  summary:
    "The invoice is drafted the moment an order is confirmed, checked against what that customer actually agreed, before it ever reaches them.",
  title: "Invoice automation for South African SMEs",
  description:
    "Vyso drafts customer invoices from confirmed orders and checks the pricing against each customer's own agreed rate before you send it.",
  eyebrow: "WHAT VYSO AUTOMATES · INVOICING",
  heading: "The invoice should be right",
  continuation: "before it reaches the customer, not after.",
  problemAnswer:
    "An invoice built by hand is only as consistent as the person building it, and a price that's quietly moved is easy to miss until a customer queries it. Vyso drafts the invoice the moment an order is confirmed, checked against that customer's own agreed pricing.",
  approachIntro:
    "The invoice comes from the order, not from someone rebuilding it afterwards.",
  approachSteps: [
    {
      title: "The draft is built from the order",
      copy: "Line items, quantities and the customer's own agreed price list populate the draft automatically, the moment the order is confirmed.",
    },
    {
      title: "The pricing is checked against history",
      copy: "Each line is compared against what that customer was actually charged last time and what was agreed, so a stale price list doesn't quietly go out again.",
    },
    {
      title: "A person approves it",
      copy: "The draft waits for sign-off before it's sent. Correcting a line takes a click; sending is always a human decision.",
    },
  ],
  demo: {
    kind: "findings",
    items: [
      {
        source: "VYSO IS WATCHING",
        state: "watching",
        observation:
          "Draft invoice for Karoo Bistro is ready: 18 line items, priced on their March agreement.",
        impact: "R12,640",
        evidence: "ORDER 6104",
        meta: "AWAITING APPROVAL",
        actions: ["Approve", "Open the order"],
      },
      {
        state: "alert",
        observation:
          "This invoice for Fourways Bistro was about to go out on last month's price list. It's been corrected before sending.",
        impact: "R640 corrected before sending",
        evidence: "INVOICE DRAFT · CUSTOMER PRICE LIST",
        meta: "PRICE LIST V4, NOT V3",
        actions: ["Review the correction", "Approve corrected total"],
      },
      {
        source: "VYSO NOTICED",
        state: "resolved",
        observation:
          "Thyme and Basil's invoice matched their agreed pricing on all 11 lines this week.",
        impact: "11 of 11 lines matched",
        evidence: "INVOICE 6098",
        meta: "NO CORRECTION NEEDED",
        actions: ["Open the invoice"],
      },
    ],
  },
  outcomes: [
    "No retyping between the confirmed order and the invoice that follows it.",
    "A stale price or an outdated list is caught before the invoice is sent, not after a customer queries it.",
    "Invoices read the same way regardless of who confirmed the order.",
    "The numbers are checked before anyone opens the accounting system, not after.",
  ],
  integrationsNote:
    "Xero is one of two systems we connect directly today, alongside WhatsApp Business. Invoices, bills, contacts and account balances are read automatically once connected, so a draft can be checked against your own billing history before it's sent. We don't post entries back into Xero yet, raising and sending stays with you or your bookkeeper. Beyond Xero, we design systems around tools like Sage on request.",
  caseStudy: true,
  learnArticle: {
    label: "AI for small and medium businesses: practical use cases",
    href: "/learn/ai-for-small-and-medium-businesses-practical-use-cases",
  },
  related: ["whatsapp-order-automation", "spreadsheet-automation", "reduce-money-leakage"],
  faqs: [
    {
      question: "Does this replace Xero or our bookkeeper?",
      answer:
        "No. Vyso drafts and checks the invoice; raising it in Xero and getting paid stays exactly where it is today. The draft is meant to make that step faster and more accurate, not to remove it.",
    },
    {
      question: "What happens if a price genuinely needs to change?",
      answer:
        "You change it. The point isn't to freeze prices, it's to make sure a change is deliberate rather than an old list quietly being reused.",
    },
    {
      question: "Can different customers have different agreed pricing?",
      answer:
        "Yes, that's the normal case. Each customer's invoice is checked against what was agreed with them specifically, not a single house price list.",
    },
    {
      question: "Who approves the invoice before it's sent?",
      answer:
        "Whoever you decide should. The draft waits for a person's sign-off; nothing is sent automatically.",
    },
  ],
  og: {
    eyebrow: "INVOICE AUTOMATION",
    title: "The invoice should be right",
    continuation: "before it reaches the customer, not after.",
    lead: "Vyso drafts the invoice from the confirmed order and checks it against what was agreed.",
    frameTitle: "Invoice drafts",
    feed: [
      { time: "1", text: "Karoo Bistro draft ready, R12,640 on their March agreement." },
      {
        time: "2",
        text: "Fourways Bistro was about to go out on last month's list. Corrected.",
        accent: true,
        label: "CORRECTED BEFORE SENDING",
      },
      { time: "3", text: "Thyme and Basil, 11 of 11 lines matched. No correction needed." },
    ],
  },
};

const spreadsheetAutomation: Solution = {
  slug: "spreadsheet-automation",
  name: "Spreadsheet automation",
  shortName: "Spreadsheet automation",
  summary:
    "The spreadsheet stays. Vyso reads it, and says something when a number in it has quietly gone stale.",
  title: "Spreadsheet automation for South African SMEs",
  description:
    "Vyso reads the Excel and Google Sheets your team already keeps and flags a stale price list or a broken formula before it's relied on.",
  eyebrow: "WHAT VYSO AUTOMATES · SPREADSHEETS",
  heading: "Keep the spreadsheet.",
  continuation: "Stop trusting it blind.",
  problemAnswer:
    "Excel and Google Sheets are usually still the real system of record in a growing SME, and the risk isn't the spreadsheet, it's that nobody notices when one goes stale or a formula quietly breaks. Vyso reads the spreadsheets your team already keeps and says something when a number in one no longer matches what's actually happening.",
  approachIntro:
    "Vyso doesn't ask you to move your operation into new software before it can help.",
  approachSteps: [
    {
      title: "It reads the sheet you already use",
      copy: "The price list, the stock sheet, the order book, whatever shape it's actually in, not a template you'd have to rebuild it into.",
    },
    {
      title: "It compares the sheet against what else is true",
      copy: "A price list checked against the last few invoices, a stock sheet checked against the order book, so a mismatch is visible rather than assumed away.",
    },
    {
      title: "A change is flagged, not silently corrected",
      copy: "A stale figure or a broken formula is named, with what it should probably be, so a person decides rather than a spreadsheet quietly overwriting itself.",
    },
  ],
  demo: {
    kind: "findings",
    items: [
      {
        state: "alert",
        observation:
          "The price list your team is quoting from is the March version. Two supplier increases have landed on invoices since then.",
        impact: "3 quotes affected this week",
        evidence: "PRICE LIST V3 · MARCH",
        meta: "SHOULD BE V5, AUGUST",
        actions: ["Show the affected quotes", "Update the list"],
      },
      {
        source: "VYSO IS WATCHING",
        state: "watching",
        observation: "The stock sheet and the order book agree on 38 of 40 lines this week.",
        impact: "2 lines to check",
        evidence: "STOCK SHEET · ORDER BOOK",
        meta: "WEEKLY COMPARISON",
        actions: ["Show the two lines"],
      },
      {
        state: "resolved",
        observation:
          "A formula on the weekly stock sheet was overwritten on Tuesday. It's been flagged and the total corrected.",
        impact: "1 formula restored",
        evidence: "STOCK SHEET, ROW 41",
        meta: "CAUGHT TUESDAY, BEFORE FRIDAY'S REPORT",
        actions: ["Show what changed"],
      },
    ],
  },
  outcomes: [
    "A stale price list or a broken formula is flagged before it's relied on, not discovered afterwards.",
    "Fewer figures get copied by hand between one spreadsheet and another.",
    "Teams keep working in Excel or Google Sheets, without a forced move to new software.",
    "One place to check a number instead of five files with different versions of it.",
  ],
  integrationsNote:
    "There's no single 'spreadsheet integration' to switch on, because every business's spreadsheets are shaped differently. We read the ones your team already keeps, whether that's Excel or Google Sheets, and design around their actual structure rather than asking you to move everything into new software first.",
  caseStudy: true,
  learnArticle: {
    label: "How much time can workflow automation save?",
    href: "/learn/how-much-time-can-workflow-automation-save",
  },
  related: ["reporting-automation", "inventory-automation", "reduce-money-leakage"],
  faqs: [
    {
      question: "Will this force us to move away from spreadsheets?",
      answer:
        "No. Most businesses we work with keep at least some of their spreadsheets, because they already work well for what they do. Vyso reads them rather than replacing them by default.",
    },
    {
      question: "Does it work with formulas we've already built?",
      answer:
        "Yes, that's the point, we read the sheet as it actually exists. If a formula breaks, that's exactly the kind of thing worth flagging rather than quietly working around.",
    },
    {
      question: "What if we have several versions of the same spreadsheet floating around?",
      answer:
        "That's a common starting point, not a blocker. The audit looks at which version is actually authoritative and builds the comparison against that one.",
    },
    {
      question: "How does it know a number is wrong?",
      answer:
        "It compares the sheet against other records that should agree with it, an invoice, an order, a previous count, rather than guessing from the number alone.",
    },
  ],
  og: {
    eyebrow: "SPREADSHEET AUTOMATION",
    title: "Keep the spreadsheet.",
    continuation: "Stop trusting it blind.",
    lead: "Vyso reads the sheets your team already keeps and flags what's gone stale.",
    frameTitle: "Price list, v3",
    feed: [
      {
        time: "!",
        text: "Team is quoting from March. Two increases have landed since.",
        accent: true,
        label: "NEEDS ATTENTION",
      },
      { time: "2", text: "Stock sheet and order book agree on 38 of 40 lines." },
      { time: "3", text: "A formula overwritten Tuesday. Flagged and corrected." },
    ],
  },
};

const procurementAutomation: Solution = {
  slug: "procurement-automation",
  name: "Procurement automation",
  shortName: "Procurement automation",
  summary:
    "Every supplier invoice checked against the price you actually agreed, so a creep is caught on the second invoice, not at year end.",
  title: "Procurement automation for South African SMEs",
  description:
    "Vyso reads supplier invoices, checks each price against what you agreed, and flags the gap the week it happens, for South African distributors.",
  eyebrow: "WHAT VYSO AUTOMATES · PROCUREMENT",
  heading: "Purchasing shouldn't run",
  continuation: "on memory and a WhatsApp thread.",
  problemAnswer:
    "When approvals happen after the order is already placed and negotiated supplier prices live in someone's memory, buying decisions get made blind. Vyso reads every supplier invoice, checks the price against what you actually agreed, and flags the gap the week it happens, not at year end.",
  approachIntro:
    "The paperwork purchasing already produces is the record Vyso reads.",
  approachSteps: [
    {
      title: "The invoice arrives however it arrives",
      copy: "An emailed PDF, a photograph in a WhatsApp thread, a printed delivery note. All three become the same kind of record.",
    },
    {
      title: "Every line is checked against history",
      copy: "Each price is compared to what that supplier charged before, and to the rate you actually agreed with them, not what the invoice happens to say.",
    },
    {
      title: "The gap is flagged with its evidence",
      copy: "The item, the movement and the rand impact at your volumes, with the invoices it was read from attached, not a number without a source.",
    },
  ],
  demo: {
    kind: "timeline",
    label: "Example: a supplier price checked against six months of invoices",
    frameTitle: "Supplier invoices",
    chromeVariant: "window",
    replay: true,
    script: [
      {
        time: "MON",
        kind: "event",
        title: "FreshCo's invoice arrives",
        body: "Emailed as a PDF, the way it arrives every week.",
        meta: "INVOICE 8834",
      },
      {
        time: "MON",
        kind: "check",
        title: "Every line checked against the last six months",
        body: "Butternut, tomatoes and onions compared line by line against prior invoices from the same supplier.",
        meta: "3 INVOICES, JUN-AUG",
      },
      {
        time: "MON",
        kind: "alert",
        title: "Butternut up 12% at FreshCo since June",
        body: "At roughly 650 bags a month, the increase is worth about R58,000 a year if it holds.",
        meta: "FRESHCO · +12% · ≈650 BAGS/MO",
      },
      {
        time: "MON",
        kind: "recommendation",
        title: "Draft a supplier email, or compare an alternative quote",
        body: "The six-month trend is attached. Sending the email, renegotiating, or accepting the increase stays a decision for a person.",
        meta: "1 EMAIL DRAFTED, NOT SENT",
      },
    ],
  },
  outcomes: [
    "A price creep is caught on the second invoice it appears on, not at year-end reconciliation.",
    "Purchase requests are visible before the money is committed, not after.",
    "One record of what was requested, approved and delivered, instead of a phone call nobody wrote down.",
    "A legitimate increase is decided on deliberately, absorb it, pass it on, renegotiate, rather than discovered by accident.",
  ],
  integrationsNote:
    "We read supplier invoices however they already arrive, an emailed PDF, a photograph forwarded on WhatsApp, or a printed delivery note, and check them against Xero, one of two systems we connect directly today. Sage and other ledgers are on the roadmap, scoped during your audit.",
  caseStudy: true,
  learnArticle: {
    label: "The hidden cost of manual procurement",
    href: "/learn/hidden-cost-of-manual-procurement",
  },
  related: ["reduce-money-leakage", "document-processing", "inventory-automation"],
  faqs: [
    {
      question: "Does this take control away from our buyers?",
      answer:
        "No. Vyso reads and checks; it doesn't buy. Approval rules and spend limits stay yours, and an agent drafts the supplier email, a person sends it.",
    },
    {
      question: "Do our suppliers need to change how they send invoices?",
      answer:
        "No. Vyso reads the formats suppliers already use, emailed PDFs, printed delivery notes, or a photograph taken in a WhatsApp group.",
    },
    {
      question: "What if a price increase is legitimate?",
      answer:
        "Most are. The point isn't to fight every increase, it's to know about it the week it happens rather than at year end, and to decide deliberately what to do about it.",
    },
    {
      question: "How does this start?",
      answer:
        "With the free operations audit: about an hour with you, no obligation. We walk through what a price and delivery check would have caught in your own invoices, whether you go ahead or not.",
    },
  ],
  og: {
    eyebrow: "PROCUREMENT AUTOMATION",
    title: "Purchasing shouldn't run",
    continuation: "on memory and a WhatsApp thread.",
    lead: "Every supplier invoice checked against the price you actually agreed.",
    frameTitle: "Supplier invoices",
    feed: [
      { time: "MON", text: "FreshCo's invoice arrives, emailed as a PDF." },
      {
        time: "MON",
        text: "Butternut up 12% since June. About R58,000 a year at current volumes.",
        accent: true,
        label: "VYSO RECOMMENDS",
      },
      { time: "MON", text: "Supplier email drafted, not sent. A person decides." },
    ],
  },
};

const inventoryAutomation: Solution = {
  slug: "inventory-automation",
  name: "Inventory automation",
  shortName: "Inventory automation",
  summary:
    "Stock on hand checked against what's already committed and what's already on its way, so a shortage or an overstock surfaces days early.",
  title: "Inventory automation for South African SMEs",
  description:
    "Vyso checks stock on hand against committed orders and incoming deliveries continuously, so a shortage or overstock surfaces days before it bites.",
  eyebrow: "WHAT VYSO AUTOMATES · STOCK",
  heading: "A shortage found on Tuesday,",
  continuation: "not on the loading bay on Thursday.",
  problemAnswer:
    "Stock counts kept in a spreadsheet or a person's memory usually surface a shortage at the worst possible moment: the morning of the delivery. Vyso checks stock on hand against orders already committed and deliveries already on their way, continuously, so a gap is visible days before it becomes a problem.",
  approachIntro:
    "Stock is checked as a by-product of the work, not as a separate count someone has to remember to do.",
  approachSteps: [
    {
      title: "Stock, orders and deliveries are held against each other",
      copy: "What's on hand, what's already promised to a customer and what's already on its way from a supplier, compared continuously rather than at a monthly count.",
    },
    {
      title: "A gap in either direction is named",
      copy: "Not only shortages. Cash tied up in overstock, ahead of a slow week or a public holiday, is worth flagging just as much as a shortfall.",
    },
    {
      title: "There's time to act before it bites",
      copy: "A shortage found days ahead is a phone call to a supplier. A shortage found on the loading bay is a delivery that doesn't go out.",
    },
  ],
  demo: {
    kind: "findings",
    items: [
      {
        state: "alert",
        observation:
          "Frozen stock is written off at 3.1% of intake, twice the rate of your dry store.",
        impact: "≈R64,000/yr written off",
        evidence: "6 months of waste sheets",
        meta: "FROZEN · 3.1% OF INTAKE",
        actions: ["Show the write-off lines", "Draft a par-level change"],
      },
      {
        source: "VYSO IS WATCHING",
        state: "watching",
        observation:
          "You are holding 31 days of cover into a week with two public holidays.",
        impact: "≈R38,000 tied up",
        evidence: "stock sheet + 5 open orders",
        meta: "31 DAYS COVER · TARGET 14",
        actions: ["Show what to defer", "Draft a supplier note"],
      },
      {
        state: "resolved",
        observation: "Cooking oil cover is 22 days and another pallet lands Thursday.",
        impact: "≈R9,800 sitting in overstock",
        evidence: "stock sheet + 3 open orders",
        meta: "22 DAYS COVER · TARGET 14",
        actions: ["Pause Thursday's order"],
      },
    ],
  },
  outcomes: [
    "A shortage is visible days before the delivery it would have affected.",
    "Overstock ahead of a quiet week or a public holiday is flagged while there's still time to pause an order.",
    "Wastage is compared across categories instead of guessed at once a quarter.",
    "One stock number, checked continuously, instead of a count that only happens monthly.",
  ],
  integrationsNote:
    "There's no live stock or point-of-sale connection running yet, tools like Loyverse and Yoco are on our roadmap, scoped during your audit if that's what you run. Until then, we design the stock view around the sheets and counts your team already keeps.",
  caseStudy: true,
  learnArticle: {
    label: "The real cost of poor stock control",
    href: "/learn/the-real-cost-of-poor-stock-control",
  },
  related: ["whatsapp-order-automation", "procurement-automation", "reduce-money-leakage"],
  faqs: [
    {
      question: "Do we need a new stock system before this can work?",
      answer:
        "Not necessarily. The audit looks at what you currently use to track stock and how reliable it is, and scopes the roadmap around what can realistically be checked first.",
    },
    {
      question: "How often is stock actually checked?",
      answer:
        "Continuously, as orders, deliveries and counts update, rather than at a scheduled interval. A gap doesn't wait for the next stocktake to be visible.",
    },
    {
      question: "Can this flag overstock as well as shortages?",
      answer:
        "Yes. Cash tied up in stock you don't need yet is treated the same way as a gap you do, both are worth a person's attention.",
    },
    {
      question: "What about wastage that's hard to track today?",
      answer:
        "The audit is where that gets tested: what's recorded now, how reliably, and whether it's enough to build a comparison on before anything is switched on.",
    },
  ],
  og: {
    eyebrow: "INVENTORY AUTOMATION",
    title: "A shortage found on Tuesday,",
    continuation: "not on the loading bay on Thursday.",
    lead: "Stock checked against what's committed and what's already on its way.",
    frameTitle: "Stock cover",
    feed: [
      {
        time: "1",
        text: "Frozen stock written off at 3.1% of intake, twice the dry store rate.",
        accent: true,
        label: "NEEDS ATTENTION",
      },
      { time: "2", text: "31 days of cover into a week with two public holidays." },
      { time: "3", text: "Cooking oil cover 22 days, another pallet lands Thursday." },
    ],
  },
};

const reportingAutomation: Solution = {
  slug: "reporting-automation",
  name: "Reporting automation",
  shortName: "Reporting automation",
  summary:
    "The report builds itself from work that already happened, so it arrives current instead of a few days old.",
  title: "Reporting automation for South African SMEs",
  description:
    "Vyso assembles the weekly operations report from work that already happened, so it arrives current and nothing depends on one spreadsheet.",
  eyebrow: "WHAT VYSO AUTOMATES · REPORTING",
  heading: "Stop rebuilding the same report",
  continuation: "by hand, every single week.",
  problemAnswer:
    "A hand-built weekly report is usually a few days old by the time anyone reads it, and if the person who builds it is away, the report often just doesn't happen. Vyso assembles the report from work that already happened across the operation, so what needs attention arrives without anyone reconstructing it from five spreadsheets.",
  approachIntro:
    "The report is a by-product of the work, not a separate job someone does on top of it.",
  approachSteps: [
    {
      title: "Data lands as the work happens",
      copy: "Orders, deliveries, invoices and stock movements update the record continuously, not once a week in a batch someone assembles.",
    },
    {
      title: "The report ranks what matters",
      copy: "What moved, what's unusual, and what needs a decision, rather than every number the business produced.",
    },
    {
      title: "It arrives where you already look",
      copy: "By WhatsApp or email on Monday morning, with the evidence behind each figure one tap away if you want to check it.",
    },
  ],
  demo: {
    kind: "timeline",
    label: "Example: the weekly report assembling itself through the week",
    frameTitle: "Weekly report",
    chromeVariant: "window",
    replay: true,
    script: [
      {
        time: "MON-FRI",
        kind: "event",
        title: "Orders, deliveries and invoices update the record",
        body: "As the week's work happens, not gathered afterwards from five separate places.",
        meta: "CONTINUOUS",
      },
      {
        time: "SUN 23:00",
        kind: "check",
        title: "The week is compared against the one before it",
        body: "Margin, stock cover and supplier spend checked against the last four weeks, not just the raw totals.",
        meta: "4-WEEK COMPARISON",
      },
      {
        time: "MON 07:00",
        kind: "alert",
        title: "Gross margin has slipped from 31.4% to 29.3% over four months",
        body: "About R18,600 a month at current revenue, mostly on two product lines.",
        meta: "-2.1 POINTS · APR-AUG",
      },
      {
        time: "MON 07:00",
        kind: "recommendation",
        title: "Delivered, with the drivers attached",
        body: "The report is sent, with the two lines behind the slip one tap away, rather than waiting for someone to ask why.",
        meta: "SENT ON WHATSAPP",
      },
    ],
  },
  outcomes: [
    "The report is a few hours old on Monday morning, not a week old by the time it's built.",
    "Nothing depends on one person's spreadsheet being available that week.",
    "A margin or stock issue is visible the week it happens, not the month it's reviewed.",
    "A follow-up question can be answered from the underlying record, instead of someone going to dig for it.",
  ],
  integrationsNote:
    "The report draws from records that already exist. Xero is one of two systems we connect directly today for the financial side; the rest is designed around whatever you already use for orders, stock and sales, so the report is built from what's already there rather than a new form someone has to fill in.",
  caseStudy: true,
  learnArticle: {
    label: "Why weekly reports are usually too late",
    href: "/learn/why-weekly-reports-are-usually-too-late",
  },
  related: ["reduce-money-leakage", "spreadsheet-automation", "inventory-automation"],
  faqs: [
    {
      question: "Will this replace the spreadsheets we report from today?",
      answer:
        "Some of them. Others stay as working tools while Vyso handles the summary layer on top. The audit confirms the sensible boundary rather than forcing everything into one system on day one.",
    },
    {
      question: "Can we ask a question the report doesn't answer?",
      answer:
        "Yes, that's the point of building it on an underlying record rather than a static document. Asking about a specific number reads the same data the report was built from.",
    },
    {
      question: "Do we need clean data first?",
      answer:
        "Not perfectly clean. The audit looks at what data exists and how reliable it is, and scopes the report around what can realistically be reported on first.",
    },
    {
      question: "Why would this arrive on WhatsApp instead of a dashboard?",
      answer:
        "Because a dashboard is something you have to remember to open, and most operators read WhatsApp before anything else. Email works just as well if that's where you'd rather it landed.",
    },
  ],
  og: {
    eyebrow: "REPORTING AUTOMATION",
    title: "Stop rebuilding the same report",
    continuation: "by hand, every single week.",
    lead: "The report assembles itself from work that already happened.",
    frameTitle: "Weekly report",
    feed: [
      { time: "MON-FRI", text: "Orders, deliveries and invoices update the record." },
      {
        time: "MON 07:00",
        text: "Margin slipped from 31.4% to 29.3% over four months.",
        accent: true,
        label: "NEEDS ATTENTION",
      },
      { time: "MON 07:00", text: "Delivered on WhatsApp, with the drivers attached." },
    ],
  },
};

const documentProcessing: Solution = {
  slug: "document-processing",
  name: "Document processing",
  shortName: "Document processing",
  summary:
    "Invoices, delivery notes and statements read however they arrive, so two documents that disagree get caught automatically.",
  title: "Document processing for South African SMEs",
  description:
    "Vyso reads invoices, delivery notes and statements as PDFs, photographs or printed pages, and compares them so a mismatch is caught automatically.",
  eyebrow: "WHAT VYSO AUTOMATES · DOCUMENTS",
  heading: "The document reads itself,",
  continuation: "however it actually arrives.",
  problemAnswer:
    "Invoices, delivery notes and statements arrive as emailed PDFs, photographs and printed pages, and somebody has to open each one and retype the numbers before anything can be checked against anything else. Vyso reads documents in whatever form they arrive and turns them into a record that can be compared automatically.",
  approachIntro:
    "The document doesn't need to change shape before Vyso can read it.",
  approachSteps: [
    {
      title: "It reads the format that already exists",
      copy: "An emailed PDF, a photograph forwarded on WhatsApp, a printed delivery note handed to a driver, all become the same kind of comparable record.",
    },
    {
      title: "It's held up against the document it should agree with",
      copy: "An invoice against its delivery note, a statement against the invoices it's meant to cover, rather than filed and trusted on its own.",
    },
    {
      title: "A mismatch is flagged with both documents attached",
      copy: "So the person checking it can see exactly what disagreed, rather than being asked to take the flag on faith.",
    },
  ],
  demo: {
    kind: "findings",
    items: [
      {
        state: "alert",
        observation: "Thursday deliveries bill 40 crates and sign for 36, four weeks running.",
        impact: "≈R58,000/yr at this rate",
        evidence: "4 delivery notes",
        meta: "WEEKLY · 4 CRATES SHORT",
        actions: ["Draft credit request", "Show the four weeks"],
      },
      {
        source: "VYSO IS WATCHING",
        state: "watching",
        observation:
          "One supplier's invoice bills 20 units of sunflower oil; the delivery note shows 18.",
        impact: "R756 over-billed",
        evidence: "invoice + delivery note",
        meta: "2 SHORT, SMALL BUT REAL",
        actions: ["Draft credit request", "Open both documents"],
      },
      {
        state: "alert",
        observation:
          "The delivery fee appears twice on every Monday invoice from this supplier.",
        impact: "≈R14,000/yr double-billed",
        evidence: "6 invoices",
        meta: "MONDAYS · SAME FEE TWICE",
        actions: ["Draft credit request", "Show the six invoices"],
      },
    ],
  },
  outcomes: [
    "An invoice and its delivery note are compared automatically, not by someone holding two pieces of paper side by side.",
    "A short delivery or a duplicate charge is flagged with the document attached, not discovered weeks later.",
    "Nobody retypes figures from a photograph into a spreadsheet.",
    "Documents are kept as a searchable record rather than a pile of PDFs in an inbox.",
  ],
  integrationsNote:
    "WhatsApp Business is one of two systems we connect directly today: photographed invoices and delivery notes forwarded to your existing number are read automatically. Emailed PDFs and printed documents are designed around case by case, and Xero, our other live connection, gives us the ledger to check them against.",
  caseStudy: true,
  learnArticle: {
    label: "Supplier scorecards: what to track and why",
    href: "/learn/supplier-scorecards-what-to-track-and-why",
  },
  related: ["procurement-automation", "invoice-automation", "reduce-money-leakage"],
  faqs: [
    {
      question: "What document formats can this actually read?",
      answer:
        "Emailed PDFs, printed pages and photographs, including ones forwarded through a WhatsApp thread. The document doesn't need to be reformatted first.",
    },
    {
      question: "Do our suppliers need to change how they send documents?",
      answer:
        "No. Vyso reads what already arrives. If a supplier's format changes, that's the kind of thing the audit accounts for, not something they need to adjust for us.",
    },
    {
      question: "What happens if a document is unclear or low quality?",
      answer:
        "It's flagged as unreadable rather than guessed at. A blurry photograph produces a request to resend it, not a silently wrong figure.",
    },
    {
      question: "Does this replace filing or bookkeeping?",
      answer:
        "No. It reads and compares documents so mismatches surface; where the document ultimately lives, and the bookkeeping built on top of it, stays with your existing system.",
    },
  ],
  og: {
    eyebrow: "DOCUMENT PROCESSING",
    title: "The document reads itself,",
    continuation: "however it actually arrives.",
    lead: "PDFs, photographs and printed pages, compared automatically.",
    frameTitle: "Documents this week",
    feed: [
      {
        time: "1",
        text: "Thursday deliveries bill 40 crates, sign for 36, four weeks running.",
        accent: true,
        label: "NEEDS ATTENTION",
      },
      { time: "2", text: "One invoice bills 20 units; delivery note shows 18. R756 over." },
      {
        time: "3",
        text: "A delivery fee appears twice on every Monday invoice.",
        accent: true,
        label: "NEEDS ATTENTION",
      },
    ],
  },
};

const reduceMoneyLeakage: Solution = {
  slug: "reduce-money-leakage",
  name: "Reduce money leakage",
  shortName: "Reduce money leakage",
  summary:
    "The money isn't missing, it leaves in small, repeated amounts nobody is positioned to see. Vyso watches all of them at once.",
  title: "Reduce money leakage in your business",
  description:
    "Vyso watches invoices, stock, pricing and margin together, so money leaking out of a South African operation surfaces in days, not at month end.",
  eyebrow: "WHAT VYSO AUTOMATES · MONEY LEAKAGE",
  heading: "The money isn't missing.",
  continuation: "Nobody is watching it leave.",
  problemAnswer:
    "Money rarely leaves a growing business in one dramatic event. It leaves in small, repeated amounts, a short delivery, a price that crept up, a margin that quietly slipped, spread across tools that never get compared against each other. Vyso watches all of them at once and tells you what moved.",
  approachIntro:
    "Nothing here is a new spreadsheet to reconcile. It's the ones you already have, read together.",
  approachSteps: [
    {
      title: "The sources leakage actually happens in",
      copy: "Purchase invoices, delivery notes, price lists, stock counts and debtor ages, read continuously rather than reconciled once a month.",
    },
    {
      title: "Small things are compared, not dismissed",
      copy: "A R200 variance alone looks too small to chase. The same variance repeating every week for two months is a pattern worth naming.",
    },
    {
      title: "What moved is ranked, with the evidence attached",
      copy: "The three things that moved against you this week, in order of size, each with the document or count it came from.",
    },
  ],
  demo: {
    kind: "findings",
    items: [
      {
        state: "alert",
        observation:
          "Thyme and Basil Catering is 18 days past terms, day 48, their longest ever.",
        impact: "R23,400 outstanding",
        evidence: "2 unpaid invoices",
        meta: "DAY 48 · TERMS 30",
        actions: ["Draft a reminder", "Show payment history"],
      },
      {
        state: "alert",
        observation: "Gross margin has slipped from 31.4% to 29.3% over four months.",
        impact: "≈R223,000/yr, R18,600 a month",
        evidence: "4 monthly margin runs",
        meta: "-2.1 POINTS · APR-AUG",
        actions: ["Show what moved", "Draft a price review"],
      },
      {
        source: "VYSO IS WATCHING",
        state: "watching",
        observation:
          "One supplier's invoice bills 20 units of sunflower oil; the delivery note shows 18.",
        impact: "R756 over-billed",
        evidence: "invoice + delivery note",
        meta: "SMALL, BUT REAL",
        actions: ["Draft credit request"],
      },
    ],
  },
  outcomes: [
    "Small losses are ranked by size instead of ignored because each one looks too minor alone.",
    "A pattern is visible after the second occurrence, not at year-end reconciliation.",
    "Every figure carries the invoice, delivery note or count it came from.",
    "No new spreadsheet to maintain, it reads the ones that already exist.",
  ],
  integrationsNote:
    "Xero and WhatsApp Business are the two systems we connect directly today, invoices, bills and balances from the one, orders and forwarded documents from the other. Everything else, Sage, stock sheets, point-of-sale systems, is designed around what you actually run, scoped during your audit.",
  caseStudy: true,
  learnArticle: {
    label: "Why businesses lose money without realising it",
    href: "/learn/why-businesses-lose-money-without-realising-it",
  },
  related: ["procurement-automation", "inventory-automation", "reporting-automation"],
  faqs: [
    {
      question: "How does Vyso find money leaking that we can't see today?",
      answer:
        "By reading the documents leakage already lives in, purchase invoices, delivery notes, price lists, stock counts, and comparing each one against what came before it. The free audit maps where your business is most exposed before anything is switched on.",
    },
    {
      question: "Do we need to replace our accounting or stock system first?",
      answer:
        "No. Vyso reads from the tools you already run rather than replacing them. The audit confirms which sources are reliable enough to watch and which need tidying first.",
    },
    {
      question: "How quickly would we see where money is leaking?",
      answer:
        "The audit gives you a written picture within the week. After that it depends on the data, a supplier price creep shows up on the second invoice, while a stock pattern needs a few counts before it means anything.",
    },
    {
      question: "Is this only worth it for larger businesses?",
      answer:
        "No. A single growing operation is a fit once the leakage is no longer small enough to shrug off. What gets built is scoped to the business in front of us, not a fixed package.",
    },
  ],
  og: {
    eyebrow: "REDUCE MONEY LEAKAGE",
    title: "The money isn't missing.",
    continuation: "Nobody is watching it leave.",
    lead: "Invoices, stock, pricing and margin, watched together.",
    frameTitle: "This week",
    feed: [
      {
        time: "1",
        text: "Thyme and Basil is 18 days past terms. R23,400 outstanding.",
        accent: true,
        label: "NEEDS ATTENTION",
      },
      {
        time: "2",
        text: "Gross margin slipped from 31.4% to 29.3% over four months.",
        accent: true,
        label: "NEEDS ATTENTION",
      },
      { time: "3", text: "One invoice over-billed by R756. Small, but real." },
    ],
  },
};

/* ── Registry ─────────────────────────────────────────────────────────────── */

/** Fixed presentation order, matching plan §7.4. */
export const SOLUTION_ORDER: readonly SolutionSlug[] = [
  "whatsapp-order-automation",
  "invoice-automation",
  "spreadsheet-automation",
  "procurement-automation",
  "inventory-automation",
  "reporting-automation",
  "document-processing",
  "reduce-money-leakage",
];

/* `Record<string, Solution>`, not `Record<SolutionSlug, Solution>`: kept loose
   deliberately, matching the shape the file this replaces had, because
   `components/finch/industries/IndustrySections.tsx` indexes it with its OWN
   (wider, pre-trim) `SolutionSlug` union from `lib/marketing/industries.ts`.
   The `"operations-dashboard"` entry below is that compatibility bridge — see
   the file header. It is NOT in `SOLUTION_ORDER`, is not statically generated
   by `app/solutions/[slug]/page.tsx`, and is not linked from anywhere in this
   file. Remove it once `lib/marketing/industries.ts` (Phase 2d) stops naming
   it and `next.config.ts`'s redirect (Phase 4, plan §6) is live. */
export const SOLUTIONS: Record<string, Solution> = {
  "whatsapp-order-automation": whatsappOrderAutomation,
  "invoice-automation": invoiceAutomation,
  "spreadsheet-automation": spreadsheetAutomation,
  "procurement-automation": procurementAutomation,
  "inventory-automation": inventoryAutomation,
  "reporting-automation": reportingAutomation,
  "document-processing": documentProcessing,
  "reduce-money-leakage": reduceMoneyLeakage,
  "operations-dashboard": reportingAutomation,
};

export const SOLUTION_LIST: readonly Solution[] = SOLUTION_ORDER.map((slug) => SOLUTIONS[slug]);

export function getSolution(slug: string): Solution | undefined {
  return SOLUTION_ORDER.includes(slug as SolutionSlug) ? SOLUTIONS[slug] : undefined;
}

/* ── The hub ──────────────────────────────────────────────────────────────── */

export const HUB = {
  title: "Solutions: what Vyso automates in your operation",
  description:
    "WhatsApp orders, invoicing, spreadsheets, procurement, stock, reporting, documents and money leakage. Eight problems Vyso fixes, from a free audit.",
  eyebrow: "WHAT VYSO AUTOMATES",
  heading: "Fix the problem,",
  continuation: "not just the task.",
  lead:
    "Nobody starts by searching for automation software. They start with a symptom, orders that get retyped, a report rebuilt every week, money that leaks a little at a time. Each page below names one of those problems plainly, and what Vyso would actually do about it.",
} as const;

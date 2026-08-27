/* ── FAQ content ───────────────────────────────────────────────────────────
   Rewritten for the 2026 redesign (`.ai/plan_vyso_redesign_2026.md` §7.6,
   `.ai/brief_redesign_2026_copy.md`'s FAQ question set). This file previously
   answered questions about Finch, OrderFlow, founding-client terms and a
   published academy price; none of that survives here. Vyso is now presented
   as one AI operations company, not the company behind a named product, and
   every answer below is written against that positioning.

   Every answer opens with a sentence that directly answers the question
   (AEO: an answer engine or a skimming reader gets the fact in the first
   clause) and stays concise. No prices or rand figures for Vyso's own fees
   anywhere (copy rule §3.1): "How much does Vyso cost?" is answered as
   philosophy, never a figure. "Does Vyso work outside South Africa?" is
   answered honestly rather than left vague: primarily South Africa.

   The same question/answer strings feed the FAQPage JSON-LD on `/faq`
   (`ALL_FAQ_QUESTIONS` below) and the subset `/south-africa` quotes by id —
   schema, `/faq` and `/south-africa` can never drift apart because there is
   only one copy of each answer. */

export type FaqItem = {
  /** Stable slug — the `<details id>` a deep link (`/faq#<id>`) opens. */
  id: string;
  question: string;
  answer: string;
};

export type FaqGroup = {
  /** Section anchor. `pricing` is load-bearing: `/pricing-faq` 301s to
      `/faq#pricing` (see `next.config.ts`), so this id must stay `pricing`. */
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  questions: readonly FaqItem[];
};

export const FAQ_GROUPS: readonly FaqGroup[] = [
  {
    id: "vyso",
    eyebrow: "Vyso",
    title: "What Vyso is",
    description: "The basics: who Vyso is, who it's built for, and where we operate.",
    questions: [
      {
        id: "what-is-vyso",
        question: "What is Vyso?",
        answer:
          "Vyso is an AI operations company that builds automated systems for South African businesses. We connect the tools you already use, automate the repetitive parts of your operation, and tell you when something needs attention before it becomes a bigger problem.",
      },
      {
        id: "what-does-vyso-automate",
        question: "What does Vyso automate?",
        answer:
          "Vyso automates the repetitive operational work that eats a team's time: capturing orders, generating invoices, checking stock, processing supplier documents and pulling together reports. Exactly what gets automated first depends on your operation, which is what the free Operations Audit works out.",
      },
      {
        id: "is-vyso-suitable-for-small-businesses",
        question: "Is Vyso suitable for small businesses?",
        answer:
          "Yes. Vyso is built for South African SMEs specifically: businesses running on WhatsApp, spreadsheets and a handful of connected tools rather than an enterprise software stack. Every system is scoped to the size of the problem, not to a minimum company size.",
      },
      {
        id: "where-is-vyso-based",
        question: "Where is Vyso based?",
        answer:
          "Vyso is based in Johannesburg, South Africa. We work with businesses across the country, in person where that helps and by call everywhere else.",
      },
      {
        id: "does-vyso-work-outside-south-africa",
        question: "Does Vyso work outside South Africa?",
        answer:
          "Vyso is built primarily for South African businesses, and that is where our attention and local context are strongest. If you operate outside South Africa, tell us during an audit conversation and we'll be honest about whether we're the right fit.",
      },
    ],
  },
  {
    id: "fit",
    eyebrow: "Fit and comparison",
    title: "How Vyso compares",
    description: "Where Vyso sits next to the alternatives you've probably already considered.",
    questions: [
      {
        id: "vyso-vs-zapier-or-make",
        question: "How is Vyso different from Zapier or Make?",
        answer:
          "Zapier and Make are tools you configure yourself, one automation at a time. Vyso is a team that designs and builds the system around your operation, connects the tools involved, and keeps watching after the automation runs so problems surface before they cost you money.",
      },
      {
        id: "vyso-vs-an-erp",
        question: "How is Vyso different from an ERP?",
        answer:
          "An ERP asks your business to move its workflows into one large platform, usually with significant setup and training. Vyso builds around the systems you already use and adds the layer that automates and monitors them, so there's no wholesale platform migration to plan for.",
      },
      {
        id: "vyso-vs-hiring-an-admin-employee",
        question: "How is Vyso different from hiring another admin employee?",
        answer:
          "An admin hire can do the same repetitive work, at the pace and hours of one person. Vyso automates that repetitive work directly and then keeps watching for problems around the clock, so an admin hire and Vyso often solve different halves of the same problem rather than compete for the same one.",
      },
      {
        id: "does-vyso-replace-our-current-software",
        question: "Does Vyso replace our current software?",
        answer:
          "Not usually. Vyso is designed to work with the software you already run, such as Xero, Sage, WhatsApp and Excel, rather than replace it. We connect and automate around your existing tools instead of asking you to migrate to new ones.",
      },
    ],
  },
  {
    id: "pricing",
    eyebrow: "Pricing and how it works",
    title: "Cost, the audit and timelines",
    description:
      "How pricing works, what the free Operations Audit includes, and how long a project usually takes.",
    questions: [
      {
        id: "how-much-does-vyso-cost",
        question: "How much does Vyso cost?",
        answer:
          "There's no fixed price list, because every operation is different. Every system Vyso builds is scoped around the specific problem it needs to solve: we start with the problem, quantify the opportunity, then recommend the smallest system capable of producing the outcome you need. A salon asking Vyso to automate enquiries is a different job from a distributor asking Vyso to redesign stock, procurement and wastage workflows, and the two are priced accordingly, after an audit rather than off a rate card.",
      },
      {
        id: "whats-included-in-the-free-operations-audit",
        question: "What is included in the free Operations Audit?",
        answer:
          "The free Operations Audit is time spent understanding how your operation actually works: where time and information get lost, which admin repeats itself, and where the highest return sits. You leave with a clear picture of what to automate first, whether or not you go ahead with Vyso afterwards, and there's no obligation to buy anything.",
      },
      {
        id: "how-long-does-a-project-take",
        question: "How long does a project take?",
        answer:
          "It depends on the scope agreed after your audit. A single automated workflow can be built and running in weeks, while a wider system covering several parts of your operation takes longer and is usually rolled out in stages, starting with whatever has the highest return.",
      },
      {
        id: "does-vyso-offer-ongoing-support",
        question: "Does Vyso offer ongoing support?",
        answer:
          "Yes. Vyso monitors the systems it builds and evolves them as your business changes, rather than handing over a finished product and leaving. Ongoing support is part of every engagement, not a separate add on.",
      },
    ],
  },
  {
    id: "tools",
    eyebrow: "Your tools",
    title: "What Vyso connects to",
    description: "What Vyso connects to today, and how it works with everything else.",
    questions: [
      {
        id: "can-vyso-work-with-whatsapp",
        question: "Can Vyso work with WhatsApp?",
        answer:
          "Yes. WhatsApp is one of the few tools Vyso connects to directly, so orders and messages sent to a WhatsApp Business number can be captured automatically instead of retyped by hand.",
      },
      {
        id: "can-vyso-work-with-excel",
        question: "Can Vyso work with Excel?",
        answer:
          "Yes. Spreadsheets are a normal input for Vyso, whether that means reading stock sheets, price lists or reports your team already keeps in Excel or Google Sheets. We design around the sheet rather than asking you to give it up.",
      },
      {
        id: "can-vyso-work-with-email",
        question: "Can Vyso work with email?",
        answer:
          "Yes. Vyso can read emailed orders, supplier statements, invoices and attachments, so information arriving by email gets captured instead of sitting in an inbox until someone has time to act on it.",
      },
      {
        id: "can-vyso-connect-to-sage",
        question: "Can Vyso connect to Sage?",
        answer:
          "We can design a system around Sage as your accounting record, though a direct Sage connection isn't live today. Tell us during your audit if Sage is your system of record and we'll scope what's possible.",
      },
      {
        id: "can-vyso-connect-to-xero",
        question: "Can Vyso connect to Xero?",
        answer:
          "Yes. Xero is one of the two tools Vyso connects to directly today, reading invoices, bills, contacts and account balances so your operational systems stay lined up with your books.",
      },
      {
        id: "can-vyso-work-with-custom-internal-systems",
        question: "Can Vyso work with custom internal systems?",
        answer:
          "In many cases, yes. If your business runs an internal database, a supplier portal or a system built specifically for you, we assess it during the audit and design the connection around what it can actually provide.",
      },
    ],
  },
  {
    id: "trust",
    eyebrow: "Data, security and autonomy",
    title: "Security and human control",
    description: "How your data is handled, and who stays in control of what Vyso does.",
    questions: [
      {
        id: "is-our-data-secure",
        question: "Is our data secure?",
        answer:
          "Yes. Access to your data is scoped to your organisation and to the roles that need it, and we're conscious of our obligations under POPIA in how we collect, use and store information. We're happy to explain our data handling in plain language before you commit to anything.",
      },
      {
        id: "does-vyso-make-autonomous-decisions",
        question: "Does Vyso make autonomous decisions?",
        answer:
          "No. Vyso surfaces findings, drafts and recommendations. It doesn't act on your business, your money or your customers without a person reviewing it first.",
      },
      {
        id: "can-humans-approve-actions-before-they-happen",
        question: "Can humans approve actions before they happen?",
        answer:
          "Yes, and that's the default. Every action a Vyso system proposes, from sending an invoice to flagging a supplier, is designed to be reviewed and approved by someone on your team before it happens.",
      },
      {
        id: "can-vyso-notify-staff-when-something-goes-wrong",
        question: "Can Vyso notify staff when something goes wrong?",
        answer:
          "Yes. Alerting the right person when something needs attention, a shortage, an overcharge, a margin slipping, is much of what Vyso is built to do. Notifications go to whoever on your team needs to see them.",
      },
    ],
  },
];

/** Flat list for the FAQPage JSON-LD — identical question/answer text to what
    the page renders, so the schema can never say something the page doesn't. */
export const ALL_FAQ_QUESTIONS: readonly FaqItem[] = FAQ_GROUPS.flatMap((group) => group.questions);

export default FAQ_GROUPS;

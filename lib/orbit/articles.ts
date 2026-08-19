/* ── The three launch articles ───────────────────────────────────────────────
   `/orbit/learn/[slug]`. Long-tail search, written for a South African
   tradesperson rather than for a keyword, and each one 700–1,000 words.

   Two rules carried over from `lib/marketing/learn-articles.ts`:

   - **Where an article states a fact about the world, it says where the fact
     comes from.** The invoicing piece leans on section 20 of the Value-Added
     Tax Act and on what SARS publishes about it, and it says so in the body
     and again in `sources` — because an article that tells a plumber what has
     to be on an invoice and is wrong costs that plumber money.
   - **Where an article says something about Orbit, it says Orbit is not built
     yet.** Every piece closes on the waitlist, not on a feature.

   The type is deliberately smaller than the Finch one: no author box, no
   related-agent strip, no glossary chips. Three articles do not need a content
   system.                                                                      */

export type ArticleSection = {
  /** Rendered as an `<h2>`, and used to build the id for the table of
      contents. Keep them short — they are also the outline an answer engine
      reads to decide what the page covers. */
  heading: string;
  /** Paragraphs. A string starting with "- " renders as a list item. */
  paragraphs: string[];
};

export type OrbitArticle = {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  title: string;
  /** The card copy on `/orbit/learn` and the article's own standfirst. */
  standfirst: string;
  datePublished: string;
  dateModified: string;
  /** Rough, honest, and used in the `<time>` and in the card. */
  readingMinutes: number;
  sections: ArticleSection[];
  sources?: { label: string; note: string }[];
  /** Internal links the piece earns. Every href must be a real route. */
  related: { href: string; label: string }[];
};

const PUBLISHED = "2026-08-19";

export const ORBIT_ARTICLES: OrbitArticle[] = [
  {
    slug: "how-to-track-jobs-on-whatsapp",
    metaTitle: "How to track jobs on WhatsApp — SA trade guide",
    metaDescription:
      "A practical way for South African tradespeople to track jobs using WhatsApp alone: what to send, when to send it, and what to do at month end.",
    title: "How to track jobs on WhatsApp: a South African tradesperson's guide",
    standfirst:
      "You already run your day on WhatsApp. Here is how to make it hold the record of your work as well — with nothing more than the app you have, and a habit that takes four seconds a job.",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    readingMinutes: 5,
    sections: [
      {
        heading: "Why WhatsApp and not an app",
        paragraphs: [
          "Every tradesperson who has ever bought job-management software has the same story: it was installed in January, used properly for three weeks, and abandoned by March. The software was usually fine. What failed was the habit, because using it meant forming a new one — opening an app you open for no other reason, after a nine-hour day, to type in things you already know.",
          "WhatsApp does not have that problem. It is already open. The customer messaged you on it this morning, you sent them a photo of the finished work on it this afternoon, and your supplier will send you a price on it tomorrow. If the record of your work lives anywhere that you will actually keep up to date, it is there.",
          "This guide is a method, not a product. You can do all of it today with nothing but WhatsApp and a small amount of discipline. At the end there is a note about Orbit, which is the thing we are building to remove the discipline part — but the method stands on its own.",
        ],
      },
      {
        heading: "Step one: make yourself a job thread",
        paragraphs: [
          "Open WhatsApp, start a chat with your own number — WhatsApp has let you message yourself for a while now — and pin it to the top. That thread is your job book. Nobody else can see it, it syncs to every device you sign in on, and it is searchable.",
          "If messaging yourself feels strange, a private group with one other person works the same way. What matters is that it is one place, that it is not mixed in with customer chats, and that it is pinned so you do not have to go looking for it.",
        ],
      },
      {
        heading: "Step two: one message per job, sent when you finish",
        paragraphs: [
          "The message needs four things and no more: what you did, where, what you charged, and whether it has been paid. Punctuation and capitals do not matter. This is a complete, useful record:",
          "- fixed tiling at 1st avenue. charged 3800. not paid",
          "- geyser element northcliff 1450 + 350 callout. paid eft",
          "- gate motor 14 acacia 850 cash",
          "Send it before you drive away. That is the entire trick, and it is the part everyone gets wrong. A job written up at nine that night is a job written up from memory; a job written up in the driveway is a job written up from fact. The difference across a month is usually a few thousand rand of work that was done and never billed.",
        ],
      },
      {
        heading: "Step three: materials go in the same thread",
        paragraphs: [
          "Every time you buy something, send a line before you leave the counter: what you bought, what it cost, and which job it is for. \"12 bags cement 1090 buildit — rivonia\" takes four seconds and answers a question you would otherwise answer wrongly in three weeks.",
          "This is the single most valuable habit in the list, and the least popular. Materials bought for one job and used across three are the reason small trade businesses cannot tell you which of their jobs actually made money. If you do nothing else from this guide, do this.",
        ],
      },
      {
        heading: "Step four: mark payments as they land",
        paragraphs: [
          "When money arrives, reply to the original job message with \"paid\". WhatsApp keeps the reply attached to the message it answers, so a search for an address shows you the job and its payment in one place.",
          "Anything without a \"paid\" under it is owed to you. That is your debtors list, and it is more current than most small businesses manage with accounting software.",
        ],
      },
      {
        heading: "Step five: month end takes twenty minutes, not an evening",
        paragraphs: [
          "At the end of the month, scroll the thread. Everything you did is there in order, with amounts. Add up the charged column for your income, the materials column for your direct costs, and note which jobs still have no \"paid\" reply.",
          "Then do the two things that make the whole exercise worth it. First, send invoices for anything unbilled — and there will be more than you expect. Second, look at the jobs where materials came close to the price you charged, and put those prices up.",
        ],
      },
      {
        heading: "The limits of doing it by hand",
        paragraphs: [
          "This method works, and it will beat a notebook every time, but it has two real limits. It does not produce an invoice — you still have to make the document yourself. And it does not add anything up; you do, on the last day of the month, with a calculator.",
          "That is the gap Orbit is being built to close: the same messages, sent to a number that reads them, records the job, keeps the running totals and drafts the invoice for you to check and send. Orbit is in development and there is no launch date yet. If that sounds useful, join the waitlist — it is free and we WhatsApp the list first.",
        ],
      },
    ],
    related: [
      { href: "/orbit/how-it-works", label: "How Orbit works" },
      { href: "/orbit/learn/invoice-from-whatsapp-south-african-invoice-requirements", label: "What a South African invoice has to say" },
      { href: "/orbit/waitlist", label: "Join the Orbit waitlist" },
    ],
  },

  {
    slug: "invoice-from-whatsapp-south-african-invoice-requirements",
    metaTitle: "What a South African invoice must include",
    metaDescription:
      "What the law requires on a South African invoice and tax invoice, when the R5,000 abridged rule applies, and what non-VAT vendors must not do.",
    title: "Invoicing from WhatsApp: what the law needs on a South African invoice",
    standfirst:
      "If you are going to bill from your phone, the document still has to be right. Here is what a South African invoice must carry, what changes when you are a VAT vendor, and the one mistake that gets small businesses into trouble.",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    readingMinutes: 6,
    sections: [
      {
        heading: "First: are you a VAT vendor?",
        paragraphs: [
          "Everything else follows from this. If you are registered for VAT, you issue tax invoices and the Value-Added Tax Act tells you exactly what has to be on them. If you are not registered, you issue ordinary invoices — and you may not charge VAT, call the document a tax invoice, or show a VAT number you do not have.",
          "That last point is the mistake worth naming early, because it is common and it is expensive. A small operator copies an invoice template from someone bigger, leaves the \"VAT @ 15%\" line on it, and is now collecting money as if it were tax. SARS treats that seriously. If you are not registered, delete the VAT line.",
          "VAT registration is compulsory once your taxable turnover passes R1 million in any twelve-month period, and voluntary below that above a lower threshold. If you are anywhere near it, that is an accountant conversation, not a website one.",
        ],
      },
      {
        heading: "What an ordinary invoice should carry",
        paragraphs: [
          "If you are not a VAT vendor, the law is far lighter on you, but a customer — especially a business customer — needs enough to pay you and to put the cost in their own books. In practice that means:",
          "- Your business name and contact details, and your registration number if you have one",
          "- The customer's name, and their address where you have it",
          "- A unique invoice number, in a sequence you keep",
          "- The date of issue",
          "- A description of the work, and where it was done",
          "- The amount due, and your payment terms",
          "- Your banking details",
          "Keep a copy. The Companies Act and the Tax Administration Act both expect business records to be retained for five years, and an invoice is a business record whether or not it is a tax invoice.",
        ],
      },
      {
        heading: "What a full tax invoice must carry",
        paragraphs: [
          "Section 20 of the Value-Added Tax Act sets out the particulars for a tax invoice, and SARS publishes the same list in its VAT guidance. A full tax invoice must contain:",
          "- The words \"Tax Invoice\", \"VAT Invoice\" or \"Invoice\"",
          "- The name, address and VAT registration number of the supplier — you",
          "- The name and address of the recipient, and their VAT registration number where they are a vendor",
          "- An individual serialised number",
          "- The date on which the tax invoice is issued",
          "- A description of the goods or services supplied",
          "- The quantity or volume supplied",
          "- Either the value, the VAT charged and the total; or the total with a statement that it includes VAT and the rate charged",
          "Two formats for the money, in other words: you can break it out, or you can state a VAT-inclusive total and say so. Both are acceptable; pick one and be consistent.",
        ],
      },
      {
        heading: "The R5,000 rule, and what it lets you leave out",
        paragraphs: [
          "Where the consideration for the supply is R5,000 or less, an abridged tax invoice is allowed. It still needs the words \"Tax Invoice\", your name, address and VAT number, the date, a serial number, a description of what was supplied, and the money treated the same way as above — but you do not have to carry the recipient's details or the quantity.",
          "For a trade business this covers most callouts and small repairs, which is exactly the work that currently goes unbilled. It is worth knowing that the compliant version of that invoice is short.",
          "Below R50, no tax invoice is required at all, though you still need a document showing the VAT — a till slip does it. That threshold rarely matters on site.",
        ],
      },
      {
        heading: "Sending it from a phone",
        paragraphs: [
          "None of the above says anything about paper, and none of it says anything about email. A tax invoice can be issued electronically. What matters is that the document contains the required particulars, that it is issued within twenty-one days of the supply, and that you keep a copy you can produce later.",
          "So a PDF sent over WhatsApp is a perfectly good tax invoice, provided the PDF says the right things. What is not a tax invoice is a WhatsApp message reading \"that'll be 3800 thanks\" — which is how a great deal of trade work is currently billed.",
        ],
      },
      {
        heading: "Where Orbit fits",
        paragraphs: [
          "Orbit is being built so that the record you make in a WhatsApp message becomes a document that carries these particulars: your details, the customer, a serial number, the date, a description of the work, and the money in one of the two accepted forms. You read the draft and you send it — Orbit drafts, you send.",
          "Orbit is in development and has no launch date. Until it opens, the practical version of this article is: make a template with the fields above, number your invoices in one sequence, and never put a VAT line on a document if you are not registered.",
          "This is general information, not tax advice. SARS and your accountant are the authorities on your own situation, and the VAT Act is the authority on the list above.",
        ],
      },
    ],
    sources: [
      {
        label: "Value-Added Tax Act 89 of 1991, section 20",
        note: "The particulars required on a tax invoice, the abridged tax invoice threshold, and the twenty-one day issuing period.",
      },
      {
        label: "SARS VAT guidance",
        note: "SARS restates the section 20 particulars and the R5,000 and R50 thresholds in its published VAT material.",
      },
    ],
    related: [
      { href: "/orbit/learn/how-to-track-jobs-on-whatsapp", label: "How to track jobs on WhatsApp" },
      { href: "/orbit/faq", label: "Orbit FAQ" },
      { href: "/orbit/pricing", label: "Orbit pricing" },
    ],
  },

  {
    slug: "why-tradespeople-lose-money-between-the-job-and-the-bank",
    metaTitle: "Where trade businesses lose money after the job",
    metaDescription:
      "The money a trade business loses is rarely lost on site. It goes missing in the days between finishing the job and the payment landing. Six places to look.",
    title: "Why tradespeople lose money between the job and the bank",
    standfirst:
      "Almost nobody loses money doing the work. It goes missing afterwards, in the gap between the last tool going in the bakkie and the payment landing — and it goes missing in six predictable places.",
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
    readingMinutes: 6,
    sections: [
      {
        heading: "The gap nobody manages",
        paragraphs: [
          "Ask a tradesperson where their business loses money and they will talk about pricing, or about a customer who did not pay, or about the price of materials. All three are real. None of them is the biggest one.",
          "The biggest one is the gap: the days between finishing a job and the money arriving, during which the job exists only in someone's memory. Nothing in that gap is anyone's job. There is no moment at which a person is supposed to write it down, no system that notices it has not been written down, and no consequence until month end, by which time the detail has gone.",
          "What follows is the six places the money actually goes. None of them require better pricing to fix. All of them require the record to be made earlier.",
        ],
      },
      {
        heading: "1. The small job that never becomes an invoice",
        paragraphs: [
          "A R450 callout does not feel like it justifies an evening at a laptop. So it does not get one. Sometimes the customer pays cash and it is fine; often they say they will EFT and nobody follows up, because there is nothing to follow up against.",
          "This is the single largest leak in a one-person trade business and it is invisible by construction: you cannot miss what was never written down. Two of these a week at R450 is over R46,000 a year.",
        ],
      },
      {
        heading: "2. The extra that was agreed verbally",
        paragraphs: [
          "The ceiling that was not in the quote. The second coat. The extra six square metres in the guest bathroom. Every one of them was agreed in a passage, out loud, with both parties nodding.",
          "By the time the invoice is written, one of two things happens. Either the extra is left off, because you are not certain enough to charge for it — or it goes on and the customer disputes it, because they remember the first number and you have nothing dated to point at. Both outcomes cost you.",
        ],
      },
      {
        heading: "3. Materials that were bought for one job and charged to none",
        paragraphs: [
          "You buy for the day, not for the job. One trip supplies two or three sites, and the slip goes in the door pocket. Reconstructing which cost belongs to which job, three weeks later, from a faded slip, does not happen.",
          "The result is not just an unrecovered cost. It is a costing model that is wrong in both directions: the job that absorbed everything looks unprofitable, so you put its price up; the jobs that absorbed nothing look excellent, so you keep pricing them too low.",
        ],
      },
      {
        heading: "4. Hours that were worked away from the customer",
        paragraphs: [
          "Workshop time for a carpenter. A roof survey for a solar installer. The second trip because the client changed their mind. Real hours, all of them, and almost never on an invoice — because nobody was standing there watching them happen.",
          "Whether to bill them is a commercial decision that is yours to make. But you cannot make a decision about work you never recorded, and the default outcome of not recording it is that you gave it away.",
        ],
      },
      {
        heading: "5. The invoice that went out late",
        paragraphs: [
          "There is a well-worn observation in credit management that the older an invoice is, the harder it is to collect. It does not need a statistic to be obvious: an invoice that arrives the same week lands while the customer is still pleased with the work, and one that arrives six weeks later lands while they are looking at their own bank balance.",
          "Late invoicing is not a collections problem. It is a recording problem wearing a collections problem's clothes: the invoice is late because the job details were not to hand.",
        ],
      },
      {
        heading: "6. The price that never moved",
        paragraphs: [
          "You charged R280 a square metre in 2024 and you are still charging it. Not because you decided to, but because you cannot remember what you charged, so you quote what feels familiar — and what feels familiar is what you charged last time, which was also what felt familiar then.",
          "Prices only move when somebody looks at a record and sees that the margin has closed. Without the record, the price drifts down in real terms every year, quietly, forever.",
        ],
      },
      {
        heading: "What actually fixes it",
        paragraphs: [
          "All six leaks have the same shape: something true was known by one person, at one moment, and was not written down before it faded. Fixing them does not need better software at the office end. It needs the record to be made at the job, by the person who did it, in less time than it takes to think about it.",
          "That is the entire design brief for Orbit: you text what you did and what you charged, it records the job, keeps the running totals and drafts the invoice for you to check and send. Orbit is in development — there is no launch date yet, and this article is not describing a product you can buy today. Join the waitlist and we WhatsApp you when it opens.",
        ],
      },
    ],
    related: [
      { href: "/orbit/learn/how-to-track-jobs-on-whatsapp", label: "How to track jobs on WhatsApp" },
      { href: "/orbit/compare/orbit-vs-spreadsheets", label: "Orbit vs a spreadsheet and a notebook" },
      { href: "/orbit/waitlist", label: "Join the Orbit waitlist" },
    ],
  },
];

export const ORBIT_ARTICLE_SLUGS = ORBIT_ARTICLES.map((a) => a.slug);

export function getOrbitArticle(slug: string): OrbitArticle | undefined {
  return ORBIT_ARTICLES.find((a) => a.slug === slug);
}

export default ORBIT_ARTICLES;

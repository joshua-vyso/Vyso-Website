/* ── The ten trade pages ─────────────────────────────────────────────────────
   `/orbit/for/[trade]`. Ten of them, and the reason each one carries four
   hundred words of its own copy rather than a template with a noun swapped is
   that a templated set of ten pages is a doorway-page pattern: Google's own
   spam policy names it, and an answer engine asked "can plumbers invoice from
   WhatsApp" has nothing to quote from a page that says the same thing as nine
   others with a different heading.

   So each entry below states a different problem in the trade's own vocabulary
   — a plumber's callouts are not a roofer's weather windows are not a solar
   installer's COC paperwork — and each carries its own chat script, because the
   message a tradesperson would actually type is the most trade-specific thing
   on the page.

   **Honesty.** Nothing here says Orbit does something today. Every page renders
   `ORBIT.status` above the fold and every CTA is "Join Waitlist". The pains are
   descriptions of how the work runs now, which are the author's own
   observations of South African trades — they carry no statistics, because
   there are none we have measured.                                            */

import type { ChatScript } from "./sequences";

export type TradeFaq = { question: string; answer: string };

export type Trade = {
  slug: string;
  /** "Plumbers" — the plural, which is how the pages and the nav name them. */
  name: string;
  /** "a plumber" — for sentences. */
  singular: string;
  /** `<title>`. The root layout appends " | Vyso" (7 characters), and the
      plan's budget is 60 for the rendered tag — so **≤ 53 here**. Four of the
      ten were over on the first pass and were cut; the crawl in
      `.ai/verification/orbit` is what caught them. */
  metaTitle: string;
  /** `<meta name="description">`, ≤155 characters. */
  metaDescription: string;
  h1: string;
  lead: string;
  /** Three or four things that go wrong between the job and the bank. */
  pains: { title: string; body: string }[];
  /** Two or three paragraphs of trade-specific prose under the phone. */
  body: string[];
  /** What Orbit would keep for this trade. Short, concrete, no promises. */
  keeps: string[];
  chat: ChatScript;
  faqs: TradeFaq[];
};

export const TRADES: Trade[] = [
  {
    slug: "plumbers",
    name: "Plumbers",
    singular: "a plumber",
    metaTitle: "Orbit for plumbers — invoice from WhatsApp",
    metaDescription:
      "Plumbers: text Orbit what you fixed and what you charged. It tracks the callout, drafts the invoice and remembers who still owes. Join the waitlist.",
    h1: "Plumbers: bill the callout before you leave the driveway.",
    lead:
      "A plumbing day is five or six stops, three of them unplanned. The geyser at eight, the blocked drain at eleven, the emergency that pushes everything else to tomorrow. By the time you get home the first job is a smear in a notebook and a number you half remember.",
    pains: [
      {
        title: "Callouts get billed late, or not at all",
        body:
          "The small ones are the ones that vanish. A washer, a trap, forty minutes and a callout fee. It never reaches an invoice because writing an invoice for R650 costs an evening you would rather not spend, and three of those a week is real money walked away from.",
      },
      {
        title: "Materials come out of your pocket first",
        body:
          "You pay for the copper, the fittings and the geyser at the counter, then try to remember which of the day's four jobs each slip belongs to. Anything you cannot place gets absorbed, which means the job you thought made money did not.",
      },
      {
        title: "You are the only person who knows what is owed",
        body:
          "The debtor list lives in your head. You know that the Rivonia job was three weeks ago and that the estate agent has still not paid, but you find out by remembering, usually at eleven at night, and never in time to do anything useful about it.",
      },
    ],
    body: [
      "Orbit is being built so that the record happens where the day already happens. You finish a callout, you type one line into WhatsApp — what you did, where, and what you charged — and Orbit turns it into a job with a value against it. There is no app to open in a wet passage with one hand, no form with nine fields, and no second device.",
      "Because the record is made at the job, the invoice can be drafted from it. Ask Orbit to invoice and it prepares the document with the customer, the address, the amount and the terms already filled in. You read it and you send it. Orbit never sends anything on your behalf — that rule holds across every Vyso product and it holds here.",
      "The same record answers the questions you currently answer from memory: what did I charge at that address last time, what have I spent on materials this week, and who has not paid me. Those are the three questions that decide whether a plumbing business is quietly profitable or quietly not, and today most one- and two-van operations answer all three by guessing.",
    ],
    keeps: [
      "Every callout with its address, what you did and what you charged",
      "Materials against the job you bought them for",
      "Invoices drafted from the job, ready for you to send",
      "Who has paid, who has not, and how long it has been",
    ],
    chat: {
      id: "plumbers",
      alt: "A WhatsApp-style chat where a plumber texts Orbit “replaced geyser element in northcliff, 1450 plus 350 callout” and Orbit records the job at R1,800.",
      caption: "ILLUSTRATIVE EXAMPLE",
      messages: [
        { side: "out", text: "replaced geyser element in northcliff, 1450 plus 350 callout", time: "09:24", status: "read" },
        {
          side: "in",
          text: "Tracking that now ✅",
          rows: [
            ["Job", "Northcliff — geyser element"],
            ["Charged", "R1,800.00"],
            ["Status", "Done"],
          ],
          time: "09:24",
        },
        { side: "out", text: "invoice it", time: "09:25", status: "read" },
        { side: "in", text: "Invoice #0118 drafted — R1,800.00, 14 days. Tap to send.", time: "09:25" },
      ],
    },
    faqs: [
      {
        question: "Can I bill a callout fee and labour separately?",
        answer:
          "Say both in the message — \"1450 plus 350 callout\" — and Orbit is being built to read them as two lines on one job, so the invoice shows the callout and the work separately rather than one lump. Orbit is in development; join the waitlist and we will WhatsApp you when it opens.",
      },
      {
        question: "Do I need to be at the job to record it?",
        answer:
          "No. Orbit is a WhatsApp conversation, so you can send the message from the van, from the counter at the merchant, or from the couch that evening. The job is recorded when you send the message, and you can tell Orbit which day it was if it was not today.",
      },
      {
        question: "What about emergency work at night?",
        answer:
          "It works the same way, which is the point. A two-in-the-morning burst pipe is exactly the job that never gets invoiced, because by Monday it is one of nine things you half remember. One line into WhatsApp before you drive home is the whole record.",
      },
      {
        question: "Will Orbit handle plumbing certificates of compliance?",
        answer:
          "Not at launch. Orbit is being built around the job, the money and the invoice first. Storing and reminding you about certificates is on the roadmap, not in the product, and this page will say so plainly until that changes.",
      },
    ],
  },

  {
    slug: "electricians",
    name: "Electricians",
    singular: "an electrician",
    metaTitle: "Orbit for electricians — jobs and invoices",
    metaDescription:
      "Electricians: text Orbit the job and the amount. It tracks the work, drafts the invoice and keeps the money side straight. Join the Orbit waitlist.",
    h1: "Electricians: the job is done. The paperwork should be too.",
    lead:
      "DB board this morning, a fault-find that took three hours instead of one, two plug points and a quote you promised by Friday. The work is the easy part. The part that costs you is everything that happens after you pack the ladder.",
    pains: [
      {
        title: "Hourly work becomes a guess",
        body:
          "Fault-finding does not fit a fixed price, so it gets billed on time — and the time gets reconstructed days later from a WhatsApp to the client and a rough memory of when you left. Under-billing an afternoon by an hour, twice a week, is a salary.",
      },
      {
        title: "Quotes and jobs live in different places",
        body:
          "You quoted the rewire on WhatsApp, agreed the change on a phone call, did the work, and now the invoice has to be built from three sources, none of which agree. The client remembers the first number.",
      },
      {
        title: "Small extras never make the invoice",
        body:
          "Two extra downlights, a length of trunking, the isolator you supplied because the wholesaler was closed. Each one is small enough to forget and, added across a month, large enough to notice.",
      },
    ],
    body: [
      "Orbit is being built so an electrical job is recorded in the same place you already tell the client you are on your way. One message — what you did, at which address, for how much — and Orbit holds it as a job with a value, a date and a customer. Extras go in the same way, one line at a time, as they happen rather than as you try to remember them.",
      "When the work is finished, the invoice is drafted from that record rather than from memory. Everything Orbit has for the job is on it: the labour, the extras, the materials you told it about. You check it, you change what is wrong, and you send it yourself. Nothing leaves your hands automatically.",
      "It also keeps the answer to the question every electrician gets asked and nobody can answer quickly: what did we charge that client last time. Same address, same customer, same history, in a thread you can search — which is closer to how you already work than any job-management app you have been sold.",
    ],
    keeps: [
      "Each job with its address, what was done and what it earned",
      "Extras added in the moment instead of remembered later",
      "Drafted invoices you read and send yourself",
      "A searchable history per customer and per address",
    ],
    chat: {
      id: "electricians",
      alt: "A WhatsApp-style chat where an electrician texts Orbit “db board fault find bryanston 3 hrs at 650 plus 2 downlights” and Orbit records R2,150 against the job.",
      caption: "ILLUSTRATIVE EXAMPLE",
      messages: [
        { side: "out", text: "db board fault find bryanston 3 hrs at 650 plus 2 downlights 200", time: "14:08", status: "read" },
        {
          side: "in",
          text: "Tracking that now ✅",
          rows: [
            ["Job", "Bryanston — DB fault find"],
            ["Labour", "3 hrs · R1,950.00"],
            ["Extras", "2 downlights · R200.00"],
            ["Total", "R2,150.00"],
          ],
          time: "14:08",
        },
      ],
    },
    faqs: [
      {
        question: "Can Orbit price my hours automatically?",
        answer:
          "You tell it your rate once and then say the hours — \"3 hrs\" — and Orbit is being built to do the multiplication and show it on the invoice as labour. If your rate differs by job type, say the rate in the message and that wins.",
      },
      {
        question: "Does Orbit issue certificates of compliance?",
        answer:
          "No, and it will not. A CoC is a legal document you issue as a registered person; Orbit has no part in that. It is being built to handle jobs, money and invoices, and this page will not pretend otherwise.",
      },
      {
        question: "Can I use it for quotes as well as invoices?",
        answer:
          "Quotes are on the roadmap and not in the first release. Orbit is starting with the part that leaks most — the work you have already done and not yet billed. Join the waitlist and you will hear when quoting arrives.",
      },
      {
        question: "What if I work for a contractor rather than direct clients?",
        answer:
          "It still helps, because the record is the same: what you did, on which site, for how much, and whether it has been paid. Where you invoice a main contractor rather than a homeowner, the customer on the job is simply the contractor.",
      },
    ],
  },

  {
    slug: "tilers",
    name: "Tilers",
    singular: "a tiler",
    metaTitle: "Orbit for tilers — track jobs and bill from WhatsApp",
    metaDescription:
      "Tilers: text Orbit what you tiled and what you charged. It tracks the job by square metre, drafts the invoice and keeps materials straight.",
    h1: "Tilers: square metres in, invoice out.",
    lead:
      "Tiling is measured work, priced per square metre, and paid in stages. Which means three numbers per job — the area, the rate and what has actually been paid so far — and all three usually live on the back of a cement bag.",
    pains: [
      {
        title: "Stage payments drift",
        body:
          "Half up front, half on completion is easy until the job runs over two weeks and a change is agreed in the middle. Then nobody is sure whether the second payment covers the extra bathroom or not, and the conversation happens after the work is done.",
      },
      {
        title: "Adhesive, grout and wastage are invisible",
        body:
          "You buy for the job, over-buy on purpose, and carry the surplus to the next one. Unless the buying is written against a job as it happens, every job looks like it used exactly what it needed, and none of them tell you your real margin.",
      },
      {
        title: "The measurement is the price, and the measurement is on paper",
        body:
          "Twenty-two square metres at R280 is the whole invoice. If the number lives on a photograph of a notebook page, then so does your billing.",
      },
    ],
    body: [
      "Orbit is being built so a tiler can say the job in the way a tiler says it — the address, the area and the money — and have that become a record instead of a note. \"fixed tiling at job on 1st avenue. charged 3800.\" is a complete instruction as far as Orbit is concerned: it makes the job, attaches the amount, and marks it done.",
      "From there the invoice is a reply away. Orbit drafts it with the customer and the amount already on it, and you send it before you have washed the tools. The thing that usually costs a tiler money is not the rate — it is the fortnight between finishing and invoicing, during which the customer's enthusiasm cools and your memory of the extras fades.",
      "Materials work the same way. Tell Orbit what you bought and roughly which job it was for, and it sits against that job rather than in a shoebox. Over a few months that is the difference between knowing your rate is right and hoping it is.",
    ],
    keeps: [
      "Each job with the area, the rate and the amount charged",
      "Adhesive, grout and tile bought against the job that used it",
      "Draft invoices for stage payments and final accounts",
      "A running list of what is still owed on which address",
    ],
    chat: {
      id: "tilers",
      alt: "A WhatsApp-style chat where a tiler texts Orbit “fixed tiling at job on 1st avenue. charged 3800.” and Orbit records the job and then drafts invoice #0042.",
      caption: "ILLUSTRATIVE EXAMPLE",
      messages: [
        { side: "out", text: "fixed tiling at job on 1st avenue. charged 3800.", time: "16:41", status: "read" },
        {
          side: "in",
          text: "Tracking that now ✅",
          rows: [
            ["Job", "1st Avenue — tiling"],
            ["Charged", "R3,800.00"],
            ["Status", "Done"],
          ],
          time: "16:41",
        },
        { side: "out", text: "invoice it", time: "16:42", status: "read" },
        { side: "in", text: "Invoice #0042 drafted — R3,800.00, 14 days. Tap to send.", time: "16:42" },
      ],
    },
    faqs: [
      {
        question: "Can I record a job by square metres instead of a total?",
        answer:
          "Say it the way you priced it — \"22 sqm at 280\" — and Orbit is being built to carry both the measurement and the total onto the invoice, so the client sees the basis rather than one number.",
      },
      {
        question: "How do deposits and final payments work?",
        answer:
          "Tell Orbit what was paid and when, and it keeps the balance against the job. Split invoicing for stage payments is planned for launch; anything not in the first release will be marked as roadmap on this site rather than implied.",
      },
      {
        question: "What if the job runs longer than quoted?",
        answer:
          "Add the change as its own line — \"extra 6 sqm in the guest bathroom, 1680\" — on the day it is agreed. The value of doing it in the moment is that the client's memory and yours are still the same.",
      },
      {
        question: "Does Orbit work if I have two or three teams out?",
        answer:
          "Multiple people on one Orbit account is on the roadmap, not in the first release. The waitlist form asks how you work so the early releases are shaped around the answers rather than around a guess.",
      },
    ],
  },

  {
    slug: "painters",
    name: "Painters",
    singular: "a painter",
    metaTitle: "Orbit for painters — quotes to invoices on WhatsApp",
    metaDescription:
      "Painters: text Orbit the rooms you did and what you charged. It tracks the job, drafts the invoice and keeps paint costs against the job.",
    h1: "Painters: three coats, one message, one invoice.",
    lead:
      "Painting is priced by the room, the wall or the day, and almost always agreed verbally on site. Which means the money conversation happens once, on a Tuesday, standing in a passage — and everything after that is reconstruction.",
    pains: [
      {
        title: "The scope changes while you are on the ladder",
        body:
          "The ceiling was not in the quote. Neither was the second coat the client asked for once they saw the colour. Both got done and only one of them is on the invoice, because the other happened in conversation.",
      },
      {
        title: "Paint is bought in bulk and used across jobs",
        body:
          "Twenty litres of PVA covers three jobs. Unless it is split across them as you go, one job carries the whole cost and looks unprofitable while the other two look better than they were.",
      },
      {
        title: "Day rates need a day count",
        body:
          "Four days becomes five and nobody wrote down which. The client remembers four.",
      },
    ],
    body: [
      "Orbit is being built for exactly this: a way to write things down that takes less effort than not writing them down. One line into WhatsApp at the end of the day — the address, the rooms, the amount — and the job exists with a value against it. Add the ceiling as its own line the moment it is agreed, and the invoice will carry it because the record does.",
      "When the job is finished, ask Orbit to invoice it. The draft comes back with the customer, the address and everything you told it, priced as you told it. You read it, correct anything, and send it yourself. Nothing goes to a client without you pressing send.",
      "Paint and consumables go in the same conversation. Tell Orbit what you bought and which job it was for and it stays with that job, so at the end of a month you can see what a room actually costs you to paint rather than what you assumed when you quoted.",
    ],
    keeps: [
      "Jobs by address, with rooms, coats and the agreed price",
      "Scope changes captured on the day they are agreed",
      "Paint and consumables split across the jobs that used them",
      "Draft invoices and a live list of who still owes",
    ],
    chat: {
      id: "painters",
      alt: "A WhatsApp-style chat where a painter texts Orbit “finished 3 bedrooms and passage in parkhurst, 6800, they added the ceiling 900” and Orbit records R7,700.",
      caption: "ILLUSTRATIVE EXAMPLE",
      messages: [
        { side: "out", text: "finished 3 bedrooms and passage in parkhurst 6800, they added the ceiling 900", time: "17:02", status: "read" },
        {
          side: "in",
          text: "Tracking that now ✅",
          rows: [
            ["Job", "Parkhurst — 3 bedrooms + passage"],
            ["Agreed", "R6,800.00"],
            ["Added", "Ceiling · R900.00"],
            ["Total", "R7,700.00"],
          ],
          time: "17:02",
        },
      ],
    },
    faqs: [
      {
        question: "Can I add work that was agreed verbally on site?",
        answer:
          "That is the case Orbit is being built for. Send the line the moment it is agreed and it joins the job as its own item, so the invoice shows the extra separately instead of hiding it in a total the client will query.",
      },
      {
        question: "Do I have to itemise every room?",
        answer:
          "No. Say as much or as little as you want. \"3 bedrooms and passage, 6800\" is enough to make a job with a value; \"parkhurst 6800\" is enough too. The detail you give is the detail the invoice can show.",
      },
      {
        question: "Can Orbit price by the day?",
        answer:
          "Yes — say the days and the rate. Orbit is being built to carry both onto the invoice so the client sees five days at your rate rather than a single unexplained figure.",
      },
      {
        question: "Is there an app to install?",
        answer:
          "No. Orbit is a WhatsApp conversation. If you can send a message you can use it, which is the entire design brief — no download, no login, no training.",
      },
    ],
  },

  {
    slug: "builders",
    name: "Builders",
    singular: "a builder",
    metaTitle: "Orbit for builders — site costs and invoices",
    metaDescription:
      "Builders: text Orbit progress, materials and amounts. It tracks each site, drafts progress invoices and keeps costs against the right job.",
    h1: "Builders: keep the site and the money in the same story.",
    lead:
      "A build runs for months, is paid in stages, and consumes material every single day. The gap between what a site has cost and what has been invoiced for it is where small builders lose their margin — usually without ever seeing the number.",
    pains: [
      {
        title: "Progress payments are agreed, then argued",
        body:
          "Foundations, slab, roof height, plaster. Each stage triggers a payment, and each payment is a conversation about whether the stage is actually complete. Without a dated record of what was finished when, the conversation is a memory contest.",
      },
      {
        title: "Material costs are spread across three sites",
        body:
          "One trip to the merchant supplies two jobs. Splitting that invoice correctly, weeks later, from a slip in the bakkie, does not happen — so one site absorbs the lot and your costing is wrong on both.",
      },
      {
        title: "Labour on site is a rolling number",
        body:
          "Four people this week, six next, one of them only on Thursday. Paid weekly, in cash, against a note. The total is knowable and almost never known.",
      },
    ],
    body: [
      "Orbit is being built as a way to keep a running record of a site without leaving WhatsApp. Send what happened — the stage reached, the material bought, the labour paid, the amount invoiced — and each line attaches to the site it belongs to. There is no site diary to fill in later, because the messages you already send are the diary.",
      "Because the record is per site, the money question can be answered per site: what has this job cost me, what have I invoiced, and what is outstanding. That is the number that decides whether a build is worth doing again, and it is the number most small builders only see at the end, if at all.",
      "Invoices are drafted from the same record. Ask for a progress invoice and Orbit prepares it against the stage you recorded, on the date you recorded it. You read it and send it yourself — Orbit does not send anything to a client on its own, on any Vyso product.",
    ],
    keeps: [
      "Every site as its own running record, dated",
      "Material and labour costs against the site that used them",
      "Progress invoices drafted from the stage you recorded",
      "Cost versus invoiced, per site, without a spreadsheet",
    ],
    chat: {
      id: "builders",
      alt: "A WhatsApp-style chat where a builder texts Orbit “rivonia slab done today, 12 bags cement 1090 from buildit” and Orbit records the stage and the material against the Rivonia site.",
      caption: "ILLUSTRATIVE EXAMPLE",
      messages: [
        { side: "out", text: "rivonia slab done today. 12 bags cement 1090 from buildit", time: "16:20", status: "read" },
        {
          side: "in",
          text: "Two things logged against Rivonia ✅",
          rows: [
            ["Stage", "Slab complete · 19 Aug"],
            ["Material", "Cement × 12 · R1,090.00"],
            ["Site total so far", "R48,310.00"],
          ],
          time: "16:20",
        },
        { side: "out", text: "invoice the slab stage", time: "16:21", status: "read" },
        { side: "in", text: "Progress invoice #0091 drafted — tap to check and send.", time: "16:21" },
      ],
    },
    faqs: [
      {
        question: "Can Orbit handle more than one site at a time?",
        answer:
          "Yes — name the site in the message and Orbit is being built to keep each one separate. Where a message is ambiguous it asks rather than guessing, because a cost on the wrong site is worse than a question.",
      },
      {
        question: "Does it produce a bill of quantities?",
        answer:
          "No. Orbit is not an estimating package and this site will not imply that it is. It records what actually happened and what it cost, which is the half that usually goes unrecorded.",
      },
      {
        question: "Can I track cash paid to labourers?",
        answer:
          "Tell Orbit what you paid and to whom and it holds it against the site as a cost. It is a record for you, not a payroll system — PAYE, UIF and employment compliance are your accountant's territory, not Orbit's.",
      },
      {
        question: "When can I actually use this?",
        answer:
          "Orbit is in development and has no public launch date yet. Join the waitlist and we WhatsApp you when it opens; founding pricing is locked for people on the list.",
      },
    ],
  },

  {
    slug: "handymen",
    name: "Handymen",
    singular: "a handyman",
    metaTitle: "Orbit for handymen — bill small jobs from WhatsApp",
    metaDescription:
      "Handymen: six small jobs a day is six invoices nobody writes. Text Orbit each one and it tracks the job and drafts the invoice. Join the waitlist.",
    h1: "Handymen: six small jobs a day, none of them worth an evening of admin.",
    lead:
      "A gate motor, a leaking tap, two curtain rails and a door that will not close. Individually none of them justifies opening a laptop. Collectively they are your entire month, and the admin is why you do the work at cost.",
    pains: [
      {
        title: "The invoice costs more effort than the job earns",
        body:
          "Nobody sits down at nine at night to write an invoice for R450. So the customer pays cash if they remember, or later if they do not, and there is no record either way.",
      },
      {
        title: "Repeat customers, no history",
        body:
          "You have been to the same complex eleven times. What you charged the first time is the price you should be charging now, and you cannot remember it, so you guess low.",
      },
      {
        title: "Everything is already on WhatsApp except the money",
        body:
          "The customer messages you, sends a photo, agrees a time and confirms it is fixed — all in WhatsApp. Then the money moves to a different universe of notebooks and bank apps.",
      },
    ],
    body: [
      "Orbit is being built to close that last gap. The job is booked on WhatsApp; the record of the job should be made on WhatsApp too. One line — what you did, where, and what you charged — and it exists. That is a two-second cost against a job you might otherwise never bill.",
      "For small jobs the invoice matters less than the record, and Orbit is designed for both. If the customer paid cash, say so and it closes. If they did not, ask Orbit to invoice it and check the draft before it goes. Either way, next month you can see what you actually earned rather than what passed through your account.",
      "The history is the quiet benefit. Every address you have been to, what you did there and what you charged, searchable in a thread. Handymen undercharge repeat customers more than any other trade, and the reason is almost always that nobody wrote the first price down.",
    ],
    keeps: [
      "Every small job recorded in one line, in seconds",
      "Cash jobs closed without an invoice, still on the record",
      "A price history per address and per customer",
      "Draft invoices for the ones that need paper",
    ],
    chat: {
      id: "handymen",
      alt: "A WhatsApp-style chat where a handyman texts Orbit “gate motor at 14 acacia, 850, paid cash” and Orbit records the job as settled.",
      caption: "ILLUSTRATIVE EXAMPLE",
      messages: [
        { side: "out", text: "gate motor at 14 acacia 850 paid cash", time: "11:47", status: "read" },
        {
          side: "in",
          text: "Logged and closed ✅",
          rows: [
            ["Job", "14 Acacia — gate motor"],
            ["Charged", "R850.00"],
            ["Paid", "Cash · today"],
          ],
          time: "11:47",
        },
        { side: "out", text: "what did i charge them last time", time: "11:48", status: "read" },
        { side: "in", text: "March, same address: R700 for a garage door sensor.", time: "11:48" },
      ],
    },
    faqs: [
      {
        question: "Is it worth it for jobs under R1,000?",
        answer:
          "Those are the jobs it exists for. The reason small work goes unbilled is that the admin costs more than the job earns; a one-line message does not.",
      },
      {
        question: "Can I record cash jobs without making an invoice?",
        answer:
          "Yes. Say \"paid cash\" and Orbit is being built to close the job without drafting anything. The record stays so your month adds up, and no document is produced you did not ask for.",
      },
      {
        question: "How do I find what I charged someone before?",
        answer:
          "Ask in the same thread — \"what did I charge 14 Acacia last time\". Orbit is being built to answer from your own history, not from an average of other people's prices.",
      },
      {
        question: "Do I need email?",
        answer:
          "Not for Orbit itself, which runs on WhatsApp. Email is optional on the waitlist form for the same reason — a WhatsApp number is enough for us to reach you.",
      },
    ],
  },

  {
    slug: "carpenters",
    name: "Carpenters",
    singular: "a carpenter",
    metaTitle: "Orbit for carpenters — jobs, timber and invoices",
    metaDescription:
      "Carpenters and joiners: text Orbit the job and the price. It tracks the build, keeps timber costs against it and drafts the invoice.",
    h1: "Carpenters: the workshop hours are the job. Bill them.",
    lead:
      "Half the work happens in a workshop where nobody is watching a clock, and the other half happens on site where everything takes longer than planned. Between the two, the hours that go onto the invoice are almost always fewer than the hours that were worked.",
    pains: [
      {
        title: "Workshop time is invisible",
        body:
          "Cutting, assembling and finishing happen days before the install. Because there is no client standing there, no note gets made, and the price ends up based on the install day alone.",
      },
      {
        title: "Timber and board are bought per job and priced per sheet",
        body:
          "One sheet of supawood is a cost; six sheets across two jobs is a costing exercise nobody does. The offcuts go to the next job and the accounting never catches up.",
      },
      {
        title: "Deposits fund the material and then get forgotten",
        body:
          "The deposit bought the timber. By the final invoice, nobody is certain whether it was deducted or not, and the conversation happens with a customer who is already spending money elsewhere.",
      },
    ],
    body: [
      "Orbit is being built so that a workshop day counts. Send a line when you spend a morning cutting — the job it was for and the hours — and the record exists before you have swept up. That is the material difference between a carpenter who prices from experience and one who prices from a total that never included the workshop.",
      "Material goes in the same way. Tell Orbit what you bought and which job it was for, and it stays there. Over a few jobs you get the number that actually matters: what a fitted unit costs you to make, as opposed to what you assumed when you quoted it.",
      "Invoices and deposits are drafted from the same record, so the deposit you took in March is on the document you send in May. You read it before it goes, always — Orbit drafts, you send.",
    ],
    keeps: [
      "Workshop hours recorded on the day they are worked",
      "Timber, board and hardware against the job that used them",
      "Deposits held against the job so the final invoice is right",
      "Draft invoices you check and send yourself",
    ],
    chat: {
      id: "carpenters",
      alt: "A WhatsApp-style chat where a carpenter texts Orbit “2 days workshop on the melville built-ins, 4 sheets supawood 1840” and Orbit records the hours and the material.",
      caption: "ILLUSTRATIVE EXAMPLE",
      messages: [
        { side: "out", text: "2 days workshop on the melville built-ins. 4 sheets supawood 1840", time: "16:55", status: "read" },
        {
          side: "in",
          text: "Both logged against Melville built-ins ✅",
          rows: [
            ["Labour", "2 days"],
            ["Material", "Supawood × 4 · R1,840.00"],
            ["Deposit held", "R5,000.00"],
          ],
          time: "16:55",
        },
      ],
    },
    faqs: [
      {
        question: "Can I record work done in the workshop, not on site?",
        answer:
          "Yes, and it is the reason a carpenter would use Orbit at all. Say the job and the time — \"2 days workshop on the Melville built-ins\" — and it attaches to that job like any other line.",
      },
      {
        question: "How are deposits handled?",
        answer:
          "Tell Orbit what was paid and when, and it holds it against the job so the final invoice shows the balance rather than the full amount. Deposit invoicing is planned for the first release; anything that slips will be marked as roadmap here.",
      },
      {
        question: "Can I attach a photo of the finished unit?",
        answer:
          "Sending photos into the thread is on the roadmap. At launch Orbit is being built around text, because text is what people actually send at the end of a working day.",
      },
      {
        question: "Does Orbit do cutting lists or drawings?",
        answer:
          "No. It handles the job, the cost and the invoice. Design and cutting stay in your workshop where they belong.",
      },
    ],
  },

  {
    slug: "roofers",
    name: "Roofers",
    singular: "a roofer",
    metaTitle: "Orbit for roofers — jobs across weather delays",
    metaDescription:
      "Roofers: text Orbit what you repaired and what you charged. It tracks the job across weather delays and drafts the invoice when it's done.",
    h1: "Roofers: the weather moves the job. The record should not move with it.",
    lead:
      "A roof job is started, stopped by rain, restarted a week later and finished on a Saturday. Four visits, one price, and a paper trail that exists mostly as a series of WhatsApp voice notes.",
    pains: [
      {
        title: "One job, many visits",
        body:
          "Because the work is spread across days that are chosen by the weather rather than by you, the job never has an obvious moment at which someone sits down and writes it up. So nobody does.",
      },
      {
        title: "Emergency leak repairs are billed last",
        body:
          "Storm work is urgent, unplanned and priced on the spot. It also arrives in clusters, five in a week, and by the following month you can no longer separate one from another.",
      },
      {
        title: "Materials arrive on site, not through your hands",
        body:
          "Sheeting and tiles are often delivered straight to the site. If the delivery note does not get attached to the job on the day, the cost surfaces weeks later on a statement with no job attached to it.",
      },
    ],
    body: [
      "Orbit is being built for work that happens in pieces. Each visit is one message — what you did that day, on which roof — and the job accumulates rather than waiting for a single write-up that never comes. When the last sheet goes on, the whole job is already written.",
      "Storm weeks are the clearest case. Five leak repairs in four days, each one recorded as it is finished, means five invoices that can be drafted on the Friday instead of five arguments in September. The record is made while the detail is still in your head, which is the only time it is accurate.",
      "Material deliveries can be logged the moment the truck arrives. Say what came and which roof it is for; the cost sits with the job instead of appearing on a supplier statement three weeks later attached to nothing.",
    ],
    keeps: [
      "A job that survives being started, stopped and restarted",
      "Each visit recorded on the day it happened",
      "Deliveries logged against the roof they were dropped at",
      "Draft invoices ready the moment the job closes",
    ],
    chat: {
      id: "roofers",
      alt: "A WhatsApp-style chat where a roofer texts Orbit “sealed the valley on the fourways job, 2nd visit, rain stopped us tuesday” and Orbit adds the visit to the existing job.",
      caption: "ILLUSTRATIVE EXAMPLE",
      messages: [
        { side: "out", text: "sealed the valley on the fourways job. 2nd visit, rain stopped us tuesday", time: "15:12", status: "read" },
        {
          side: "in",
          text: "Added to Fourways — roof repair ✅",
          rows: [
            ["Visit 2", "19 Aug · valley sealed"],
            ["Visit 1", "14 Aug · strip and inspect"],
            ["Agreed price", "R7,400.00"],
          ],
          time: "15:12",
        },
        { side: "out", text: "thats it, invoice it", time: "15:13", status: "read" },
        { side: "in", text: "Invoice #0077 drafted — R7,400.00. Tap to check and send.", time: "15:13" },
      ],
    },
    faqs: [
      {
        question: "Can one job run across several visits?",
        answer:
          "Yes — that is the shape roofing work has, so it is the shape Orbit is being built around. Each message adds to the same job rather than creating a new one, and the invoice is drafted from the whole thing when you say it is finished.",
      },
      {
        question: "How do I handle emergency call-outs during a storm?",
        answer:
          "The same way as anything else: one line per job, sent when you come down. The value is that five repairs in a week stay five separate, correctly priced jobs instead of one blurred memory.",
      },
      {
        question: "Can I log a delivery that went straight to site?",
        answer:
          "Tell Orbit what arrived and which job it was for and it holds the cost against that job. Reading supplier delivery notes automatically is a Vyso platform capability on the roadmap for Orbit, not part of the first release.",
      },
      {
        question: "Does Orbit remind me to go back and finish a job?",
        answer:
          "Nudges for jobs that have been open a while are planned. Nothing on this page is a description of a shipped feature — Orbit is in development and the waitlist is how you hear when that changes.",
      },
    ],
  },

  {
    slug: "solar-installers",
    name: "Solar installers",
    singular: "a solar installer",
    metaTitle: "Orbit for solar installers — jobs and invoices",
    metaDescription:
      "Solar installers: text Orbit the install and the amount. It tracks each site, keeps component costs straight and drafts the invoice.",
    h1: "Solar installers: the install is one day. The paperwork is three.",
    lead:
      "Panels, an inverter, a battery, a mounting kit, a day and a half on a roof and a client who has been quoted by four other companies. The margin is real but it is thin, and it is decided by whether the components on the invoice match the components that were actually fitted.",
    pains: [
      {
        title: "Component lists change between quote and install",
        body:
          "The inverter that was quoted is out of stock, so a different one goes in. If the substitution is not recorded on the day, the invoice goes out with the quoted item and the cost difference disappears into your margin.",
      },
      {
        title: "Site visits before the install are unbilled work",
        body:
          "The roof survey, the DB inspection, the second trip because the client changed their mind about the battery. All real hours, none of them on an invoice.",
      },
      {
        title: "Staged installs, staged payments",
        body:
          "Panels this month, battery when the client can afford it. Two jobs that are really one, and a payment history nobody is tracking in one place.",
      },
    ],
    body: [
      "Orbit is being built so that what actually got fitted is written down while the ladder is still against the wall. One message names the site and the components, and the record is made. The substitution that would otherwise cost you two thousand rand of margin is captured on the day it happens, by the person who made it.",
      "Site visits go in the same way. A survey is a line; a second trip is a line. Whether you choose to bill them is your commercial decision, but you cannot make that decision about work you did not record.",
      "Staged installs stay as one job with a running balance, so when the client comes back for the battery in November the history is there — what was fitted, what was charged, what was paid. Orbit drafts the invoice; you check it and send it. It never sends to a client on its own.",
    ],
    keeps: [
      "What was actually fitted, recorded on the day of the install",
      "Surveys and return visits captured as real work",
      "Component costs against the site they went to",
      "A running balance across staged installs",
    ],
    chat: {
      id: "solar-installers",
      alt: "A WhatsApp-style chat where a solar installer texts Orbit “fourways install done, 8 panels, swapped to the 5kw deye, 62000” and Orbit records the substitution and the amount.",
      caption: "ILLUSTRATIVE EXAMPLE",
      messages: [
        { side: "out", text: "fourways install done. 8 panels, swapped to the 5kw inverter, 62000", time: "18:04", status: "read" },
        {
          side: "in",
          text: "Tracking that now ✅",
          rows: [
            ["Site", "Fourways — solar install"],
            ["Fitted", "8 panels · 5kW inverter"],
            ["Note", "Inverter differs from quote"],
            ["Charged", "R62,000.00"],
          ],
          time: "18:04",
        },
      ],
    },
    faqs: [
      {
        question: "Can Orbit track which components went to which site?",
        answer:
          "Say them in the message and Orbit is being built to hold them against that site, including substitutions. That record is the difference between an invoice that matches the install and one that matches the quote.",
      },
      {
        question: "Does it handle CoCs or utility paperwork?",
        answer:
          "No. Registration, compliance certificates and municipal approvals are yours and your electrician's. Orbit is being built for the job, the cost and the invoice.",
      },
      {
        question: "Can I keep one job open for a staged install?",
        answer:
          "Yes. Panels now and a battery later stay on one job with a running balance, so the second visit is priced against a history rather than a memory.",
      },
      {
        question: "Is R99 a month realistic for a business this size?",
        answer:
          "R99 per tradesperson per month is the intended price, and it is the same price for every trade. VAT-inclusive pricing is confirmed at launch. Founding pricing is locked for people on the waitlist.",
      },
    ],
  },

  {
    slug: "landscapers",
    name: "Landscapers",
    singular: "a landscaper",
    metaTitle: "Orbit for landscapers — jobs, plants and invoices",
    metaDescription:
      "Landscapers and garden services: text Orbit the job and the amount. It tracks once-off work and monthly rounds and drafts the invoices.",
    h1: "Landscapers: monthly rounds and once-off builds, in one thread.",
    lead:
      "Half the work is a recurring garden service that gets invoiced every month, and half is a once-off build with plants, soil, paving and a team. The two need different paperwork and both get done from the back of a bakkie.",
    pains: [
      {
        title: "Monthly rounds are billed from memory",
        body:
          "Twenty-two gardens, most of them the same amount every month, some of them skipped for a week, one of them cancelled in March and still on the list. The invoice run happens on a Sunday and is mostly reconstruction.",
      },
      {
        title: "Plants and materials are bought by the load",
        body:
          "A nursery run supplies four gardens. Split correctly it tells you which contracts are worth keeping; split never, it tells you nothing.",
      },
      {
        title: "Once-off builds hide inside the round",
        body:
          "A retaining wall done for an existing monthly client blurs into the monthly fee unless somebody records it as its own job on the day.",
      },
    ],
    body: [
      "Orbit is being built for both halves. A once-off build is one message with an address and an amount, the same as any other trade. A monthly round is a list Orbit is being built to hold, so the invoice run stops being a Sunday evening of reconstruction and starts being a set of drafts you check and send.",
      "The nursery run is where a landscaper's margin actually lives. Tell Orbit what you bought and roughly which gardens it went to, and the cost sits with the work rather than in a pile of slips. After a season, the contracts that are quietly costing you money become visible, which is the only way anyone ever puts a price up.",
      "Once-off work stays separate from the monthly fee because you told Orbit it was separate, on the day, in one line. Orbit drafts the invoices; you read and send them. Nothing goes to a client without you.",
    ],
    keeps: [
      "Once-off jobs and monthly rounds kept apart",
      "Plants, soil and materials against the gardens they went to",
      "Monthly invoice drafts instead of a Sunday reconstruction",
      "A record of who has paid and who has not",
    ],
    chat: {
      id: "landscapers",
      alt: "A WhatsApp-style chat where a landscaper texts Orbit “built the retaining wall at 9 protea, 14500, thats separate from their monthly” and Orbit records it as a once-off job.",
      caption: "ILLUSTRATIVE EXAMPLE",
      messages: [
        { side: "out", text: "built the retaining wall at 9 protea 14500. thats separate from their monthly", time: "16:33", status: "read" },
        {
          side: "in",
          text: "Recorded as a once-off ✅",
          rows: [
            ["Job", "9 Protea — retaining wall"],
            ["Charged", "R14,500.00"],
            ["Monthly service", "Unchanged · R1,850.00"],
          ],
          time: "16:33",
        },
      ],
    },
    faqs: [
      {
        question: "Can Orbit handle a monthly garden service round?",
        answer:
          "Recurring monthly invoicing is planned for the first release and is the reason the waitlist form asks how you work. Until it ships, this page will keep calling it planned rather than describing it as if it exists.",
      },
      {
        question: "How do I keep a once-off build separate from the monthly fee?",
        answer:
          "Say so in the message — \"that's separate from their monthly\". Orbit is being built to read that as a distinct job so the client gets two clear lines rather than one confusing invoice.",
      },
      {
        question: "Can I track plants and materials per garden?",
        answer:
          "Tell Orbit what you bought and which gardens it went to and the cost stays with them. Over a season that is what shows you which contracts are priced too low.",
      },
      {
        question: "Does it work for a team rather than one person?",
        answer:
          "Multiple people on one account is on the roadmap. Orbit is priced per tradesperson at R99 a month, so a team is priced per person — and the first release is being shaped around single-operator and small-team answers from the waitlist.",
      },
    ],
  },
];

export const TRADE_SLUGS = TRADES.map((t) => t.slug);

export function getTrade(slug: string): Trade | undefined {
  return TRADES.find((t) => t.slug === slug);
}

export default TRADES;

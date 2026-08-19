/* ── Orbit FAQ ───────────────────────────────────────────────────────────────
   Twenty-two questions, grouped, each answered in the first sentence.

   That last rule is the whole file. An answer engine quoting this page will
   take the first sentence and nothing else, so the first sentence has to be a
   complete answer — "No, you do not need an app." — with the qualification
   after it rather than before it. It is also the right way to write for a
   person on a phone, which is a happy coincidence rather than the reason.

   Everything here is either true today or explicitly labelled roadmap. Orbit
   is not built; the honest form of "does it do X" is "it is being built to do
   X" or "X is on the roadmap", and both appear below. Nothing says "Orbit
   does".

   The same array feeds `/orbit/faq`, its `FAQPage` JSON-LD, the teaser on
   `/orbit`, and the Orbit section of `/llms-full.txt`. One source, so a
   question cannot be answered differently in two places.                      */

export type OrbitFaqItem = { id: string; question: string; answer: string };
export type OrbitFaqGroup = {
  id: string;
  eyebrow: string;
  title: string;
  questions: OrbitFaqItem[];
};

export const ORBIT_FAQ_GROUPS: OrbitFaqGroup[] = [
  {
    id: "what-it-is",
    eyebrow: "The basics",
    title: "What Orbit is",
    questions: [
      {
        id: "what-is-orbit",
        question: "What is Orbit?",
        answer:
          "Orbit is WhatsApp operations software for South African tradespeople: you text it what you did and what you charged, and it tracks the job, drafts the invoice and keeps a record of what you are owed. It runs on the Vyso operations platform that already serves South African food businesses. Orbit itself is in development — you can join the waitlist today.",
      },
      {
        id: "who-is-it-for",
        question: "Which trades is Orbit for?",
        answer:
          "Orbit is being built for one- and two-person trade businesses — plumbers, electricians, tilers, painters, builders, handymen, carpenters, roofers, solar installers and landscapers. The common shape is a person who finishes a job away from a desk and needs the record and the invoice to happen without one.",
      },
      {
        id: "do-i-need-an-app",
        question: "Do I need to install an app?",
        answer:
          "No. Orbit is a WhatsApp conversation — the same app you already use to talk to customers. There is nothing to download, no account screen to learn and no separate login to forget.",
      },
      {
        id: "android-or-iphone",
        question: "Does it work on Android and iPhone?",
        answer:
          "Yes, on both, because Orbit is not an app — it is a WhatsApp chat, so anything that runs WhatsApp runs Orbit. That includes an older Android phone, which is deliberate: the tool has to work on the phone tradespeople actually carry to site.",
      },
      {
        id: "relation-to-vyso",
        question: "How is Orbit related to Vyso and Finch?",
        answer:
          "Orbit is a Vyso product, and it runs on the same operations platform as Finch. Vyso built document capture, order and price tracking and invoicing for South African food businesses; Orbit is a WhatsApp front door onto that backend, aimed at trades instead of kitchens.",
      },
    ],
  },
  {
    id: "using-it",
    eyebrow: "Day to day",
    title: "Using Orbit",
    questions: [
      {
        id: "how-do-i-record-a-job",
        question: "How do I record a job?",
        answer:
          "You send one message saying what you did, where, and what you charged — for example \"fixed tiling at job on 1st avenue. charged 3800.\" Orbit is being built to read that as a job with an address and an amount, reply to confirm, and hold it against the customer.",
      },
      {
        id: "what-does-it-understand",
        question: "What can Orbit understand from a message?",
        answer:
          "Orbit is being built to read the work you describe, the place, the amount, the customer, materials you bought, and whether something has been paid. It is designed for the way people actually type on a phone — lower case, abbreviated, no punctuation — rather than for a form.",
      },
      {
        id: "what-if-i-make-a-mistake",
        question: "What if I make a mistake?",
        answer:
          "You correct it in the same conversation — \"no that was 3500 not 3800\" — and Orbit is being built to update the job and any draft that came from it. Nothing is final until you send it, which is why corrections are cheap.",
      },
      {
        id: "does-orbit-send-invoices",
        question: "Does Orbit send invoices to my customers?",
        answer:
          "No. Orbit drafts, you send. That rule holds across every Vyso product: the software prepares the document and a person decides whether it goes out, so nothing reaches a customer that you have not read.",
      },
      {
        id: "quotes",
        question: "Can I send quotes with it?",
        answer:
          "Quoting is on the roadmap, not in the first release. Orbit starts with the work you have already done and not yet billed, because that is where the money leaks fastest in a small trade business.",
      },
      {
        id: "who-owes-me",
        question: "Can Orbit tell me who still owes me money?",
        answer:
          "Yes — asking \"who still owes me\" is one of the flows Orbit is being built around, and it answers from the jobs and invoices you have recorded. It is your own record, not an estimate or an industry average.",
      },
      {
        id: "photos",
        question: "Can I send photos of slips or jobs?",
        answer:
          "Reading photos and slips is on the roadmap. At launch Orbit is being built around text, because a typed line at the end of a job is what tradespeople actually send.",
      },
      {
        id: "multiple-staff",
        question: "Can more than one person use it?",
        answer:
          "Multiple people on one account is on the roadmap. Orbit is priced per tradesperson, so a two-person operation is two subscriptions, and the waitlist form asks how you work so early releases are shaped around real answers.",
      },
    ],
  },
  {
    id: "money",
    eyebrow: "Money",
    title: "Invoicing, VAT and price",
    questions: [
      {
        id: "what-does-it-cost",
        question: "What does Orbit cost?",
        answer:
          "R99 per tradesperson per month. VAT-inclusive pricing is confirmed at launch, and founding pricing is locked for people who join the waitlist before Orbit opens.",
      },
      {
        id: "vat",
        question: "Does Orbit handle VAT?",
        answer:
          "Orbit is being built to put VAT on an invoice when you are a VAT vendor and have given it your VAT number. It is not a tax adviser and does not file anything with SARS — your accountant keeps that job.",
      },
      {
        id: "valid-invoice",
        question: "Will the invoices be valid South African tax invoices?",
        answer:
          "That is the design intent: a South African tax invoice needs the words \"tax invoice\", both parties' details, a serial number, the date, a description, the amount and the VAT, and Orbit is being built to carry those fields. Because Orbit is in development, treat that as the specification rather than a claim about a shipped product.",
      },
      {
        id: "payments",
        question: "Can customers pay through Orbit?",
        answer:
          "Not in the first release. Orbit records what has been paid when you tell it, so you get a real debtors list, but taking a card or an EFT inside the chat is on the roadmap.",
      },
      {
        id: "accounting",
        question: "Does it replace my accountant?",
        answer:
          "No. Orbit is being built to give your accountant a clean, dated record of jobs, costs and invoices instead of a shoebox — which usually makes them cheaper, not unnecessary.",
      },
      {
        id: "contract",
        question: "Is there a contract?",
        answer:
          "There is nothing to sign today, because Orbit is not open yet. The waitlist costs nothing and commits you to nothing.",
      },
    ],
  },
  {
    id: "trust",
    eyebrow: "Data and trust",
    title: "Your data, and where it lives",
    questions: [
      {
        id: "who-owns-my-data",
        question: "Who owns the data?",
        answer:
          "You do. Your jobs, customers and invoices are yours, and Orbit is being built so you can export them; Vyso does not sell customer data and does not use one business's records to advise another.",
      },
      {
        id: "where-does-it-live",
        question: "Where does my information live?",
        answer:
          "In the Vyso operations platform — the same backend that runs Doc-U, OrderFlow, Price Watch and Finch for existing South African customers. WhatsApp is the way you talk to it, not where the records are kept.",
      },
      {
        id: "popia",
        question: "What about POPIA?",
        answer:
          "Vyso operates under South African law and publishes its privacy position at vyso.co.za/privacy and vyso.co.za/popia. Orbit will be covered by the same policies; those pages are the authority, not this one.",
      },
      {
        id: "south-africa-only",
        question: "Is Orbit only for South Africa?",
        answer:
          "Yes, at first. It is priced in rands, written for South African invoicing and built around how WhatsApp is used here, and there is no plan to launch elsewhere before it works properly at home.",
      },
      {
        id: "languages",
        question: "Which languages does it work in?",
        answer:
          "English at launch. Afrikaans and isiZulu are on the roadmap and are not in the first release — this page will change the moment that is no longer true.",
      },
      {
        id: "when-does-it-launch",
        question: "When does Orbit launch?",
        answer:
          "There is no public launch date yet. Orbit is in development; joining the waitlist is how you find out, and we WhatsApp the list before anyone else.",
      },
    ],
  },
];

export const ALL_ORBIT_FAQS: OrbitFaqItem[] = ORBIT_FAQ_GROUPS.flatMap((g) => g.questions);

/** The four questions the homepage teaser shows. Ids, not copies. */
export const ORBIT_FAQ_TEASER_IDS = [
  "what-is-orbit",
  "do-i-need-an-app",
  "what-does-it-cost",
  "when-does-it-launch",
] as const;

export function getOrbitFaq(id: string): OrbitFaqItem {
  const found = ALL_ORBIT_FAQS.find((q) => q.id === id);
  if (!found) throw new Error(`lib/orbit/faq.ts: no question with id "${id}".`);
  return found;
}

export const ORBIT_FAQ_TEASER = ORBIT_FAQ_TEASER_IDS.map(getOrbitFaq);

export default ORBIT_FAQ_GROUPS;

import type { MarketingModule } from "../module-types";

export const serviceden: MarketingModule = {
  slug: "serviceden",
  name: "ServiceDen",
  role: "Leads, services, invoicing & Gmail-linked replies",
  tagline: "A connected front office for service businesses.",
  description:
    "ServiceDen runs a service business end to end: a Gmail-detected lead pipeline with AI-drafted replies you approve before they send, a customer and service catalogue, and branded PDF invoicing. It is currently run internally at Vyso and rolled out with selected service businesses ahead of a wider release.",
  capabilities: [
    "A lead pipeline built from likely sales conversations detected in a connected Gmail inbox",
    "Company research read off a prospect's own website, with each claim tagged fact or hypothesis",
    "Email templates that carry your tone and real emails you have already sent",
    "AI-drafted replies that never send without an explicit human approval",
    "A service price book that becomes invoice line items",
    "Branded PDF invoices carrying your logo, business details and banking block",
  ],
  screenshots: [],
  featureSections: [
    {
      id: "leads",
      title: "A pipeline built from the inbox you already have",
      copy:
        "Service businesses lose deals in their own inbox, not in a CRM. ServiceDen connects to Gmail with read-only access, surfaces the threads that look like sales conversations, and puts them in a pipeline with a stage, a next action and a follow-up date — with every detection offered to you for approval rather than filed automatically.",
      bullets: [
        "Stages run New, Contacted, Replied, Discovery, Pilot proposed, Founding customer, Nurture, Won and Lost",
        "Detected threads are accepted or dismissed by you; the connection card states outright that ServiceDen never sends email automatically",
        "Views split into Inbox, Pipeline, Follow-ups and All leads, each with the count that matters",
        "A lead drawer holds the full Gmail conversation, the readout, the suggested next action and the follow-up date",
      ],
      screenshot: null,
      placeholderTags: ["Inbox", "Pipeline", "Follow-ups", "Stages", "Gmail sync"],
    },
    {
      id: "research",
      title: "Research that separates fact from hypothesis",
      copy:
        "Personalised outreach usually means confidently invented detail. ServiceDen reads the company's own website and returns what it found — industry, location, products and services, customers — with each operational claim tagged as either a fact or a hypothesis, and an Exclude toggle on every one before it can inform an email.",
      bullets: [
        "Each claim carries a Fact or Hypothesis tag and an Include or Exclude control",
        "Where more than one site could be the company, it asks you to pick rather than assuming",
        "Research older than 30 days is flagged as stale with a prompt to refresh before relying on it",
        "Confidence is stated as high, medium or low rather than left implicit",
      ],
      screenshot: null,
      placeholderTags: ["Industry", "Location", "Services", "Fact / hypothesis", "Sources"],
    },
    {
      id: "templates",
      title: "Playbooks written from emails you actually sent",
      copy:
        "Generic AI email copy is obvious to everyone who receives it. Templates fix the input rather than the output: each one is a playbook for one pipeline stage — what the email is for, the tone to use, the call to action you prefer, and a few real emails you have already sent that a draft should sound like.",
      bullets: [
        "A template maps to one or more pipeline stages, with purpose, tone notes and a preferred call to action",
        "Examples are real subject lines and bodies, each flagged for whether it should be used when drafting",
        "Templates can be private to you or shared with the organisation, and deactivated without deleting them",
        "After a send you are offered the chance to save that email as a new writing example",
      ],
      screenshot: null,
      placeholderTags: ["Purpose", "Tone", "Examples", "Stage mapping", "Shared / private"],
    },
    {
      id: "drafting",
      title: "Drafted by AI, sent only by you",
      copy:
        "The draft composer writes from three grounded sources: the actual Gmail thread, the fact-tagged company research, and your own past emails for that stage. Approval is a separate, deliberate step — and if you edit a draft after approving it, the approval is withdrawn and has to be given again.",
      bullets: [
        "Badges show the pipeline stage, whether it is a reply or a new email, how many examples were used and how many research sources were cited",
        "Warnings are explicit: no email address, no research context available, or research that changed after the draft was written",
        "Editing after approval revokes the approval — you approve and send again, deliberately",
        "A follow-up interval in business days is set on the draft, so the next touch is scheduled as you send",
      ],
      screenshot: null,
      placeholderTags: ["Draft", "Regenerate", "Approve", "Send", "Follow-up"],
    },
    {
      id: "invoicing",
      title: "Price book in, branded invoice out",
      copy:
        "The billing half is deliberately ordinary and complete. Services carry their billing basis and price, invoices are built by picking those services as line items with anything custom added by hand, and the finished document carries your logo, business details and banking block as a print-ready PDF.",
      bullets: [
        "Billing bases cover per hour, per day, per month, per project, per unit and fixed fee, with active and inactive services",
        "Invoices auto-number, carry issue and due dates, and move through Draft, Sent and Paid",
        "The invoice sheet renders your logo, seller block, bill-to block, line items, subtotal, editable VAT and total, plus a banking block when set",
        "Emailing an invoice is marked “Send via email · soon” in the app — today you export the PDF",
      ],
      screenshot: null,
      placeholderTags: ["Services", "Invoices", "PDF export", "Banking details", "Logo"],
    },
  ],
  workflow: [
    {
      title: "Connect the inbox, keep the control",
      copy:
        "Read-only Gmail access surfaces likely sales conversations. You accept or dismiss each one — nothing enters the pipeline behind your back.",
    },
    {
      title: "Research before you write",
      copy:
        "Pull the company's own website into the lead, exclude anything you would not stake a sentence on, and let the draft work from what is left.",
    },
    {
      title: "Draft against your own past emails",
      copy:
        "The stage's template supplies the purpose, tone and real examples, so the draft sounds like your business rather than a language model.",
    },
    {
      title: "Approve, then send",
      copy:
        "Read it, edit it, approve it, send it. Any edit after approval withdraws the approval — sending is always a decision, never a default.",
    },
    {
      title: "Bill from the same record",
      copy:
        "Convert a won lead into a customer, build the invoice from your service price book, and export a branded PDF.",
    },
  ],
  worksWith: [
    {
      slug: "orderflow",
      reason:
        "ServiceDen is a standalone front office rather than a data feed into the rest of the platform, but it borrows OrderFlow's invoicing conventions — same currency handling, same document discipline — so the billing surface behaves the way the rest of Vyso does.",
    },
  ],
  industryFit: [
    {
      href: "/industries/catering-companies",
      name: "Catering companies",
      reason:
        "Enquiry-led work where the deal happens over email and the invoice follows a quoted service rather than a stock item.",
    },
    {
      href: "/industries/hospitality",
      name: "Hospitality",
      reason:
        "Service and event bookings that need a pipeline, a follow-up discipline and a branded invoice at the end.",
    },
  ],
  faqs: [
    {
      question: "Is ServiceDen generally available?",
      answer:
        "Not yet. It is currently run internally at Vyso and rolled out with selected service businesses. Everything described here is built and working — it is access that is limited, not the functionality.",
    },
    {
      question: "Will the AI send emails on our behalf without us checking them?",
      answer:
        "No. The Gmail card states it outright: ServiceDen never sends email automatically. Approval is a separate action from drafting, and editing a draft after approving it withdraws the approval so you have to approve again before it can send.",
    },
    {
      question: "How do you stop AI drafts being confident nonsense?",
      answer:
        "By constraining the inputs. A draft is grounded in the actual email thread, in company research where every claim is tagged fact or hypothesis and can be excluded, and in real emails you have already sent for that pipeline stage.",
    },
    {
      question: "Can we get a PDF invoice with our own branding and banking details?",
      answer:
        "Yes. Upload a logo and set your business, VAT and banking details once, and they render on every invoice. The banking block only appears if you have set one, so a blank pay-to section can't slip onto a client document.",
    },
    {
      question: "Can invoices be emailed from ServiceDen?",
      answer:
        "Not yet — the button is in the app labelled “Send via email · soon” and does exactly nothing until the connector lands. Today you export the PDF and send it yourself.",
    },
  ],
  relatedSolutionHrefs: ["/solutions/reduce-money-leakage"],
  relatedIndustryHrefs: ["/industries/hospitality"],
  appUrlLabel: "app.vyso.co.za/serviceden",
  group: "people",
  status: "LIMITED ROLLOUT",
  agents: [],
  howFinchUsesIt:
    "ServiceDen doesn't feed Finch's agents yet. It runs as its own front office — internally at Vyso and with a handful of service businesses — and, being a standalone lead-and-invoicing flow rather than a data feed into the rest of the platform, isn't part of the audit-roadmap agent set described elsewhere on this site.",
};

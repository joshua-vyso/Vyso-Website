import type { MarketingModule } from "../module-types";

export const shiftboard: MarketingModule = {
  slug: "shiftboard",
  name: "ShiftBoard",
  role: "Labour & scheduling",
  tagline: "Labour deployment, visible alongside the rest of the operation.",
  description:
    "ShiftBoard plans the week's shifts with the labour cost showing as you build it, replaces WhatsApp shift-swapping with a proper propose-accept-approve flow, and puts labour cost next to the sales it produced.",
  capabilities: [
    "A weekly roster grid with per-shift, per-day and per-week labour cost calculated from real hourly rates",
    "Call-outs that become an open shift with a ranked shortlist of who can actually work it",
    "Shift swaps that only rewrite the roster once a manager approves them",
    "Clock-ins, hours, overtime and timesheet approvals in one attendance ledger",
    "Leave requests that show the coverage consequence before you approve them",
    "Labour cost as a percentage of the same day's invoiced sales",
  ],
  screenshots: [
    {
      src: "/screenshots/modules/shiftboard-live.png",
      alt: "ShiftBoard live operations view showing who is working now, department coverage and the active staff feed.",
      label: "app.vyso.co.za/shiftboard/live",
    },
    {
      src: "/screenshots/modules/shiftboard-roster.png",
      alt: "ShiftBoard weekly roster grid with labour cost per day and open shifts.",
      label: "app.vyso.co.za/shiftboard/roster",
    },
  ],
  featureSections: [
    {
      id: "roster",
      title: "Build the week with the cost showing",
      copy:
        "Most rosters tell you the cost after payroll runs. Here the labour cost sits in the grid's footer row as you plan — per day and for the week — and the shift editor shows length, rate and shift cost before you save it. Conflicts like overtime risk, a short department, a leave clash or a double booking surface while you can still fix them.",
      bullets: [
        "The weekly grid runs Staff across the days plus an Hours column, with a Labour cost footer per day and for the week",
        "The shift editor sets status Working, Off or Leave with start and end times, department, and an overtime notice where it applies",
        "“Release shift & open cover” or “Mark call-out” turns a gap into an open shift instead of a phone call",
        "An AI-drafted roster is on the roadmap and labelled coming soon in the app — the planning today is yours",
      ],
      screenshot: {
        src: "/screenshots/modules/shiftboard-roster.png",
        alt: "ShiftBoard roster grid showing the weekly schedule with hours, labour cost per day and open shifts.",
        label: "app.vyso.co.za/shiftboard/roster",
      },
    },
    {
      id: "cover",
      title: "Call-outs and swaps that leave a trail",
      copy:
        "The usual failure is a verbal arrangement that nobody wrote down and the roster never reflected. ShiftBoard makes it a workflow: an open shift produces a ranked shortlist of eligible staff with the reason anyone was excluded, and a swap goes propose → accept → manager approval, with only that final approval rewriting the roster.",
      bullets: [
        "The cover drawer splits candidates into eligible and not available, and shows why each blocked person was excluded rather than silently dropping them",
        "Candidate rows show the shift cost of using that person plus match chips for skill, availability and overtime",
        "The swap centre tracks open and settled requests, with record-a-taker, approve-and-update-roster, decline and cancel",
        "A verbal arrangement can never silently change who is on shift — only the approval writes to the roster",
      ],
      screenshot: null,
    },
    {
      id: "attendance",
      title: "Clock-ins, hours and timesheets in one ledger",
      copy:
        "Attendance is the day's actual against the day's plan — who was scheduled, who clocked in, when, and what that means for hours and overtime. Managers correct it in place rather than in a side conversation, and approve timesheets from the same row.",
      bullets: [
        "Columns run Employee, Department, Scheduled, Clock in, Clock out, Hours, Overtime and Status",
        "KPIs cover Clocked in, Late today, Absent today, Overtime hours this week and Pending timesheets",
        "Row actions mark someone absent or approve their timesheet directly on the record",
        "The ledger stays the source for hours worked rather than a separate payroll spreadsheet",
      ],
      screenshot: {
        src: "/screenshots/modules/shiftboard-attendance.png",
        alt: "ShiftBoard attendance table showing scheduled times, clock in and out, hours, overtime and status per employee.",
        label: "app.vyso.co.za/shiftboard/attendance",
      },
    },
    {
      id: "people",
      title: "Who can actually do the job",
      copy:
        "Cover decisions are only as good as what the system knows about your people. Each profile carries a skills matrix, availability, contracted versus actual hours, attendance score, leave balance and hourly rate — which is what makes a cover shortlist meaningful rather than alphabetical.",
      bullets: [
        "The directory lists Name, Department, Status, Next shift, Hours / wk, Attendance and Device",
        "The skills matrix scores Receiving, Dispatch, Prep Kitchen, Driving, Customer Service, Stock Handling and Device Operation",
        "Availability records available and unavailable days plus preferences, feeding straight into cover eligibility",
        "Assigned WasteWatch devices are listed per person, tying an operator to the station they use",
      ],
      screenshot: {
        src: "/screenshots/modules/shiftboard-people.png",
        alt: "ShiftBoard people directory showing department, status, next shift, weekly hours, attendance and device per employee.",
        label: "app.vyso.co.za/shiftboard/people",
      },
    },
    {
      id: "insights",
      title: "Labour cost against the sales it produced",
      copy:
        "Hours are an input; labour percentage is the number that tells you whether the week worked. Insights puts each day's rostered cost against that same day's invoiced sales from OrderFlow and colour-codes the result — and where there were no sales to compare against, it says so instead of inventing a percentage.",
      bullets: [
        "KPIs cover Labour cost this week, Rostered hours, Labour % of sales, Dearest day and Overtime hours",
        "Labour % is the day's rostered cost divided by that day's invoiced sales: green under 25%, amber to 32%, red above",
        "A cost-per-person table breaks the week down by employee, department, shifts, hours and cost",
        "Money tiles are admin-gated, so managers can work the coverage view without seeing individual pay",
      ],
      screenshot: {
        src: "/screenshots/modules/shiftboard-insights.png",
        alt: "ShiftBoard insights showing labour cost this week, labour percentage of sales and labour cost per day.",
        label: "app.vyso.co.za/shiftboard/insights",
      },
    },
    {
      id: "overview",
      title: "Today, in one screen",
      copy:
        "The overview answers who is on, what is uncovered and what it is costing — with the week's grid underneath and an alert list that deep-links into the module that can resolve each issue. Live Ops takes the same picture down to the minute for a second screen during service.",
      bullets: [
        "KPIs cover Staff on shift today, Currently working, Open shifts, Labour cost today, Overtime risk and Attendance issues",
        "Today's staffing snapshot shows working against required per department with a coverage badge",
        "Operational alerts cover call-outs, swaps awaiting approval, understaffed departments and overtime warnings",
        "Live Ops adds a department map and an active staff feed with each person's current task, shift and device",
      ],
      screenshot: {
        src: "/screenshots/modules/shiftboard-overview.png",
        alt: "ShiftBoard overview showing staff on shift, open shifts, labour cost today and the weekly roster table.",
        label: "app.vyso.co.za/shiftboard",
      },
    },
  ],
  workflow: [
    {
      title: "Plan the week on the grid",
      copy:
        "Fill the cells department by department. The footer row prices the week as you go, and conflicts surface while there is still time to move someone.",
    },
    {
      title: "Handle the call-out properly",
      copy:
        "Release the shift and it becomes an open offer with a ranked shortlist — including who cannot take it and why — instead of a group message.",
    },
    {
      title: "Approve swaps and leave with the consequence visible",
      copy:
        "A swap only changes the roster at approval. A high-risk leave request warns you which department it leaves short before you confirm it.",
    },
    {
      title: "Run the day from Live Ops",
      copy:
        "Who's working, where, on what, and what still needs covering — a second-screen view during service rather than a report afterwards.",
    },
    {
      title: "Close the week on labour percentage",
      copy:
        "Compare each day's rostered cost against that day's invoiced sales. Where the percentage went red is where next week's roster changes.",
    },
  ],
  worksWith: [
    {
      slug: "orderflow",
      reason:
        "Labour percentage is the day's rostered cost against that same day's invoiced OrderFlow sales — the same revenue basis the pricing module uses.",
    },
    {
      slug: "wastewatch",
      reason:
        "Employees carry their assigned WasteWatch scales and stations, which is the foundation for capturing waste per operator.",
    },
    {
      slug: "insightgen",
      reason:
        "InsightGen computes labour cost and labour percentage from ShiftBoard rosters and attendance, and raises an anomaly when labour runs high against same-day sales.",
    },
    {
      slug: "planwise",
      reason:
        "Budget categories mentioning labour or staff are attributed to ShiftBoard in PlanWise's cost-driver breakdown.",
    },
  ],
  industryFit: [
    {
      href: "/industries/restaurants",
      name: "Restaurants",
      reason:
        "Service-driven rosters where labour percentage moves daily and a call-out an hour before service is routine.",
    },
    {
      href: "/industries/hospitality",
      name: "Hospitality",
      reason:
        "Multiple departments with different coverage requirements and staff who work across several of them.",
    },
    {
      href: "/industries/wholesale",
      name: "Wholesale",
      reason:
        "Receiving, dispatch and drivers rostered against order volume, with overtime that needs watching before it happens.",
    },
  ],
  faqs: [
    {
      question: "Does it calculate real labour cost, or just hours?",
      answer:
        "Real cost. Every shift is priced at the employee's hourly rate and rolled up per day, per week and per person — visible in the roster footer as you plan and in the cost-per-person table afterwards.",
    },
    {
      question: "Can we see labour cost as a percentage of sales?",
      answer:
        "Yes, once OrderFlow has invoiced orders for the same day. Where there are no sales to compare against, the screen says so rather than showing a fabricated percentage.",
    },
    {
      question: "How does shift swapping work — do staff just message each other?",
      answer:
        "It is a structured propose → accept → manager-approval flow, and only the approval step rewrites the roster. A verbal arrangement can never silently change who is on shift.",
    },
    {
      question: "Does approving leave tell us if we'll be short-staffed?",
      answer:
        "Yes. Each request carries a coverage-impact note and risk level, and approving a high-risk request triggers a coverage warning naming the department it will leave short before it goes through.",
    },
    {
      question: "Is there AI auto-scheduling?",
      answer:
        "Not yet. “Generate best roster” is visible in the app and explicitly marked coming soon — it is on the roadmap, not in your hands today. Everything else in the module is working.",
    },
  ],
  relatedSolutionHrefs: ["/solutions/operations-dashboard"],
  relatedIndustryHrefs: ["/industries/restaurants", "/industries/hospitality"],
  appUrlLabel: "app.vyso.co.za/shiftboard",
};

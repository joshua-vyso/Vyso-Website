"use client";

/* ── The operational-brief demonstration ─────────────────────────────────────
   The homepage's proof section: one document's journey through a Vyso
   automation, ending in the daily brief a human approves. Rebuilt for the
   public site from the platform's own brief implementation (`app/app/page.tsx`
   + `components/platform/brief/FindingCard.tsx`) rather than screenshots, and
   labelled as illustrative demo data throughout.

   Semantic HTML end to end: the walkthrough is a list of real <button> steps
   and the stage is plain DOM (crawlable, screen-reader legible, sharp at any
   zoom). Auto-advance only while in view and only when motion is allowed;
   choosing a step by hand parks the tour. All figures are worked examples —
   no client data, no claimed results. */

import { useEffect, useRef, useState } from "react";
import { useStaticMotion } from "@/components/site/motion-preference";

const STEPS = [
  { id: "arrive", k: "01", label: "Invoice arrives" },
  { id: "extract", k: "02", label: "Lines extracted" },
  { id: "compare", k: "03", label: "Prices compared" },
  { id: "flag", k: "04", label: "Discrepancy found" },
  { id: "brief", k: "05", label: "Enters the brief" },
  { id: "approve", k: "06", label: "A person approves" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const INVOICE_LINES = [
  { item: "Butternut 10kg", qty: "24", price: "R86.50", was: "R77.20", drift: true },
  { item: "Tomatoes loose 6kg", qty: "18", price: "R94.00", was: "R94.00", drift: false },
  { item: "Red onions 10kg", qty: "12", price: "R72.80", was: "R71.90", drift: false },
  { item: "Baby spinach 2kg", qty: "9", price: "R118.00", was: "R118.00", drift: false },
];

function Chip({ tone, children }: { tone: "system" | "signal" | "quiet"; children: React.ReactNode }) {
  const cls =
    tone === "system"
      ? "bg-system-tint text-system-deep"
      : tone === "signal"
        ? "bg-signal-tint text-signal-deep"
        : "bg-paper-2 text-ink-3";
  return (
    <span className={`vy-mono inline-block rounded-md px-2 py-1 text-[11px] uppercase tracking-[0.08em] ${cls}`}>
      {children}
    </span>
  );
}

function Stage({ step }: { step: StepId }) {
  const reached = (id: StepId) => STEPS.findIndex((s) => s.id === id) <= STEPS.findIndex((s) => s.id === step);
  return (
    <div className="vy-card overflow-hidden">
      {/* Document header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="vy-mono text-xs text-ink-3">TAX INVOICE · INV-8841</span>
          <Chip tone="quiet">FreshCo Produce Market</Chip>
        </div>
        {reached("extract") ? <Chip tone="system">Extracted · 99.2%</Chip> : <Chip tone="quiet">PDF · inbox</Chip>}
      </div>

      {/* Lines */}
      <div className="px-5 py-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="vy-mono text-left text-[11px] uppercase tracking-[0.08em] text-ink-3">
              <th className="pb-2 font-normal">Item</th>
              <th className="pb-2 text-right font-normal">Qty</th>
              <th className="pb-2 text-right font-normal">Unit</th>
              {reached("compare") ? <th className="pb-2 text-right font-normal">Last paid</th> : null}
            </tr>
          </thead>
          <tbody>
            {INVOICE_LINES.map((line) => {
              const flagged = line.drift && reached("flag");
              return (
                <tr
                  key={line.item}
                  className={`border-t border-line-2/60 transition-colors duration-300 ${
                    reached("extract") ? "text-ink" : "text-ink-3 blur-[1.5px]"
                  } ${flagged ? "bg-signal-tint/40" : ""}`}
                >
                  <td className="py-2.5 pr-2">{line.item}</td>
                  <td className="py-2.5 text-right tabular-nums">{line.qty}</td>
                  <td className={`py-2.5 text-right tabular-nums ${flagged ? "font-semibold text-signal-deep" : ""}`}>
                    {line.price}
                  </td>
                  {reached("compare") ? (
                    <td className="py-2.5 text-right tabular-nums text-system-deep">{line.was}</td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Finding */}
      {reached("flag") ? (
        <div className="border-t border-line px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-signal" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">
                Butternut up 12% since June — ≈{" "}
                <span className="text-signal-deep">R58,000/yr</span> at current volumes.
              </p>
              <p className="mt-1 text-sm text-ink-2">
                {reached("brief")
                  ? "Ranked #1 in this morning's brief by financial impact, evidence attached."
                  : "Price drift detected against six months of invoice memory."}
              </p>
              {reached("brief") ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      reached("approve")
                        ? "bg-[#E1F5EE] text-[#0F6E56]"
                        : "bg-ink text-paper"
                    }`}
                  >
                    {reached("approve") ? "✓ Approved — supplier email sent" : "Draft supplier email"}
                  </span>
                  <span className="text-xs text-ink-3">
                    {reached("approve") ? "Actioned by your ops lead, 07:14." : "Waiting for a person."}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BriefDemo() {
  const [step, setStep] = useState<StepId>("arrive");
  const [parked, setParked] = useState(false);
  const staticMotion = useStaticMotion();
  const sectionRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), {
      threshold: 0.35,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (staticMotion || parked || !inView) return undefined;
    const timer = setInterval(() => {
      setStep((current) => {
        const index = STEPS.findIndex((s) => s.id === current);
        return STEPS[(index + 1) % STEPS.length].id;
      });
    }, 2600);
    return () => clearInterval(timer);
  }, [staticMotion, parked, inView]);

  return (
    <div ref={sectionRef} className="grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div>
        <ol className="space-y-1" aria-label="Steps in the workflow">
          {STEPS.map((item) => {
            const active = item.id === step;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setStep(item.id);
                    setParked(true);
                  }}
                  aria-current={active ? "step" : undefined}
                  className={`flex w-full items-baseline gap-4 rounded-xl px-4 py-3 text-left transition-colors ${
                    active ? "bg-ink text-paper" : "text-ink-2 hover:bg-paper-2"
                  }`}
                >
                  <span className={`vy-mono text-xs ${active ? "text-signal-ondark" : "text-ink-3"}`}>
                    {item.k}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="vy-eyebrow mt-6 px-4 text-ink-3">Illustrative demo data</p>
      </div>
      <Stage step={step} />
    </div>
  );
}

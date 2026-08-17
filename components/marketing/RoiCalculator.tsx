"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

import {
  FindingCardFrame,
  FindingEvidence,
  FindingHeader,
  FindingImpact,
  FindingObservation,
} from "@/components/finch/FindingCard";
import { BOOK_HREF } from "@/components/finch/audit/audit-content";

// ── Formatting helpers ──────────────────────────────────────────────────
// en-ZA locale gives us "12 500" (narrow-no-break-space thousands separator)
// and, with the currency style, "R 12 500" — exactly the on-page convention
// requested for this tool. Every formatter clamps its input to a finite,
// non-negative number first so the UI can never render NaN/Infinity.
const numberFormatter = new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  maximumFractionDigits: 0,
});

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function formatHours(value: number): string {
  return `${numberFormatter.format(Math.round(Math.max(0, safeNumber(value))))} hrs`;
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(Math.round(safeNumber(value)));
}

function formatPercent(value: number): string {
  return `${numberFormatter.format(Math.round(Math.max(0, Math.min(999, safeNumber(value)))))}%`;
}

// ── Input parsing — every raw field is a controlled string so the input
// can be cleared while typing; parsing always falls back to a safe number. ─
function parseNonNegative(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function parsePercent(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

// ── State shapes ─────────────────────────────────────────────────────────
type Inputs = {
  employees: string;
  hoursReporting: string;
  hoursProcurement: string;
  wastageLoss: string;
  monthlyRevenue: string;
  hourlyCost: string;
  locations: string;
};

type Assumptions = {
  automatablePct: string;
  wastageRecoverablePct: string;
  locationOverheadPct: string;
};

const INITIAL_INPUTS: Inputs = {
  employees: "4",
  hoursReporting: "6",
  hoursProcurement: "5",
  wastageLoss: "15000",
  monthlyRevenue: "450000",
  hourlyCost: "180",
  locations: "2",
};

const INITIAL_ASSUMPTIONS: Assumptions = {
  automatablePct: "45",
  wastageRecoverablePct: "30",
  locationOverheadPct: "10",
};

// Illustrative starting investment used only for payback framing — Vyso's
// published Start tier (see /pricing, referenced in ContactForm's tier list).
const START_TIER_SETUP = 10000;
const START_TIER_MONTHLY = 8000;
const WEEKS_PER_MONTH = 52 / 12;

type Results = {
  monthlyHoursSaved: number;
  monthlyLaborSavings: number;
  monthlyWastageSavings: number;
  totalMonthlySavings: number;
  annualSavings: number;
  revenueImpactPct: number;
  paybackMonths: number | null;
};

function computeResults(inputs: Inputs, assumptions: Assumptions): Results {
  const employees = parseNonNegative(inputs.employees);
  const hoursReporting = parseNonNegative(inputs.hoursReporting);
  const hoursProcurement = parseNonNegative(inputs.hoursProcurement);
  const wastageLoss = parseNonNegative(inputs.wastageLoss);
  const monthlyRevenue = parseNonNegative(inputs.monthlyRevenue);
  const hourlyCost = parseNonNegative(inputs.hourlyCost);
  // A business always has at least one site — guards the multiplier below
  // against a zero/blank "locations" field collapsing everything to zero.
  const locations = Math.max(1, parseNonNegative(inputs.locations) || 1);

  const automatablePct = parsePercent(assumptions.automatablePct);
  const wastageRecoverablePct = parsePercent(assumptions.wastageRecoverablePct);
  const locationOverheadPct = parsePercent(assumptions.locationOverheadPct);

  const baseWeeklyHours = employees * (hoursReporting + hoursProcurement);
  // Extra locations/departments duplicate coordination work rather than
  // simply adding to it — each additional site adds a fraction of overhead.
  const locationMultiplier = 1 + (locations - 1) * (locationOverheadPct / 100);
  const adjustedWeeklyHours = baseWeeklyHours * locationMultiplier;
  const weeklyHoursSaved = adjustedWeeklyHours * (automatablePct / 100);
  const monthlyHoursSaved = weeklyHoursSaved * WEEKS_PER_MONTH;

  const monthlyLaborSavings = monthlyHoursSaved * hourlyCost;
  const monthlyWastageSavings = wastageLoss * (wastageRecoverablePct / 100);
  const totalMonthlySavings = monthlyLaborSavings + monthlyWastageSavings;
  const annualSavings = totalMonthlySavings * 12;
  const revenueImpactPct = monthlyRevenue > 0 ? (totalMonthlySavings / monthlyRevenue) * 100 : 0;

  const netMonthlySavings = totalMonthlySavings - START_TIER_MONTHLY;
  const paybackMonths =
    netMonthlySavings > 0 && Number.isFinite(START_TIER_SETUP / netMonthlySavings)
      ? START_TIER_SETUP / netMonthlySavings
      : null;

  return {
    monthlyHoursSaved: safeNumber(monthlyHoursSaved),
    monthlyLaborSavings: safeNumber(monthlyLaborSavings),
    monthlyWastageSavings: safeNumber(monthlyWastageSavings),
    totalMonthlySavings: safeNumber(totalMonthlySavings),
    annualSavings: safeNumber(annualSavings),
    revenueImpactPct: safeNumber(revenueImpactPct),
    paybackMonths: paybackMonths !== null ? safeNumber(paybackMonths) : null,
  };
}

/* ── Everything above this line is the calculator as it shipped ──────────────
   Formulas, defaults, parsing guards and the Start-tier framing constants are
   byte-for-byte what they were on `/roi-calculator`; only the presentation
   below changed — glass cards, lucide icons and the marketing stylesheet are
   gone, replaced by the Finch surface so this sits next to the self-assessment
   on `/operations-audit` as one system.                                      */

/* ── Finch surfaces ──────────────────────────────────────────────────────── */

const CARD =
  "rounded-[12px] border border-fn-line bg-fn-surface p-[20px] shadow-[var(--fn-shadow-card)] lg:p-[28px]";

const MONO = "font-fn-mono tracking-[0.12em] text-fn-muted";

/* Spinners eat the space the suffix sits in, and a stepper on a "monthly
   revenue" field is not a control anyone wants. */
const FIELD =
  "w-full rounded-[8px] border border-fn-line bg-fn-surface px-[12px] py-[9px] text-[14px] text-fn-ink " +
  "outline-none transition-[border-color,box-shadow] duration-200 " +
  "focus:border-fn-line-hover focus:shadow-[0_0_0_3px_#C9DEF7] " +
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none " +
  "[&::-webkit-outer-spin-button]:appearance-none";

/* auto-fit rather than a breakpoint: this widget renders in a ~520px column at
   xl and full width below it, so it has to lay itself out from its own size,
   not the viewport's. */
const FIELD_GRID = "grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-[16px]";

function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-[6px] block text-[12.5px] leading-[1.4] font-medium text-fn-ink-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type="number"
          inputMode="decimal"
          min={0}
          step="1"
          value={value}
          onChange={onChange}
          className={FIELD + (suffix ? " pr-[54px]" : "")}
        />
        {suffix ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-[12px] top-1/2 -translate-y-1/2 font-fn-mono text-[10.5px] tracking-[0.06em] text-fn-faint"
          >
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? <p className="m-0 mt-[6px] text-[11.5px] leading-[1.5] text-fn-muted">{hint}</p> : null}
    </div>
  );
}

/* ── Tweened output ──────────────────────────────────────────────────────────
   The outputs interpolate over 400ms rather than snapping: the point of the
   thing is watching your own numbers move when you nudge an assumption, and a
   snap reads as a re-render rather than as a consequence. The tween starts from
   wherever the last one got to (`from`), so typing "1", "15", "150" chases the
   value instead of restarting from zero each keystroke. Reduced motion gets the
   number with no interpolation at all.                                       */
function TweeningNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const from = useRef(value);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const controls = animate(from.current, value, {
      duration: 0.4,
      ease: "easeOut",
      /* `onUpdate` fires from motion's frame loop, never synchronously from
         this effect body — the tween is a subscription, which is what an effect
         is for. */
      onUpdate: (next) => {
        from.current = next;
        setShown(next);
      },
    });
    return () => controls.stop();
  }, [value]);

  /* First render is the initial computed value on both sides of the wire, so
     the server markup and the first client render agree. */
  return <>{format(shown)}</>;
}

function Tweened({ value, format }: { value: number; format: (n: number) => string }) {
  const reduceMotion = useReducedMotion();

  /* Reduced motion renders the number outright — no tween, so no interpolation
     state and no effect to hold it. The split is a separate component rather
     than a branch inside one because the hooks only belong to the animated
     half. */
  if (reduceMotion) return <>{format(value)}</>;

  return <TweeningNumber value={value} format={format} />;
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-fn-line-2 pt-[12px]">
      <div className="font-fn-serif text-[23px] font-medium leading-[1.15] tracking-[-0.02em] tabular-nums text-fn-ink">
        {children}
      </div>
      <div className="mt-[7px] font-fn-mono text-[9.5px] leading-[1.5] tracking-[0.1em] text-fn-muted">
        {label}
      </div>
    </div>
  );
}

export default function RoiCalculator() {
  const [inputs, setInputs] = useState<Inputs>(INITIAL_INPUTS);
  const [assumptions, setAssumptions] = useState<Assumptions>(INITIAL_ASSUMPTIONS);

  const results = useMemo(() => computeResults(inputs, assumptions), [inputs, assumptions]);

  const updateInput = (key: keyof Inputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setInputs((prev) => ({ ...prev, [key]: e.target.value }));

  const updateAssumption = (key: keyof Assumptions) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAssumptions((prev) => ({ ...prev, [key]: e.target.value }));

  const resetAll = () => {
    setInputs(INITIAL_INPUTS);
    setAssumptions(INITIAL_ASSUMPTIONS);
  };

  const savingsAreas = useMemo(() => {
    const areas = [
      {
        key: "admin",
        label: "Manual reporting & procurement admin",
        value: results.monthlyLaborSavings,
        description: `${formatHours(results.monthlyHoursSaved)} of team time freed up every month, valued at your admin hourly cost.`,
      },
      {
        key: "wastage",
        label: "Stock & wastage visibility",
        value: results.monthlyWastageSavings,
        description: `Recovering an estimated ${formatPercent(
          parsePercent(assumptions.wastageRecoverablePct),
        )} of the monthly stock/wastage loss you entered.`,
      },
    ];
    return areas.sort((a, b) => b.value - a.value);
  }, [results, assumptions.wastageRecoverablePct]);

  const paybackText =
    results.paybackMonths === null
      ? "Based on Vyso's Start tier (R 10 000 once-off + R 8 000/month), your estimated savings don't yet clear the monthly retainer at these inputs — a working session will help pinpoint the highest-impact starting workflow."
      : results.paybackMonths > 60
        ? "More than 5 years at the Start tier's investment — increase the automatable-hours or wastage-recovery assumptions below to see how that changes, or talk to us about a tighter scope."
        : `Roughly ${results.paybackMonths.toFixed(1)} months, based on Vyso's Start tier (R 10 000 once-off + R 8 000/month).`;

  return (
    <div className="flex flex-col gap-[20px] lg:gap-[24px]">
      {/* ── Inputs ────────────────────────────────────────────────────────── */}
      <div className={CARD}>
        <div className={MONO + " mb-[16px] text-[10px] lg:text-[10.5px]"}>
          YOUR OPERATION, ROUGHLY · NOTHING IS SENT ANYWHERE
        </div>

        <div className={FIELD_GRID}>
          <NumberField
            id="employees"
            label="Employees involved in admin/ops"
            value={inputs.employees}
            onChange={updateInput("employees")}
            suffix="people"
          />
          <NumberField
            id="hoursReporting"
            label="Hours/week each spends on manual reporting"
            value={inputs.hoursReporting}
            onChange={updateInput("hoursReporting")}
            suffix="hrs"
          />
          <NumberField
            id="hoursProcurement"
            label="Hours/week each spends on procurement/supplier coordination"
            value={inputs.hoursProcurement}
            onChange={updateInput("hoursProcurement")}
            suffix="hrs"
          />
          <NumberField
            id="hourlyCost"
            label="Average hourly cost of admin/ops staff"
            value={inputs.hourlyCost}
            onChange={updateInput("hourlyCost")}
            suffix="R/hr"
          />
          <NumberField
            id="wastageLoss"
            label="Estimated monthly stock/wastage loss"
            value={inputs.wastageLoss}
            onChange={updateInput("wastageLoss")}
            suffix="R/mo"
          />
          <NumberField
            id="monthlyRevenue"
            label="Estimated monthly revenue"
            value={inputs.monthlyRevenue}
            onChange={updateInput("monthlyRevenue")}
            suffix="R/mo"
          />
          <NumberField
            id="locations"
            label="Number of locations/departments"
            value={inputs.locations}
            onChange={updateInput("locations")}
            suffix="sites"
          />
        </div>

        <div className="mt-[24px] border-t border-fn-line pt-[24px]">
          <div className={MONO + " mb-[8px] text-[10px] lg:text-[10.5px]"}>
            ASSUMPTIONS YOU CAN ADJUST
          </div>
          <p className="m-0 mb-[18px] max-w-[520px] text-[13.5px] leading-[1.6] text-fn-ink-3 text-pretty">
            These percentages drive every number below. Change them to match how conservative or
            optimistic you want the estimate to be.
          </p>

          <div className={FIELD_GRID}>
            <NumberField
              id="automatablePct"
              label="% of manual admin hours automatable"
              value={assumptions.automatablePct}
              onChange={updateAssumption("automatablePct")}
              suffix="%"
              hint="Share of reporting + procurement time Vyso typically removes or shortens."
            />
            <NumberField
              id="wastageRecoverablePct"
              label="% of wastage loss recoverable"
              value={assumptions.wastageRecoverablePct}
              onChange={updateAssumption("wastageRecoverablePct")}
              suffix="%"
              hint="Share of current stock/wastage loss that better visibility usually catches."
            />
            <NumberField
              id="locationOverheadPct"
              label="Extra coordination overhead per site"
              value={assumptions.locationOverheadPct}
              onChange={updateAssumption("locationOverheadPct")}
              suffix="%"
              hint="Added admin duplication for every location/department beyond the first."
            />
          </div>

          <button
            type="button"
            onClick={resetAll}
            className="mt-[20px] cursor-pointer text-[13px] font-medium text-fn-ink-3 transition-colors duration-150 hover:text-fn-orange-deep"
          >
            Reset to example numbers
          </button>
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────────────────────── */}
      <div className={CARD}>
        <div className={MONO + " mb-[18px] text-[10px] lg:text-[10.5px]"}>ESTIMATED IMPACT</div>

        <div
          /* 180px is the number that makes this 2×2 in the xl column and one
             row across when the widget is stacked full width — 130 left a lone
             fourth stat hanging under a row of three. */
          className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-x-[20px] gap-y-[18px]"
          aria-live="polite"
        >
          <Stat label="ESTIMATED HOURS SAVED / MONTH">
            <Tweened value={results.monthlyHoursSaved} format={formatHours} />
          </Stat>
          <Stat label="ESTIMATED MONTHLY SAVINGS">
            <Tweened value={results.totalMonthlySavings} format={formatCurrency} />
          </Stat>
          <Stat label="ESTIMATED ANNUAL SAVINGS">
            <Tweened value={results.annualSavings} format={formatCurrency} />
          </Stat>
          <Stat label="OF MONTHLY REVENUE">
            <Tweened value={results.revenueImpactPct} format={formatPercent} />
          </Stat>
        </div>

        <div className="mt-[24px] border-t border-fn-line pt-[20px]">
          <div className={MONO + " mb-[10px] text-[10px] lg:text-[10.5px]"}>PAYBACK FRAMING</div>
          <p className="m-0 text-[13.5px] leading-[1.6] text-fn-ink-3 text-pretty">{paybackText}</p>
        </div>

        <div className="mt-[20px] border-t border-fn-line pt-[20px]">
          <div className={MONO + " mb-[14px] text-[10px] lg:text-[10.5px]"}>
            WHERE THE SAVINGS WOULD COME FROM
          </div>
          <div className="flex flex-col">
            {savingsAreas.map((area) => (
              <div key={area.key} className="border-b border-fn-line-2 py-[12px] first:pt-0 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-[12px] gap-y-[4px]">
                  <span className="text-[14px] font-medium text-fn-ink">{area.label}</span>
                  {/* Blue, not orange: on this surface a figure is evidence, and
                      orange is reserved for the CTA and a finding's impact. */}
                  <span className="shrink-0 whitespace-nowrap font-fn-mono text-[13px] tabular-nums text-fn-blue-deep">
                    <Tweened value={area.value} format={formatCurrency} />
                  </span>
                </div>
                <p className="m-0 mt-[4px] text-[13px] leading-[1.55] text-fn-muted text-pretty">
                  {area.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── The finding ─────────────────────────────────────────────────────
          The calculator ends the way every other Finch surface ends: in a card
          that states one thing and what to do about it. The rand figure here is
          the reader's own arithmetic, not a claim we are making about their
          business — which is why the meta line says so out loud. Composed from
          the pieces rather than <FindingCard> because its action is a real
          anchor into the booking form. */}
      <FindingCardFrame state="new" className="max-w-none">
        <FindingHeader agent="CALCULATOR" state="new" />
        <FindingObservation>
          Manual work is costing about{" "}
          <Tweened value={results.monthlyHoursSaved} format={formatHours} /> a month.
        </FindingObservation>
        <FindingImpact>
          ≈ <Tweened value={results.annualSavings} format={formatCurrency} />/yr at your numbers
        </FindingImpact>
        <FindingEvidence evidence="your inputs" meta="BASED ON YOUR INPUTS · AN ESTIMATE, NOT A QUOTE" />
        {/* One action. "Reset" already sits under the assumptions, where the
            numbers you would want to undo are. */}
        <div className="flex flex-wrap items-center gap-x-[6px] gap-y-[4px] border-t border-fn-line-2 pt-[13px]">
          {/* A path, not a bare `#book`: the calculator is its own page now
              (`/operations-audit/calculator`) and the booking form is on the
              parent. */}
          <a
            href={BOOK_HREF}
            className="rounded-[5px] px-[6px] py-[3px] text-[13px] font-medium text-fn-ink-2 transition-all duration-[120ms] hover:bg-[#F5F2EA] hover:text-fn-ink"
          >
            Book the audit <span aria-hidden="true">→</span>
          </a>
        </div>
      </FindingCardFrame>
    </div>
  );
}

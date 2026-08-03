"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, PiggyBank, RotateCcw, TrendingUp, Wallet } from "lucide-react";

import { marketingStyles as styles } from "@/components/marketing/PublicMarketing";

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

// ── Shared field styling (mirrors ContactForm's inline-styled inputs) ────
const BODY_FONT: React.CSSProperties = { fontFamily: "var(--font-body, var(--font-sans))" };

const FIELD_INPUT: React.CSSProperties = {
  ...BODY_FONT,
  width: "100%",
  padding: "0.65rem 0.85rem",
  fontSize: "0.9rem",
  color: "#0d0d0d",
  background: "rgba(255,255,255,0.7)",
  border: "1px solid #e0ddd9",
  borderRadius: 12,
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

const FIELD_LABEL: React.CSSProperties = {
  ...BODY_FONT,
  display: "block",
  marginBottom: "0.4rem",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "#444",
};

const FIELD_HINT: React.CSSProperties = {
  ...BODY_FONT,
  margin: "0.35rem 0 0",
  fontSize: "0.72rem",
  color: "#8a8a8a",
  lineHeight: 1.5,
};

function focusField(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "hsl(22,69%,44%)";
  e.currentTarget.style.boxShadow = "0 0 0 3px hsl(22 69% 44% / 0.12)";
}

function blurField(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#e0ddd9";
  e.currentTarget.style.boxShadow = "none";
}

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
      <label htmlFor={id} style={FIELD_LABEL}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          name={id}
          type="number"
          inputMode="decimal"
          min={0}
          step="1"
          value={value}
          onChange={onChange}
          onFocus={focusField}
          onBlur={blurField}
          style={{ ...FIELD_INPUT, paddingRight: suffix ? "2.6rem" : FIELD_INPUT.padding }}
        />
        {suffix ? (
          <span
            style={{
              position: "absolute",
              top: "50%",
              right: "0.85rem",
              transform: "translateY(-50%)",
              fontSize: "0.78rem",
              fontWeight: 600,
              color: "#9b9b9b",
              pointerEvents: "none",
            }}
          >
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? <p style={FIELD_HINT}>{hint}</p> : null}
    </div>
  );
}

// Auto-fit/minmax grids stay responsive without any media queries, which
// keeps this component self-contained (the shared marketing stylesheet is
// off-limits to edits in this workstream).
const FIELD_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "1.15rem",
};

const SPLIT_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: "clamp(1.75rem, 4vw, 3rem)",
  alignItems: "start",
};

const RESULT_STAT_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "0.9rem",
};

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
    <div style={SPLIT_GRID}>
      {/* Inputs column */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        <div className={styles.glassCard} style={{ minHeight: 0 }}>
          <p className={styles.cardKicker}>Your operation, roughly</p>
          <h2 className={styles.cardTitle} style={{ fontSize: "1.4rem" }}>
            Tell us how the work is spread today
          </h2>
          <p className={styles.cardCopy} style={{ marginBottom: "1.4rem" }}>
            Rough numbers are fine — every figure below can be adjusted, and the
            estimate updates as you type.
          </p>

          <div style={FIELD_GRID}>
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
        </div>

        <div className={styles.glassCard} style={{ minHeight: 0 }}>
          <p className={styles.cardKicker}>Assumptions you can adjust</p>
          <h2 className={styles.cardTitle} style={{ fontSize: "1.2rem" }}>
            Nothing here is hidden
          </h2>
          <p className={styles.cardCopy} style={{ marginBottom: "1.4rem" }}>
            These percentages drive every number to the right. Change them to
            match how conservative or optimistic you want the estimate to be.
          </p>

          <div style={FIELD_GRID}>
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
            style={{
              ...BODY_FONT,
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              marginTop: "1.4rem",
              padding: "0.55rem 1rem",
              border: "1px solid #e0ddd9",
              borderRadius: 999,
              background: "rgba(255,255,255,0.6)",
              color: "#666",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset to example numbers
          </button>
        </div>
      </div>

      {/* Results column */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div className={styles.glassCard} style={{ minHeight: 0 }}>
          <p className={styles.cardKicker}>Estimated impact</p>
          <h2 className={styles.cardTitle} style={{ fontSize: "1.4rem" }}>
            What this could be worth
          </h2>

          <div style={{ ...RESULT_STAT_GRID, marginTop: "1.3rem" }}>
            <div className={styles.statCard}>
              <span className={styles.cardIcon} style={{ marginBottom: "0.6rem" }}>
                <Clock aria-hidden="true" size={17} />
              </span>
              <p className={styles.statValue} style={{ fontSize: "clamp(1.4rem, 2.6vw, 2rem)" }}>
                {formatHours(results.monthlyHoursSaved)}
              </p>
              <p className={styles.statLabel}>Estimated hours saved / month</p>
            </div>
            <div className={styles.statCard}>
              <span className={styles.cardIcon} style={{ marginBottom: "0.6rem" }}>
                <Wallet aria-hidden="true" size={17} />
              </span>
              <p className={styles.statValue} style={{ fontSize: "clamp(1.4rem, 2.6vw, 2rem)" }}>
                {formatCurrency(results.totalMonthlySavings)}
              </p>
              <p className={styles.statLabel}>Estimated monthly savings</p>
            </div>
            <div className={styles.statCard}>
              <span className={styles.cardIcon} style={{ marginBottom: "0.6rem" }}>
                <PiggyBank aria-hidden="true" size={17} />
              </span>
              <p className={styles.statValue} style={{ fontSize: "clamp(1.4rem, 2.6vw, 2rem)" }}>
                {formatCurrency(results.annualSavings)}
              </p>
              <p className={styles.statLabel}>Estimated annual savings</p>
            </div>
            <div className={styles.statCard}>
              <span className={styles.cardIcon} style={{ marginBottom: "0.6rem" }}>
                <TrendingUp aria-hidden="true" size={17} />
              </span>
              <p className={styles.statValue} style={{ fontSize: "clamp(1.4rem, 2.6vw, 2rem)" }}>
                {formatPercent(results.revenueImpactPct)}
              </p>
              <p className={styles.statLabel}>Of monthly revenue</p>
            </div>
          </div>

          <div style={{ marginTop: "1.4rem", paddingTop: "1.4rem", borderTop: "1px solid rgb(13 13 13 / 8%)" }}>
            <p className={styles.cardKicker} style={{ marginBottom: "0.5rem" }}>
              Payback framing
            </p>
            <p className={styles.cardCopy}>{paybackText}</p>
          </div>
        </div>

        <div className={styles.glassCard} style={{ minHeight: 0 }}>
          <p className={styles.cardKicker}>Where savings would come from</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.9rem" }}>
            {savingsAreas.map((area) => (
              <div key={area.key}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                  <span style={{ ...BODY_FONT, fontSize: "0.86rem", fontWeight: 700, color: "#0d0d0d" }}>
                    {area.label}
                  </span>
                  <span style={{ ...BODY_FONT, fontSize: "0.86rem", fontWeight: 700, color: "hsl(22,69%,44%)" }}>
                    {formatCurrency(area.value)}
                  </span>
                </div>
                <p className={styles.cardCopy} style={{ marginTop: "0.3rem" }}>
                  {area.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.ctaCard} style={{ textAlign: "left", padding: "clamp(1.5rem, 3vw, 2.2rem)" }}>
          <p className={styles.eyebrow}>Validate these numbers</p>
          <h3 className={styles.cardTitle} style={{ fontSize: "1.25rem" }}>
            See how close this is to reality
          </h3>
          <p className={styles.cardCopy} style={{ marginBottom: "1.3rem" }}>
            This estimate is a starting point. Book a call and we&apos;ll test it
            against your actual workflow.
          </p>
          <div className={styles.actions} style={{ marginTop: 0 }}>
            <Link className={styles.primaryButton} href="/contact">
              Join Waitlist <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

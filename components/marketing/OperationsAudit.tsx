"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import {
  FindingCardFrame,
  FindingEvidence,
  FindingHeader,
  FindingImpact,
  FindingObservation,
} from "@/components/finch/FindingCard";
import { ScoreGauge } from "@/components/finch/audit/ScoreGauge";
import { BOOK_HREF } from "@/components/finch/audit/audit-content";

// ── Question bank ────────────────────────────────────────────────────────
// Each question maps to one operational category and one suggested Vyso
// solution page. `reversed: true` means answering "Yes" is the risky answer
// (e.g. relying on spreadsheets); `reversed: false` means "Yes" is the
// healthy answer (e.g. having stock/wastage visibility in one place).
type AnswerValue = "yes" | "sometimes" | "no";

type Question = {
  id: string;
  category: string;
  prompt: string;
  reversed: boolean;
  solutionHref: string;
  solutionLabel: string;
};

const QUESTIONS: readonly Question[] = [
  {
    id: "spreadsheets",
    category: "Spreadsheets & manual tracking",
    prompt: "Do you rely on spreadsheets for daily operational tracking?",
    reversed: true,
    solutionHref: "/solutions/reporting-automation",
    solutionLabel: "Reporting automation",
  },
  {
    id: "weekly-reports",
    category: "Manual reporting",
    prompt: "Do managers manually compile weekly reports for leadership?",
    reversed: true,
    solutionHref: "/solutions/reporting-automation",
    solutionLabel: "Reporting automation",
  },
  {
    id: "stock-visibility",
    category: "Operational visibility",
    prompt: "Can you see stock, purchases and wastage in one place?",
    reversed: false,
    solutionHref: "/solutions/reporting-automation",
    solutionLabel: "Reporting automation",
  },
  {
    id: "supplier-issues",
    category: "Supplier management",
    prompt:
      "Are supplier issues, such as late deliveries, price errors and quality problems, tracked consistently?",
    reversed: false,
    solutionHref: "/solutions/procurement-automation",
    solutionLabel: "Procurement automation",
  },
  {
    id: "whatsapp-approvals",
    category: "Informal approvals",
    prompt: "Do approvals happen mostly through WhatsApp or informal messages?",
    reversed: true,
    solutionHref: "/solutions/procurement-automation",
    solutionLabel: "Procurement automation",
  },
  {
    id: "leadership-visibility",
    category: "Leadership visibility",
    prompt:
      "Can leadership see operational performance without asking staff for updates?",
    reversed: false,
    solutionHref: "/solutions/reporting-automation",
    solutionLabel: "Reporting automation",
  },
  {
    id: "inventory-counts",
    category: "Inventory control",
    prompt: "Are physical stock counts done regularly and reconciled against records?",
    reversed: false,
    solutionHref: "/solutions/reduce-money-leakage",
    solutionLabel: "Reduce money leakage",
  },
  {
    id: "finance-visibility",
    category: "Finance visibility",
    prompt: "Does finance have real-time visibility into operational costs and margins?",
    reversed: false,
    solutionHref: "/solutions/reporting-automation",
    solutionLabel: "Reporting automation",
  },
  {
    id: "wastage-tracking",
    category: "Wastage tracking",
    prompt: "Is wastage recorded and reviewed regularly, with reasons captured?",
    reversed: false,
    solutionHref: "/solutions/reduce-money-leakage",
    solutionLabel: "Reduce money leakage",
  },
  {
    id: "approvals-process",
    category: "Approvals process",
    prompt: "Is there a clear, consistent process for approving purchases and expenses?",
    reversed: false,
    solutionHref: "/solutions/procurement-automation",
    solutionLabel: "Procurement automation",
  },
];

const ANSWER_OPTIONS: readonly { value: AnswerValue; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "sometimes", label: "Sometimes" },
  { value: "no", label: "No" },
];

const ANSWER_SCORE: Record<AnswerValue, number> = { yes: 100, sometimes: 50, no: 0 };

function scoreForQuestion(question: Question, answer: AnswerValue): number {
  const base = ANSWER_SCORE[answer];
  return question.reversed ? 100 - base : base;
}

type RiskLevel = "Low" | "Medium" | "High";

function riskLevelForScore(score: number): RiskLevel {
  if (score >= 70) return "Low";
  if (score >= 40) return "Medium";
  return "High";
}

const RECOMMENDED_STEPS: Record<RiskLevel, readonly string[]> = {
  Low: [
    "Document the workflows that already work well so they survive staff turnover.",
    "Put a lightweight dashboard in place to catch drift before it becomes a habit.",
    "Revisit this assessment every few months as the business grows.",
  ],
  Medium: [
    "Pick the single lowest-scoring area below and fix that workflow first. Don't try to fix everything at once.",
    "Move the highest-risk approvals or reporting step off WhatsApp or spreadsheets into one source of truth.",
    "Give leadership a way to see performance without asking staff to compile it manually.",
  ],
  High: [
    "Start with a structured operations audit. Several core processes are running on manual work and informal messages.",
    "Prioritise the areas below where spreadsheets, WhatsApp or memory are the only record of what happened.",
    "Get an outside view before the next busy period, while these gaps are still cheap to fix.",
  ],
};

const RISK_COPY: Record<RiskLevel, string> = {
  Low: "Your operation already has solid habits. A few gaps are worth tightening as you grow.",
  Medium: "Several manual handovers are creating room for cost, time or information to leak.",
  High: "Multiple core processes are still running on spreadsheets, memory and WhatsApp. This is the profile most likely to be losing money without realising it.",
};

function safeScore(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

type AuditResult = {
  score: number;
  riskLevel: RiskLevel;
  perQuestion: readonly { question: Question; score: number; answer: AnswerValue }[];
  topRisks: readonly { question: Question; score: number; answer: AnswerValue }[];
};

function computeAudit(
  answers: Record<string, AnswerValue | null>,
): AuditResult | null {
  const perQuestion: { question: Question; score: number; answer: AnswerValue }[] = [];

  for (const question of QUESTIONS) {
    const answer = answers[question.id];
    if (!answer) return null; // Guard: never score an incomplete assessment.
    perQuestion.push({ question, score: safeScore(scoreForQuestion(question, answer)), answer });
  }

  const total = perQuestion.reduce((sum, entry) => sum + entry.score, 0);
  const score = perQuestion.length > 0 ? safeScore(total / perQuestion.length) : 0;

  const topRisks = [...perQuestion].sort((a, b) => a.score - b.score).slice(0, 3);

  return {
    score: Math.round(score),
    riskLevel: riskLevelForScore(score),
    perQuestion,
    topRisks,
  };
}

/* ── The generated finding ───────────────────────────────────────────────────
   The top-risk question said back in plain words, so the card reads like a
   finding rather than like a quiz result. Keyed off the question id and kept
   OUT of the QUESTIONS array on purpose — that array is the grounded scoring
   input and stays byte-for-byte as it was.

   There is deliberately no rand figure here. The whole promise of the audit is
   that the number comes with its evidence; inventing one from ten yes/no
   answers would be exactly the thing this page says nobody should do.        */
const TOP_RISK_OBSERVATION: Record<string, string> = {
  "spreadsheets":
    "Daily operations are tracked in spreadsheets, and the real record lives in one person's file.",
  "weekly-reports":
    "Managers are still assembling the weekly report by hand, every week.",
  "stock-visibility":
    "Stock, purchases and wastage are not visible in one place.",
  "supplier-issues":
    "Late deliveries, price errors and quality problems are not tracked consistently.",
  "whatsapp-approvals":
    "Approvals happen on WhatsApp, so there is no record of who agreed to what.",
  "leadership-visibility":
    "Leadership has to ask staff for an update to see how the operation is running.",
  "inventory-counts":
    "Stock counts are not reconciled against the records often enough to catch a gap.",
  "finance-visibility":
    "Finance cannot see operational costs and margins while they can still be changed.",
  "wastage-tracking":
    "Wastage is not recorded with its reasons, so nobody can see the pattern.",
  "approvals-process":
    "There is no consistent process for approving purchases and expenses.",
};

/* ── Shared Finch surfaces ───────────────────────────────────────────────── */

const CARD =
  "rounded-[12px] border border-fn-line bg-fn-surface p-[20px] shadow-[var(--fn-shadow-card)] lg:p-[28px]";

const MONO = "font-fn-mono tracking-[0.12em] text-fn-muted";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/* ── The assessment ──────────────────────────────────────────────────────────
   Same ten questions, same scoring, Finch presentation: white cards, hairlines,
   mono counters, an SVG gauge that draws to the score and a generated finding
   card underneath it. The old glass card / lucide / pill-button styling is
   gone; nothing above this line changed.                                     */
export default function OperationsAudit() {
  const [answers, setAnswers] = useState<Record<string, AnswerValue | null>>(() =>
    Object.fromEntries(QUESTIONS.map((question) => [question.id, null])),
  );
  const [submitted, setSubmitted] = useState(false);
  const reduceMotion = useReducedMotion();

  /* Always in the DOM, results or not: scrolling to an anchor that exists is
     reliable, scrolling to one that React has not committed yet is not. */
  const resultAnchor = useRef<HTMLDivElement | null>(null);
  const formTop = useRef<HTMLDivElement | null>(null);

  const answeredCount = Object.values(answers).filter((value) => value !== null).length;
  const allAnswered = answeredCount === QUESTIONS.length;

  const result = useMemo(() => computeAudit(answers), [answers]);
  const showResult = submitted && result !== null;

  const handleAnswer = (id: string, value: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const handleReset = () => {
    setAnswers(Object.fromEntries(QUESTIONS.map((question) => [question.id, null])));
    setSubmitted(false);
    formTop.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const handleSubmit = () => {
    setSubmitted(true);
    resultAnchor.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const topRisk = result?.topRisks[0];

  return (
    <div className="flex flex-col gap-[24px] lg:gap-[32px]">
      {/* ── Questions ─────────────────────────────────────────────────────── */}
      <div ref={formTop} className={CARD + " scroll-mt-[24px]"}>
        <div className="mb-[10px] flex flex-wrap items-baseline justify-between gap-[10px]">
          <span className={MONO + " text-[10px] lg:text-[10.5px]"}>
            SELF-ASSESSMENT · {QUESTIONS.length} QUESTIONS · NOTHING IS SENT ANYWHERE
          </span>
          <span className="font-fn-mono text-[10.5px] tracking-[0.1em] text-fn-ink-2">
            {pad(answeredCount)} / {pad(QUESTIONS.length)} ANSWERED
          </span>
        </div>

        <div
          className="h-[2px] w-full overflow-hidden rounded-[2px] bg-fn-line-2"
          role="progressbar"
          aria-valuenow={answeredCount}
          aria-valuemin={0}
          aria-valuemax={QUESTIONS.length}
          aria-label="Questions answered"
        >
          <div
            className="h-full bg-fn-ink transition-[width] duration-[250ms] ease-out"
            style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%` }}
          />
        </div>

        <div className="mt-[8px]">
          {QUESTIONS.map((question, index) => (
            <fieldset
              key={question.id}
              className="m-0 border-0 border-t border-fn-line-2 p-0 pt-[22px] pb-[22px] last:pb-0"
            >
              <legend className={MONO + " text-[10px] lg:text-[10.5px]"}>
                QUESTION {pad(index + 1)} / {pad(QUESTIONS.length)} ·{" "}
                {question.category.toUpperCase()}
              </legend>
              <p className="m-0 mb-[14px] mt-[10px] max-w-[620px] text-[15px] leading-[1.55] text-fn-ink text-pretty lg:text-[15.5px]">
                {question.prompt}
              </p>
              <div className="flex flex-wrap gap-[8px]">
                {ANSWER_OPTIONS.map((option) => {
                  const selected = answers[question.id] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleAnswer(question.id, option.value)}
                      className={
                        "min-h-[38px] cursor-pointer rounded-[8px] border px-[16px] py-[8px] text-[13.5px] font-medium transition-colors duration-150 " +
                        (selected
                          ? "border-fn-ink bg-fn-ink text-fn-bg"
                          : "border-fn-line bg-fn-surface text-fn-ink-2 hover:border-fn-line-hover hover:text-fn-ink")
                      }
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="mt-[24px] flex flex-wrap items-center gap-[16px] border-t border-fn-line pt-[24px]">
          <button
            type="button"
            disabled={!allAnswered}
            onClick={handleSubmit}
            className={
              "min-h-[44px] rounded-[9px] px-[24px] py-[13px] text-[15px] font-semibold transition-colors duration-150 " +
              (allAnswered
                ? "cursor-pointer bg-fn-ink text-fn-bg hover:bg-[#2A261E]"
                : "cursor-not-allowed border border-fn-line bg-fn-surface text-fn-faint")
            }
          >
            See my score <span aria-hidden="true">→</span>
          </button>
          {allAnswered ? (
            <button
              type="button"
              onClick={handleReset}
              className="cursor-pointer text-[13.5px] font-medium text-fn-ink-3 transition-colors duration-150 hover:text-fn-orange-deep"
            >
              Start over
            </button>
          ) : (
            <span className="text-[13.5px] text-fn-muted">
              Answer every question to see your score.
            </span>
          )}
        </div>
      </div>

      <div ref={resultAnchor} className="scroll-mt-[24px]" />

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {showResult && result ? (
        <motion.div
          className="flex flex-col gap-[24px]"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.38, ease: "easeOut" }}
          aria-live="polite"
        >
          <div className={CARD}>
            <ScoreGauge
              score={result.score}
              riskLabel={result.riskLevel}
              riskTone={result.riskLevel === "High" ? "alert" : "quiet"}
            />
            <p className="m-0 mt-[20px] max-w-[620px] text-[15px] leading-[1.6] text-fn-ink-3 text-pretty">
              {RISK_COPY[result.riskLevel]}
            </p>
          </div>

          {/* The page's finding card, generated from the lowest-scoring answer.
              Composed from the pieces rather than <FindingCard> because its two
              actions are a real anchor and a real button. */}
          {topRisk ? (
            <FindingCardFrame state="new" className="max-w-none">
              <FindingHeader agent="AUDIT" state="new" />
              <FindingObservation>
                {TOP_RISK_OBSERVATION[topRisk.question.id] ?? topRisk.question.category}
              </FindingObservation>
              <FindingImpact>Quantified in your audit</FindingImpact>
              <FindingEvidence
                evidence={`your ${QUESTIONS.length} answers`}
                meta={`SELF-ASSESSMENT · ${result.riskLevel.toUpperCase()} RISK · ${result.score}/100`}
              />
              <div className="flex flex-wrap items-center gap-x-[6px] gap-y-[4px] border-t border-fn-line-2 pt-[13px]">
                {/* A path, not a bare `#book`: this assessment is its own page
                    now (`/operations-audit/score`) and the booking form is on
                    the parent, so the in-page hash it used to carry would be a
                    dead link. "Start over" beside it stays a button, because
                    starting over is state, not navigation. */}
                <a
                  href={BOOK_HREF}
                  className="rounded-[5px] px-[6px] py-[3px] text-[13px] font-medium text-fn-ink-2 transition-all duration-[120ms] hover:bg-[#F5F2EA] hover:text-fn-ink"
                >
                  Book the audit
                </a>
                <span aria-hidden="true" className="text-[12px] text-fn-line-3">
                  ·
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="cursor-pointer rounded-[5px] px-[6px] py-[3px] text-[13px] font-medium text-fn-ink-2 transition-all duration-[120ms] hover:bg-[#F5F2EA] hover:text-fn-ink"
                >
                  Start over
                </button>
              </div>
            </FindingCardFrame>
          ) : null}

          <div className={CARD}>
            <div className={MONO + " mb-[18px] text-[10.5px]"}>TOP THREE OPERATIONAL RISKS</div>
            <div className="flex flex-col">
              {result.topRisks.map(({ question, score }) => (
                <div
                  key={question.id}
                  className="flex flex-wrap items-start justify-between gap-[12px] border-b border-fn-line-2 py-[14px] first:pt-0 last:border-b-0 last:pb-0"
                >
                  <div className="min-w-0 max-w-[540px]">
                    <div className="mb-[6px] font-fn-mono text-[10px] tracking-[0.12em] text-fn-ink-2">
                      {question.category.toUpperCase()}
                    </div>
                    <p className="m-0 text-[14.5px] leading-[1.55] text-fn-ink-3 text-pretty">
                      {question.prompt}
                    </p>
                    <Link
                      href={question.solutionHref}
                      className="mt-[8px] inline-block text-[13px] font-medium text-fn-ink-2 transition-colors duration-150 hover:text-fn-orange-deep"
                    >
                      See {question.solutionLabel} <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                  <span className="shrink-0 whitespace-nowrap font-fn-mono text-[11.5px] text-fn-blue-deep">
                    {Math.round(score)}/100
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={CARD}>
            <div className={MONO + " mb-[16px] text-[10.5px]"}>WHAT TO DO NEXT</div>
            <ul className="m-0 flex list-none flex-col gap-[12px] p-0">
              {RECOMMENDED_STEPS[result.riskLevel].map((step) => (
                <li
                  key={step}
                  className="flex gap-[10px] text-[14.5px] leading-[1.6] text-fn-ink-3 text-pretty"
                >
                  <span aria-hidden="true" className="shrink-0 text-fn-line-3">
                    ·
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}

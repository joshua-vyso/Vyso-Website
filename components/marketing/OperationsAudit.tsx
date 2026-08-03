"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, RotateCcw } from "lucide-react";

import { marketingStyles as styles } from "@/components/marketing/PublicMarketing";

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
    solutionHref: "/solutions/operations-dashboard",
    solutionLabel: "Operations dashboard",
  },
  {
    id: "supplier-issues",
    category: "Supplier management",
    prompt:
      "Are supplier issues — late deliveries, price errors, quality problems — tracked consistently?",
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
    solutionHref: "/solutions/operations-dashboard",
    solutionLabel: "Operations dashboard",
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
    solutionHref: "/solutions/operations-dashboard",
    solutionLabel: "Operations dashboard",
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
    "Pick the single lowest-scoring area below and fix that workflow first — don't try to fix everything at once.",
    "Move the highest-risk approvals or reporting step off WhatsApp or spreadsheets into one source of truth.",
    "Give leadership a way to see performance without asking staff to compile it manually.",
  ],
  High: [
    "Start with a structured operations audit — several core processes are running on manual work and informal messages.",
    "Prioritise the areas below where spreadsheets, WhatsApp or memory are the only record of what happened.",
    "Get an outside view before the next busy period, while these gaps are still cheap to fix.",
  ],
};

const RISK_COPY: Record<RiskLevel, string> = {
  Low: "Your operation already has solid habits. A few gaps are worth tightening as you grow.",
  Medium: "Several manual handovers are creating room for cost, time or information to leak.",
  High: "Multiple core processes are still running on spreadsheets, memory and WhatsApp — this is the profile most likely to be losing money without realising it.",
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

const RISK_BADGE_COLOR: Record<RiskLevel, string> = {
  Low: "hsl(142 60% 32%)",
  Medium: "hsl(32 85% 42%)",
  High: "hsl(4 72% 45%)",
};

const BODY_FONT: React.CSSProperties = { fontFamily: "var(--font-body, var(--font-sans))" };

const PROGRESS_TRACK: React.CSSProperties = {
  height: 8,
  borderRadius: 999,
  background: "rgb(13 13 13 / 8%)",
  overflow: "hidden",
};

export default function OperationsAudit() {
  const [answers, setAnswers] = useState<Record<string, AnswerValue | null>>(() =>
    Object.fromEntries(QUESTIONS.map((question) => [question.id, null])),
  );
  const [submitted, setSubmitted] = useState(false);

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
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Progress + questions */}
      <div className={styles.glassCard} style={{ minHeight: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.6rem",
            gap: "1rem",
          }}
        >
          <p className={styles.cardKicker} style={{ margin: 0 }}>
            Self-assessment · {QUESTIONS.length} questions
          </p>
          <p style={{ ...BODY_FONT, fontSize: "0.78rem", fontWeight: 700, color: "#666" }}>
            {answeredCount} of {QUESTIONS.length} answered
          </p>
        </div>
        <div style={PROGRESS_TRACK} role="progressbar" aria-valuenow={answeredCount} aria-valuemin={0} aria-valuemax={QUESTIONS.length}>
          <div
            style={{
              height: "100%",
              width: `${(answeredCount / QUESTIONS.length) * 100}%`,
              background: "hsl(22,69%,44%)",
              transition: "width 0.25s ease",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.4rem", marginTop: "1.8rem" }}>
          {QUESTIONS.map((question, index) => (
            <fieldset
              key={question.id}
              style={{
                border: "1px solid rgb(13 13 13 / 8%)",
                borderRadius: 16,
                padding: "1.1rem 1.2rem",
                background: "rgb(255 255 255 / 45%)",
              }}
            >
              <legend
                style={{
                  ...BODY_FONT,
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "hsl(22,69%,44%)",
                  padding: "0 0.3rem",
                }}
              >
                {String(index + 1).padStart(2, "0")} · {question.category}
              </legend>
              <p style={{ ...BODY_FONT, fontSize: "0.95rem", fontWeight: 600, color: "#0d0d0d", margin: "0.3rem 0 0.9rem" }}>
                {question.prompt}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
                {ANSWER_OPTIONS.map((option) => {
                  const selected = answers[question.id] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => handleAnswer(question.id, option.value)}
                      style={{
                        ...BODY_FONT,
                        padding: "0.5rem 1.1rem",
                        borderRadius: 999,
                        border: selected ? "1px solid hsl(22,69%,44%)" : "1px solid #e0ddd9",
                        background: selected ? "hsl(22,69%,44%)" : "rgba(255,255,255,0.7)",
                        color: selected ? "#fff" : "#444",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem", marginTop: "1.8rem" }}>
          <button
            type="button"
            disabled={!allAnswered}
            onClick={() => setSubmitted(true)}
            className={styles.primaryButton}
            style={{
              border: "none",
              cursor: allAnswered ? "pointer" : "not-allowed",
              opacity: allAnswered ? 1 : 0.5,
            }}
          >
            See my operations score <ArrowRight aria-hidden="true" size={16} />
          </button>
          {!allAnswered ? (
            <p style={{ ...BODY_FONT, fontSize: "0.78rem", color: "#8a8a8a", margin: 0 }}>
              Answer every question to see your score.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              style={{
                ...BODY_FONT,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
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
              Retake assessment
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {showResult && result ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className={styles.glassCard} style={{ minHeight: 0 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1.6rem", alignItems: "center" }}>
              <div>
                <p className={styles.cardKicker}>Your operations score</p>
                <p className={styles.statValue} style={{ fontSize: "clamp(2.4rem, 6vw, 3.6rem)" }}>
                  {result.score}
                  <span style={{ fontSize: "1.2rem", color: "#999", fontWeight: 700 }}>/100</span>
                </p>
              </div>
              <span
                style={{
                  ...BODY_FONT,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.5rem 1rem",
                  borderRadius: 999,
                  background: `${RISK_BADGE_COLOR[result.riskLevel]}1a`,
                  color: RISK_BADGE_COLOR[result.riskLevel],
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {result.riskLevel === "High" ? <AlertTriangle size={14} aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
                {result.riskLevel} risk
              </span>
            </div>
            <p className={styles.cardCopy} style={{ marginTop: "1.1rem", maxWidth: 620 }}>
              {RISK_COPY[result.riskLevel]}
            </p>
          </div>

          <div className={styles.glassCard} style={{ minHeight: 0 }}>
            <p className={styles.cardKicker}>Top 3 operational risks</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.1rem", marginTop: "0.9rem" }}>
              {result.topRisks.map(({ question, score }, index) => (
                <div
                  key={question.id}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "0.75rem",
                    paddingBottom: index === result.topRisks.length - 1 ? 0 : "1.1rem",
                    borderBottom: index === result.topRisks.length - 1 ? "none" : "1px solid rgb(13 13 13 / 7%)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ ...BODY_FONT, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "hsl(22,69%,44%)", margin: "0 0 0.3rem" }}>
                      {question.category}
                    </p>
                    <p style={{ ...BODY_FONT, fontSize: "0.9rem", color: "#333", margin: 0, lineHeight: 1.5 }}>
                      {question.prompt}
                    </p>
                    <Link href={question.solutionHref} className={styles.textLink} style={{ marginTop: "0.5rem", fontSize: "0.78rem" }}>
                      See {question.solutionLabel} <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                  <span style={{ ...BODY_FONT, fontSize: "0.78rem", fontWeight: 800, color: "#999", whiteSpace: "nowrap" }}>
                    {Math.round(score)}/100
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.glassCard} style={{ minHeight: 0 }}>
            <p className={styles.cardKicker}>Recommended next steps</p>
            <ul className={styles.list} style={{ marginTop: "0.6rem" }}>
              {RECOMMENDED_STEPS[result.riskLevel].map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>

          <div
            className={styles.ctaCard}
            style={{
              textAlign: "left",
              padding: "clamp(1.5rem, 3vw, 2.2rem)",
              border: result.riskLevel === "High" ? "1px solid hsl(4 72% 45% / 35%)" : undefined,
            }}
          >
            <p className={styles.eyebrow}>
              {result.riskLevel === "High" ? "This is worth acting on" : "Want a second opinion?"}
            </p>
            <h3 className={styles.cardTitle} style={{ fontSize: "1.25rem" }}>
              {result.riskLevel === "High"
                ? "Book a working session before the next busy period."
                : "Talk through the results with us."}
            </h3>
            <p className={styles.cardCopy} style={{ marginBottom: "1.3rem" }}>
              A one-week audit turns this self-assessment into a concrete plan —
              mapping the real workflow and recommending the single highest-value
              starting point.
            </p>
            <div className={styles.actions} style={{ marginTop: 0 }}>
              <Link className={styles.primaryButton} href="/contact">
                Join Waitlist <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

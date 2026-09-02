"use client";

/* ── The audit / waitlist form ───────────────────────────────────────────────
   Same contract as the existing `/api/waitlist` route (fields, honeypot,
   consent, typed funnel events); restyled as underline fields on paper.
   `variant="construction"` is the Vyso Construction waitlist: industry is
   fixed, the free-text prompt asks for a recent variation, copy changes. */

import { useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { Arrow } from "./primitives";

const INDUSTRIES = ["Food & hospitality", "Construction", "Insurance", "Retail & wholesale", "Professional services", "Other"];
const TEAM_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"];
const TRADES = ["Electrical", "HVAC", "Plumbing", "Fire protection", "Civils", "Steel", "Ceilings & partitions", "Other specialist trade"];

type Status = "idle" | "submitting" | "success" | "error";
type Variant = "audit" | "construction";

export function AuditForm({ variant = "audit" }: { variant?: Variant }) {
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const started = useRef(false);
  const construction = variant === "construction";

  const onFirstInput = () => {
    if (!started.current) {
      started.current = true;
      track("waitlist_form_start", {});
    }
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const v = (k: string) => String(data.get(k) ?? "").trim();
    const next: Record<string, string> = {};
    if (!v("name")) next.name = "Your name, please.";
    const email = v("email");
    if (!email) next.email = "A work email to reach you on.";
    else if (!/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(email)) next.email = "That address doesn't look right.";
    if (!v("company")) next.company = "The business name.";
    if (!data.get("consent")) next.consent = "We can only follow up with your consent.";
    setErrors(next);
    if (Object.keys(next).length) {
      track("waitlist_form_failure", { reason: "validation" });
      return;
    }
    setStatus("submitting");
    setServerError(null);
    track("waitlist_form_submit", {});
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: v("name"),
          email,
          company: v("company"),
          industry: construction ? `Construction waitlist · ${v("industry") || "trade unspecified"}` : v("industry"),
          teamSize: v("teamSize"),
          automate: v("automate"),
          website: v("website"),
          consent: true,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setServerError(payload.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        track("waitlist_form_failure", { reason: "server" });
        return;
      }
      setStatus("success");
      track("waitlist_form_success", {});
    } catch {
      setServerError("Network problem. Your details weren't sent. Please try again.");
      setStatus("error");
      track("waitlist_form_failure", { reason: "network" });
    }
  }

  if (status === "success") {
    return (
      <div className="vx-card vx-card-ink" role="status" style={{ padding: 36 }}>
        <p className="vx-eyebrow">Received</p>
        <h2 className="vx-display vx-h3" style={{ marginTop: 16 }}>
          {construction ? "You're on the list." : "Thanks. A person will read it."}
        </h2>
        <p className="vx-small" style={{ marginTop: 16, color: "var(--vx-ondark-2)" }}>
          {construction
            ? "A confirmation is on its way. Josh reads every submission and will reach out personally, usually with one request: walk us through your most recent real variation, from the first instruction to the final payment."
            : "A confirmation is on its way. When a build slot opens we reach out with a couple of sharp questions, then a short conversation about whether a system would genuinely pay for itself."}
        </p>
      </div>
    );
  }

  const err = (k: string) => (errors[k] ? <p className="err" id={`${k}-err`}>{errors[k]}</p> : null);

  return (
    <form className="vx-form" onSubmit={onSubmit} onInput={onFirstInput} noValidate>
      <div className="row">
        <div>
          <label htmlFor="f-name">Name</label>
          <input id="f-name" name="name" className="f" autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-err" : undefined} />
          {err("name")}
        </div>
        <div>
          <label htmlFor="f-email">Work email</label>
          <input id="f-email" name="email" type="email" className="f" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-err" : undefined} />
          {err("email")}
        </div>
      </div>
      <div className="row">
        <div>
          <label htmlFor="f-company">{construction ? "Company" : "Business"}</label>
          <input id="f-company" name="company" className="f" autoComplete="organization" aria-invalid={!!errors.company} aria-describedby={errors.company ? "company-err" : undefined} />
          {err("company")}
        </div>
        <div>
          <label htmlFor="f-industry">{construction ? "Trade" : "Industry"}</label>
          <select id="f-industry" name="industry" className="f" defaultValue="">
            <option value="">Choose</option>
            {(construction ? TRADES : INDUSTRIES).map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="row">
        <div>
          <label htmlFor="f-team">{construction ? "Team size" : "Team size"}</label>
          <select id="f-team" name="teamSize" className="f" defaultValue="">
            <option value="">Choose</option>
            {TEAM_SIZES.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="f-automate">{construction ? "Your most recent variation, in a sentence" : "What eats the hours?"}</label>
        <textarea
          id="f-automate"
          name="automate"
          className="f"
          placeholder={
            construction
              ? "Where it came from, where it stalled, whether it was paid…"
              : "Supplier invoices, chasing debtors, three documents for one delivery…"
          }
        />
      </div>
      <div className="vx-hp" aria-hidden="true">
        <label htmlFor="f-website">Website</label>
        <input id="f-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="consent">
        <input type="checkbox" name="consent" aria-invalid={!!errors.consent} />
        <span>
          Vyso may contact me about this request. Details are used for that and nothing else (POPIA).
          {errors.consent ? <span className="err" style={{ display: "block" }}>{errors.consent}</span> : null}
        </span>
      </label>
      {serverError ? (
        <p className="err" role="alert">
          {serverError}
        </p>
      ) : null}
      <div>
        <button type="submit" className="vx-btn vx-btn-signal" disabled={status === "submitting"} data-cursor="link">
          <span>{status === "submitting" ? "Sending…" : construction ? "Join the waitlist" : "Book the audit"}</span>
          <span className="vx-btn-dot" aria-hidden="true">
            <Arrow />
          </span>
        </button>
      </div>
    </form>
  );
}

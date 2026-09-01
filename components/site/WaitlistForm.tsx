"use client";

/* ── The waitlist form ───────────────────────────────────────────────────────
   The site's one conversion. Client-side validation mirrors the server's
   required set (`app/api/waitlist/route.ts`); errors are associated to their
   fields via aria-describedby; every funnel stage emits a typed analytics
   event. The `website` input is the honeypot — visually hidden, ignored by
   humans, and any value in it makes the server drop the mail silently.

   "Duplicate" handling is honest: with no database there is no server-side
   membership check, so a repeat submission simply succeeds again and
   localStorage remembers this browser already joined — shown as a note, not a
   gate (someone signing up a second business is welcome). */

import { useRef, useState, useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";

const INDUSTRIES = [
  "Food & hospitality",
  "Construction",
  "Insurance",
  "Retail & wholesale",
  "Professional services",
  "Other",
];

const TEAM_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"];

type Status = "idle" | "submitting" | "success" | "error";

const JOINED_KEY = "vy:waitlist-joined";

/* localStorage read as an external store: server snapshot false, so the
   hydration render matches, then the real value applies. The value only
   changes via this form's own success path, which triggers a re-render
   anyway — no subscription needed. */
const noSubscription = () => () => {};
const readJoined = () => {
  try {
    return localStorage.getItem(JOINED_KEY) === "1";
  } catch {
    return false;
  }
};

export function WaitlistForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const alreadyJoined = useSyncExternalStore(noSubscription, readJoined, () => false);
  const startedRef = useRef(false);
  const errorRegionRef = useRef<HTMLParagraphElement>(null);

  const onFirstInput = () => {
    if (!startedRef.current) {
      startedRef.current = true;
      track("waitlist_form_start", {});
    }
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const value = (k: string) => String(data.get(k) ?? "").trim();

    const errors: Record<string, string> = {};
    if (!value("name")) errors.name = "Please tell us your name.";
    const email = value("email");
    if (!email) errors.email = "We need a work email to reach you on.";
    else if (!/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(email))
      errors.email = "That email address doesn't look right.";
    if (!value("company")) errors.company = "Please tell us the business name.";
    if (!data.get("consent")) errors.consent = "We can only follow up with your consent.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      track("waitlist_form_failure", { reason: "validation" });
      errorRegionRef.current?.focus();
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
          name: value("name"),
          email,
          company: value("company"),
          industry: value("industry"),
          teamSize: value("teamSize"),
          automate: value("automate"),
          website: value("website"),
          consent: Boolean(data.get("consent")),
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
      try {
        localStorage.setItem(JOINED_KEY, "1");
      } catch {
        /* fine */
      }
    } catch {
      setServerError("Network problem — your details weren't sent. Please try again.");
      setStatus("error");
      track("waitlist_form_failure", { reason: "network" });
    }
  }

  if (status === "success") {
    return (
      <div className="vy-card p-8" role="status">
        <p className="vy-eyebrow text-signal-deep">You&rsquo;re on the list</p>
        <h2 className="mt-3 text-2xl font-semibold">Thanks — we&rsquo;ve got it.</h2>
        <p className="mt-3 leading-relaxed text-ink-2">
          A confirmation is on its way to your inbox. Here&rsquo;s what happens next: Joshua reads
          every submission personally, and when a build slot opens we&rsquo;ll reach out to talk
          through the work you want automated. No payment, nothing to install, and replying to
          the confirmation email reaches a person directly.
        </p>
      </div>
    );
  }

  const describedBy = (k: string) => (fieldErrors[k] ? `${k}-error` : undefined);

  return (
    <form onSubmit={onSubmit} onInput={onFirstInput} noValidate className="space-y-5">
      {alreadyJoined ? (
        <p className="rounded-xl bg-system-tint px-4 py-3 text-sm text-system-deep">
          It looks like you&rsquo;ve joined from this browser before. Submitting again is fine —
          for example for a second business.
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="wl-name" className="mb-1.5 block text-sm font-medium">
            Your name <span aria-hidden="true">*</span>
          </label>
          <input
            id="wl-name"
            name="name"
            autoComplete="name"
            required
            maxLength={120}
            className="vy-field"
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={describedBy("name")}
          />
          {fieldErrors.name ? (
            <p id="name-error" className="vy-error mt-1.5">
              {fieldErrors.name}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="wl-email" className="mb-1.5 block text-sm font-medium">
            Work email <span aria-hidden="true">*</span>
          </label>
          <input
            id="wl-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            className="vy-field"
            aria-invalid={fieldErrors.email ? true : undefined}
            aria-describedby={describedBy("email")}
          />
          {fieldErrors.email ? (
            <p id="email-error" className="vy-error mt-1.5">
              {fieldErrors.email}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="wl-company" className="mb-1.5 block text-sm font-medium">
            Company <span aria-hidden="true">*</span>
          </label>
          <input
            id="wl-company"
            name="company"
            autoComplete="organization"
            required
            maxLength={160}
            className="vy-field"
            aria-invalid={fieldErrors.company ? true : undefined}
            aria-describedby={describedBy("company")}
          />
          {fieldErrors.company ? (
            <p id="company-error" className="vy-error mt-1.5">
              {fieldErrors.company}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="wl-industry" className="mb-1.5 block text-sm font-medium">
            Industry
          </label>
          <select id="wl-industry" name="industry" className="vy-field" defaultValue="">
            <option value="">Choose one (optional)</option>
            {INDUSTRIES.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="wl-team" className="mb-1.5 block text-sm font-medium">
          Team size <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <select id="wl-team" name="teamSize" className="vy-field sm:max-w-[240px]" defaultValue="">
          <option value="">Choose one</option>
          {TEAM_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="wl-automate" className="mb-1.5 block text-sm font-medium">
          What repetitive work would you most like to automate?
        </label>
        <textarea
          id="wl-automate"
          name="automate"
          maxLength={4000}
          className="vy-field"
          rows={4}
          placeholder="e.g. Capturing supplier invoices and chasing outstanding delivery notes"
        />
      </div>

      {/* Honeypot — hidden from people, tempting to bots. */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="wl-website">Leave this field empty</label>
        <input id="wl-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex items-start gap-3">
        <input
          id="wl-consent"
          name="consent"
          type="checkbox"
          className="mt-1 h-4 w-4 accent-[#BD4A0E]"
          aria-invalid={fieldErrors.consent ? true : undefined}
          aria-describedby={fieldErrors.consent ? "consent-error" : "consent-note"}
        />
        <div>
          <label htmlFor="wl-consent" className="text-sm leading-relaxed">
            Vyso may contact me about the waitlist and my submission.{" "}
            <span aria-hidden="true">*</span>
          </label>
          <p id="consent-note" className="mt-1 text-xs leading-relaxed text-ink-3">
            We use these details only to run the waitlist and follow up with you — never sold,
            never shared, deleted on request (POPIA applies). See our{" "}
            <a href="/privacy" className="underline underline-offset-2">
              privacy policy
            </a>
            .
          </p>
          {fieldErrors.consent ? (
            <p id="consent-error" className="vy-error mt-1.5">
              {fieldErrors.consent}
            </p>
          ) : null}
        </div>
      </div>

      <p ref={errorRegionRef} tabIndex={-1} aria-live="polite" className="vy-error min-h-[1em]">
        {serverError ??
          (Object.keys(fieldErrors).length > 0 ? "Please fix the highlighted fields." : "")}
      </p>

      <button type="submit" className="vy-btn vy-btn-primary w-full sm:w-auto" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Join the waitlist"}
      </button>
    </form>
  );
}

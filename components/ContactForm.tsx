"use client";

import { useState } from "react";

import {
  FindingCardFrame,
  FindingHeader,
  FindingImpact,
  FindingObservation,
} from "@/components/finch/FindingCard";
import { MagneticButton } from "@/components/finch/text/MagneticButton";
import { track } from "@/lib/analytics";

/* ── The form ────────────────────────────────────────────────────────────────
   Three variants over one POST to /api/contact:

   - `audit`   the booking form on /operations-audit#book — adds an optional
               WhatsApp number and a locations count, and asks where the owner
               thinks it leaks. Success renders a finding card, so the first
               thing a new client sees from Finch is the shape of what they
               will get every week.
   - `general` /contact and the older marketing surfaces. The four fields the
               API has always required, nothing else.
   - `academy` the interest form on /academy — Vyso Academy is COMING SOON, so
               this only captures who to write to when the first cohort opens.
               No business name, no challenge — just who, where to reach them,
               and roughly what kind of business. Success renders the same
               finding-card language as `audit`, honest about the fact that
               nothing has been booked yet.

   The extra audit/academy fields are optional on the server, so this component
   can add them without the general variant (or the pages that still render it)
   having to change. Styling is the Finch language throughout — the `--fn-*`
   tokens are declared on `:root`, so they resolve on the old-design pages too. */

type Status = "idle" | "loading" | "success" | "error";

export type ContactFormVariant = "audit" | "general" | "academy";

const INITIAL_STATE = {
  name: "",
  business: "",
  email: "",
  challenge: "",
  whatsapp: "",
  locations: "1",
  businessType: "",
};

const LOCATION_OPTIONS = ["1", "2–3", "4+"] as const;

/* The vocabulary already used by the site's verticals (`.ai/vyso_v2.md` §2.2) —
   nothing invented here, just the same six primary verticals plus "Other" so
   the field never blocks a real signup. */
const BUSINESS_TYPE_OPTIONS = [
  "Food supplier",
  "Farm",
  "Restaurant",
  "Catering company",
  "Wholesale",
  "Hospitality",
  "Other",
] as const;

const FIELD =
  "w-full rounded-[8px] border border-fn-line bg-fn-surface px-[14px] py-[11px] text-[14.5px] text-fn-ink " +
  "placeholder:text-fn-faint outline-none transition-[border-color,box-shadow] duration-200 " +
  "focus:border-fn-line-hover focus:shadow-[0_0_0_3px_#C9DEF7]";

const LABEL = "mb-[6px] block text-[12.5px] font-medium text-fn-ink-2";

const HINT = "mt-[6px] text-[12px] text-fn-muted";

export default function ContactForm({
  variant = "general",
  onSuccess,
}: {
  variant?: ContactFormVariant;
  /** Fires once, after a successful submit. Optional — only `/academy` uses
      it today, to fill a seat in `SeatGrid` when interest is registered. */
  onSuccess?: () => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setError] = useState("");
  const [fields, setFields] = useState(INITIAL_STATE);

  const isAudit = variant === "audit";
  const isAcademy = variant === "academy";

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setFields((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    // Only the audit variant sends every field; academy sends its own small
    // set (no business name, no challenge — nothing to book yet); the route
    // treats all of it as optional beyond name/email, so the general payload
    // is byte-for-byte what it always was.
    const data = isAudit
      ? { ...fields, variant }
      : isAcademy
        ? { name: fields.name, email: fields.email, businessType: fields.businessType, variant }
        : {
            name: fields.name,
            business: fields.business,
            email: fields.email,
            challenge: fields.challenge,
            variant,
          };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Something went wrong. Please try again.");
      }

      setStatus("success");
      track("audit_form_submit", { variant });
      onSuccess?.();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    if (isAudit) {
      return (
        <FindingCardFrame state="new" className="max-w-none">
          <FindingHeader agent="AUDIT" state="new" />
          <FindingObservation>
            Your audit request landed. We&rsquo;ll reply within one business day to confirm the week.
          </FindingObservation>
          <FindingImpact>A week from now you&rsquo;ll know where the money goes.</FindingImpact>
        </FindingCardFrame>
      );
    }

    if (isAcademy) {
      return (
        <FindingCardFrame state="new" className="max-w-none">
          <FindingHeader agent="ACADEMY" state="new" />
          <FindingObservation>Interest noted.</FindingObservation>
          <FindingImpact>We&rsquo;ll write when the first cohort opens.</FindingImpact>
        </FindingCardFrame>
      );
    }

    return (
      <div className="py-[24px]">
        <div className="mb-[10px] font-fn-mono text-[10.5px] tracking-[0.14em] text-fn-muted">
          MESSAGE RECEIVED
        </div>
        <h3 className="m-0 mb-[10px] font-fn-serif text-[24px] font-medium tracking-[-0.02em]">
          Thanks — that came through.
        </h3>
        <p className="m-0 mb-[20px] max-w-[420px] text-[15px] leading-[1.6] text-fn-ink-3 text-pretty">
          We&rsquo;ll reply within one business day. There&rsquo;s a confirmation in your inbox with a
          link to book a 15-minute call if you would rather talk sooner.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setFields(INITIAL_STATE);
            setError("");
          }}
          className="cursor-pointer text-[13.5px] font-medium text-fn-ink-2 transition-colors duration-150 hover:text-fn-orange-deep"
        >
          Send another message <span aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[16px]">
      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
        <div>
          <label htmlFor="name" className={LABEL}>
            Your name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Thandi Nkosi"
            value={fields.name}
            onChange={handleChange}
            required
            className={FIELD}
          />
        </div>
        {isAcademy ? (
          <div>
            <label htmlFor="businessType" className={LABEL}>
              Business type
            </label>
            <select
              id="businessType"
              name="businessType"
              value={fields.businessType}
              onChange={handleChange}
              required
              className={FIELD + " cursor-pointer appearance-none"}
            >
              <option value="" disabled>
                Select one
              </option>
              {BUSINESS_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor="business" className={LABEL}>
              Business name
            </label>
            <input
              id="business"
              name="business"
              type="text"
              autoComplete="organization"
              placeholder="Fresh Produce Co"
              value={fields.business}
              onChange={handleChange}
              required
              className={FIELD}
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="email" className={LABEL}>
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@yourbusiness.co.za"
          value={fields.email}
          onChange={handleChange}
          required
          className={FIELD}
        />
      </div>

      {isAudit ? (
        <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
          <div>
            <label htmlFor="whatsapp" className={LABEL}>
              WhatsApp number <span className="font-normal text-fn-muted">(optional)</span>
            </label>
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="082 000 0000"
              value={fields.whatsapp}
              onChange={handleChange}
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="locations" className={LABEL}>
              Number of locations
            </label>
            <select
              id="locations"
              name="locations"
              value={fields.locations}
              onChange={handleChange}
              className={FIELD + " cursor-pointer appearance-none"}
            >
              {LOCATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      {isAcademy ? null : (
        <div>
          <label htmlFor="challenge" className={LABEL}>
            {isAudit
              ? "Where do you think it leaks?"
              : "What is your biggest operational challenge?"}
          </label>
          <textarea
            id="challenge"
            name="challenge"
            placeholder={
              isAudit
                ? "Supplier prices creeping, stock going missing, debtors running late — a sentence is enough."
                : "Tell us what is breaking down — stock, wastage, suppliers, or no view of your margins."
            }
            value={fields.challenge}
            onChange={handleChange}
            rows={isAudit ? 4 : 5}
            required
            className={FIELD + " resize-none leading-[1.6]"}
          />
          {isAudit ? (
            <p className={HINT}>A guess is fine. The audit is what turns it into a number.</p>
          ) : null}
        </div>
      )}

      {status === "error" ? (
        <p className="m-0 text-[13px] text-fn-orange-deep" role="alert">
          {errorMsg}
        </p>
      ) : null}

      {/* §4.5's magnetic CTA. The submit is the one button on `/operations-
          audit` that ends the page's argument, so it gets the pull — at 6px
          rather than 10, because this button is full-width and flush with the
          card's padding, where the full 10 reads as a misaligned edge instead
          of as magnetism. Off on touch, under reduced motion, and while the
          POST is in flight (`MagneticButton` gates all three). */}
      <MagneticButton
        type="submit"
        disabled={status === "loading"}
        pull={6}
        /* No `min-h-*` here: `MagneticButton`'s own base sets one, and two
           arbitrary Tailwind values for the same property resolve by stylesheet
           order rather than by the order they are written. */
        className={
          "w-full " +
          (status === "loading" ? "cursor-not-allowed opacity-70" : "cursor-pointer")
        }
      >
        {status === "loading"
          ? "Sending…"
          : isAudit
            ? "Book your audit"
            : isAcademy
              ? "Register interest"
              : "Send"}
      </MagneticButton>

      <p className="m-0 text-center text-[12px] text-fn-muted">
        {isAudit
          ? "R2,000, credited to your first month. We confirm the start date when you book."
          : isAcademy
            ? "No payment now — just interest. We'll write when the first cohort opens."
            : "We reply within one business day."}
      </p>
    </form>
  );
}

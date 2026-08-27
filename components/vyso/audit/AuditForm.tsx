"use client";

import { useState } from "react";

import { Pill } from "@/components/vyso/Card";
import { track } from "@/lib/analytics";

/* ── The audit booking form, on the `--vy-*` system ──────────────────────────
   Same endpoint, same field names, same `variant: "audit"` payload as
   `components/ContactForm.tsx`. Nothing about `/api/contact` changes, and the
   old form keeps working everywhere it is still mounted.

   ── Why this is a second form and not a wrapper around the old one ──────────
   Phase 2a's brief was to restyle `ContactForm`'s audit variant by wrapping it,
   and to build this only if the styling clashed irreparably. It does, in three
   ways that a wrapper cannot reach because they are inside the component:

   1. Its submit is `components/finch/text/MagneticButton`, which pulls toward
      the pointer. Plan §4 rules magnetic CTAs off the new surface by name.
   2. Every input is painted in `--fn-*` (8px radius, a blue focus ring at
      `#C9DEF7`). The new system has one radius, one focus colour and no blue.
   3. Its success state renders `components/finch/FindingCard`, the Finch card
      with the pointer tilt, not `components/vyso/demo/FindingCard`.

   A wrapper can only reach the first of those with a descendant selector that
   overrides a component's internals from outside, which is the kind of fix that
   breaks silently the next time either file moves. Editing `ContactForm`
   itself was not an option: `/contact`, `/academy` and the Orbit waitlist all
   render it, and two of those are another agent's files this phase.

   ── Five fields ─────────────────────────────────────────────────────────────
   Name, business, email, WhatsApp (optional), and the one real question. The
   old audit variant had a sixth, a "number of locations" select, and it is
   gone: it exists because pricing used to be per location, which plan §2
   retires from the public site entirely. It is optional on the server, so
   dropping it changes nothing about the request.

   The dev gate (plan §9) means a local submit logs a redacted line and returns
   success without sending mail, so this form is safe to exercise during QA. */

type Status = "idle" | "loading" | "success" | "error";

const INITIAL = {
  name: "",
  business: "",
  email: "",
  whatsapp: "",
  challenge: "",
};

const FIELD =
  "w-full rounded-[var(--vy-radius)] border border-[color:var(--vy-line-2)] bg-[color:var(--vy-surface)] " +
  "px-[14px] py-[11px] text-[14.5px] text-[color:var(--vy-ink)] " +
  "placeholder:text-[color:var(--vy-ink-3)] outline-none transition-colors duration-150 " +
  "hover:border-[color:var(--vy-ink-4)] " +
  "focus-visible:border-[color:var(--vy-ink-3)] focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vy-focus)]";

const LABEL = "mb-[6px] block text-[12.5px] font-medium text-[color:var(--vy-ink-2)]";

export function AuditForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fields, setFields] = useState(INITIAL);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => setFields((f) => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, variant: "audit" }),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error || "Something went wrong. Please try again.");
      }

      setStatus("success");
      track("audit_form_submit", { variant: "audit" });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <div className="py-[16px]" role="status">
        <Pill>Request received</Pill>
        <h3 className="vy-h3 mt-[16px] text-[color:var(--vy-ink)]">
          That came through. Thank you.
        </h3>
        <p className="vy-body mt-[10px] text-[color:var(--vy-ink-3)] text-pretty">
          We reply within one business day to confirm a time. The audit is about an hour, and
          there is nothing to prepare or send us first.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[16px]">
      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
        <div>
          <label htmlFor="audit-name" className={LABEL}>
            Your name
          </label>
          <input
            id="audit-name"
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
        <div>
          <label htmlFor="audit-business" className={LABEL}>
            Business name
          </label>
          <input
            id="audit-business"
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
      </div>

      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
        <div>
          <label htmlFor="audit-email" className={LABEL}>
            Email address
          </label>
          <input
            id="audit-email"
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
        <div>
          <label htmlFor="audit-whatsapp" className={LABEL}>
            WhatsApp number{" "}
            <span className="font-normal text-[color:var(--vy-ink-3)]">(optional)</span>
          </label>
          <input
            id="audit-whatsapp"
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
      </div>

      <div>
        <label htmlFor="audit-challenge" className={LABEL}>
          Where do you think it leaks?
        </label>
        <textarea
          id="audit-challenge"
          name="challenge"
          placeholder="Supplier prices creeping, stock going missing, debtors running late. A sentence is enough."
          value={fields.challenge}
          onChange={handleChange}
          rows={4}
          required
          className={FIELD + " resize-none leading-[1.6]"}
        />
        <p className="vy-small mt-[7px] text-[color:var(--vy-ink-3)]">
          A guess is fine. Finding out is what the audit is for.
        </p>
      </div>

      {status === "error" ? (
        <p className="vy-small m-0 text-[color:var(--vy-accent-ink)]" role="alert">
          {errorMsg}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "loading"}
        className={
          "inline-flex w-full items-center justify-center rounded-[var(--vy-radius)] " +
          "bg-[color:var(--vy-ink)] px-[24px] py-[14px] text-[15px] font-medium " +
          "text-[color:var(--vy-bg)] transition-colors duration-150 " +
          "hover:bg-[color:var(--vy-ink-2)] focus-visible:outline focus-visible:outline-2 " +
          "focus-visible:outline-offset-2 focus-visible:outline-[color:var(--vy-focus)] " +
          (status === "loading" ? "cursor-not-allowed opacity-70" : "cursor-pointer")
        }
      >
        {status === "loading" ? "Sending" : "Book your free audit"}
      </button>

      <p className="vy-small m-0 text-center text-[color:var(--vy-ink-3)]">
        Free, about an hour, no obligation. We confirm the time when you book.
      </p>
    </form>
  );
}

export default AuditForm;

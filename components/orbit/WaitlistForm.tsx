"use client";

import { useState } from "react";

import { MagneticButton } from "@/components/finch/text/MagneticButton";
import { track } from "@/lib/analytics";
import { ORBIT } from "@/lib/orbit/site";
import { TRADES } from "@/lib/orbit/trades";

/* ── The waitlist form ───────────────────────────────────────────────────────
   Five fields, two of them required, posting to the existing `/api/contact`
   with `variant: "orbit"`. It is the only form on the subsite and the only
   thing on it that talks to a server.

   ── Why WhatsApp is required and email is not ───────────────────────────────
   Because the product is a WhatsApp product and the promise on the button is
   that we WhatsApp you when it opens. A tradesperson without an email address
   is the exact person Orbit is for, and a form that turns them away to collect
   a channel we are not going to use would be collecting it for our own
   convenience. `/api/contact` was extended for this — see the `isOrbit` branch
   there — rather than a second mail-sending endpoint being added.

   ── What is not collected ───────────────────────────────────────────────────
   No company name, no address, no "how many staff", no budget question. The
   list exists to tell people when Orbit opens; anything beyond that is a sales
   qualification form wearing a waitlist's clothes.

   ── Analytics ───────────────────────────────────────────────────────────────
   One event on success, carrying the **trade slug only** — a value from this
   closed list, never anything the visitor typed. `lib/analytics.ts` opens with
   that rule and this is the newest place it applies.                           */

type Status = "idle" | "loading" | "success" | "error";

const INITIAL = { name: "", trade: "", whatsapp: "", email: "", city: "" };

const FIELD =
  "w-full rounded-[9px] border border-ob-line bg-ob-bg px-[14px] py-[12px] text-[15px] text-ob-text " +
  "placeholder:text-ob-mono transition-colors duration-150 focus:border-ob-blue focus:outline-none";

const LABEL = "mb-[7px] block text-[13px] font-medium text-ob-text-2";

export function WaitlistForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [fields, setFields] = useState(INITIAL);

  const set = (key: keyof typeof INITIAL) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setError("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, variant: "orbit" }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      track("orbit_waitlist_submit", { trade: fields.trade || "unspecified" });
      setStatus("success");
    } catch {
      setError("Could not reach the server. Please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="rounded-[12px] border border-ob-line bg-ob-surface px-[22px] py-[28px]"
      >
        <p className="m-0 mb-[10px] font-fn-serif text-[26px] font-medium leading-[1.2] tracking-[-0.02em] text-ob-text">
          You&rsquo;re on the list.
        </p>
        <p className="m-0 text-[15px] leading-[1.65] text-ob-text-2">
          We WhatsApp you when Orbit opens. Nothing else — no newsletter, no sales call, and
          nothing to pay until you decide to start.
        </p>
        <p className="m-0 mt-[14px] font-fn-mono text-[10.5px] tracking-[0.1em] text-ob-mono uppercase">
          Founding pricing locked · {ORBIT.price.display} / month
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate={false} className="flex flex-col gap-[16px]">
      <div>
        <label htmlFor="orbit-name" className={LABEL}>
          Your name <span className="text-fn-orange-on-ink">*</span>
        </label>
        <input
          id="orbit-name"
          name="name"
          type="text"
          required
          maxLength={120}
          autoComplete="name"
          value={fields.name}
          onChange={set("name")}
          className={FIELD}
          placeholder="Sipho Dlamini"
        />
      </div>

      <div>
        <label htmlFor="orbit-trade" className={LABEL}>
          Your trade <span className="text-fn-orange-on-ink">*</span>
        </label>
        <select
          id="orbit-trade"
          name="trade"
          required
          value={fields.trade}
          onChange={set("trade")}
          /* `appearance-none` kills the native arrow, so the affordance is
             drawn back as a background chevron — a select that looks like a
             text input is a control nobody clicks. */
          className={FIELD + " appearance-none bg-[length:11px] bg-[right_14px_center] bg-no-repeat pr-[36px]"}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7' fill='none'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%2393A3C2' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
          }}
        >
          <option value="">Choose one</option>
          {TRADES.map((trade) => (
            <option key={trade.slug} value={trade.slug}>
              {trade.name}
            </option>
          ))}
          <option value="other">Something else</option>
        </select>
      </div>

      <div>
        <label htmlFor="orbit-whatsapp" className={LABEL}>
          WhatsApp number <span className="text-fn-orange-on-ink">*</span>
        </label>
        <input
          id="orbit-whatsapp"
          name="whatsapp"
          type="tel"
          required
          maxLength={40}
          autoComplete="tel"
          inputMode="tel"
          value={fields.whatsapp}
          onChange={set("whatsapp")}
          className={FIELD}
          placeholder="082 000 0000"
        />
        <p className="m-0 mt-[7px] text-[12.5px] leading-[1.5] text-ob-mono">
          This is how we tell you Orbit is open. Nothing else is sent to it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2">
        <div>
          <label htmlFor="orbit-email" className={LABEL}>
            Email <span className="text-ob-mono">(optional)</span>
          </label>
          <input
            id="orbit-email"
            name="email"
            type="email"
            maxLength={254}
            autoComplete="email"
            value={fields.email}
            onChange={set("email")}
            className={FIELD}
            placeholder="you@example.co.za"
          />
        </div>
        <div>
          <label htmlFor="orbit-city" className={LABEL}>
            Town or city <span className="text-ob-mono">(optional)</span>
          </label>
          <input
            id="orbit-city"
            name="city"
            type="text"
            maxLength={80}
            autoComplete="address-level2"
            value={fields.city}
            onChange={set("city")}
            className={FIELD}
            placeholder="Johannesburg"
          />
        </div>
      </div>

      {status === "error" ? (
        <p role="alert" className="m-0 rounded-[9px] border border-fn-orange/45 bg-fn-orange/[0.08] px-[14px] py-[11px] text-[13.5px] text-fn-orange-on-ink">
          {error}
        </p>
      ) : null}

      <MagneticButton
        type="submit"
        tone="dark"
        disabled={status === "loading"}
        className="mt-[4px] w-full text-[16px] sm:w-auto"
      >
        {status === "loading" ? "Adding you…" : ORBIT.waitlistCta}
      </MagneticButton>

      <p className="m-0 text-[12.5px] leading-[1.6] text-ob-mono">
        Free, and it commits you to nothing. Founding pricing is locked for the people on the
        list. We do not sell or share what you enter here.
      </p>
    </form>
  );
}

export default WaitlistForm;

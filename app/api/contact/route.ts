import { Resend } from "resend";
import { NextResponse } from "next/server";
import { rateLimitAllowed } from "@/lib/platform/rate-limit";

const resend = new Resend(process.env.RESEND_API_KEY);

const RECIPIENT = "joshua@vyso.co.za";
const CALENDLY_LINK = "https://calendly.com/joshua-vyso/new-meeting";

/**
 * Public contact form. It sends mail from Vyso's own SPF/DKIM-aligned domain — an
 * internal notification AND an auto-reply to the submitter — so every input is hostile
 * until proven otherwise:
 *
 *  - Escape all interpolated fields. The auto-reply goes to a caller-supplied address, so
 *    unescaped markup would let anyone deliver phishing content FROM joshua@vyso.co.za to
 *    a victim of their choosing.
 *  - Validate the email is one well-formed address (no arrays, no CRLF header injection)
 *    and cap every field, so the form can't be turned into a mail relay.
 *  - Best-effort per-IP rate limit to blunt a flood. (In-memory, so it resets per
 *    instance — a real limiter needs a shared store; this is a stopgap, not the ceiling.)
 */

/* `whatsapp`, `locations` and `variant` are the audit booking form's extra
   fields (components/ContactForm.tsx); `businessType` is the academy interest
   form's (same file, `variant: "academy"`). All are optional: the general
   variant and every older caller omit them, and the required set is unchanged
   except that the academy variant does not send — and so does not require —
   `business` or `challenge` (see the check below). They are capped and
   escaped like everything else — `whatsapp` is a free-text phone number, so
   it is treated as hostile input, not validated into a shape that would
   reject a legitimate "+27 82 000 0000"; `businessType` is a value from a
   fixed `<select>`, but is still capped/escaped like any other string field
   since nothing stops a direct POST from sending something else.

   `trade` and `city` are the Orbit waitlist's own two extra fields
   (components/orbit/WaitlistForm.tsx, `variant: "orbit"`). That variant is the
   only one where **`email` is optional and `whatsapp` is required**, because
   Orbit is a WhatsApp product and the promise on its button is that we WhatsApp
   you when it opens — a tradesperson with no email address is exactly who it is
   for. Everything else about this handler is unchanged: the Finch variants keep
   their required set, their subject lines and their auto-reply. */
const MAX_LEN: Record<string, number> = {
  name: 120,
  business: 160,
  email: 254,
  challenge: 4000,
  tier: 60,
  whatsapp: 40,
  locations: 20,
  variant: 20,
  businessType: 60,
  trade: 60,
  city: 80,
};
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Max submissions per IP per 10-minute window (durable, fleet-wide — see rate-limit.ts).
const RATE_MAX = 5;
const RATE_WINDOW_SECONDS = 10 * 60;

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
    if (!(await rateLimitAllowed(`contact:${ip}`, RATE_MAX, RATE_WINDOW_SECONDS))) {
      return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const field = (k: string): string => (typeof body[k] === "string" ? (body[k] as string).trim() : "");

    const name = field("name");
    const business = field("business");
    const email = field("email");
    const challenge = field("challenge");
    const tier = field("tier");
    const whatsapp = field("whatsapp");
    const locations = field("locations");
    const variant = field("variant");
    const businessType = field("businessType");
    const trade = field("trade");
    const city = field("city");

    const isAudit = variant === "audit";
    const isAcademy = variant === "academy";
    const isOrbit = variant === "orbit";

    // Academy sends nothing to book — just name + email (+ businessType) — so
    // `business`/`challenge` are only required for the other two variants.
    // Orbit sends name + whatsapp (+ trade/city/email), so it requires neither
    // `business`/`challenge` nor an email address.
    const missing = isOrbit
      ? !name || !whatsapp
      : !name || !email || (!isAcademy && (!business || !challenge));
    if (missing) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    for (const [k, v] of Object.entries({
      name,
      business,
      email,
      challenge,
      tier,
      whatsapp,
      locations,
      variant,
      businessType,
      trade,
      city,
    })) {
      if (v.length > MAX_LEN[k]) {
        return NextResponse.json({ error: `${k} is too long.` }, { status: 400 });
      }
    }
    // `email` is required everywhere except the Orbit waitlist, so an empty
    // string only reaches here on that variant — and an absent address is not
    // an invalid one.
    if (email && !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    // Header-safe versions for the subject line (strip CR/LF so nothing can smuggle a
    // header even if a provider ever passed the value through unencoded).
    const sName = name.replace(/[\r\n]+/g, " ");
    const sBusiness = business.replace(/[\r\n]+/g, " ");

    // Everything below is escaped: safe to interpolate into HTML.
    const eName = escapeHtml(name);
    const eBusiness = escapeHtml(business);
    const eEmail = escapeHtml(email);
    const eTier = escapeHtml(tier);
    const eChallenge = escapeHtml(challenge).replace(/\n/g, "<br>");
    const tierLine = tier && tier !== "Not sure" ? `<strong>Tier interest:</strong> ${eTier}<br>` : "";
    const whatsappLine = whatsapp ? `<p><strong>WhatsApp:</strong> ${escapeHtml(whatsapp)}</p>` : "";
    const locationsLine = locations ? `<p><strong>Locations:</strong> ${escapeHtml(locations)}</p>` : "";
    // Academy sends no business name — only a business type from the select —
    // so the "Business:" line becomes conditional rather than always printing
    // an empty value, and businessType gets its own line when present.
    const businessLine = eBusiness ? `<p><strong>Business:</strong> ${eBusiness}</p>` : "";
    const businessTypeLine = businessType
      ? `<p><strong>Business type:</strong> ${escapeHtml(businessType)}</p>`
      : "";
    const tradeLine = trade ? `<p><strong>Trade:</strong> ${escapeHtml(trade)}</p>` : "";
    const cityLine = city ? `<p><strong>Town/city:</strong> ${escapeHtml(city)}</p>` : "";
    // The challenge field is the audit form's "where do you think it leaks?" —
    // same field, different question, so the internal email says which it was.
    // Academy never sends one, so the whole block is conditional.
    const challengeLabel = isAudit ? "Where they think it leaks:" : "Operational challenge:";
    const challengeBlock = challenge
      ? `
            <p style="margin-top: 16px;"><strong>${challengeLabel}</strong></p>
            <blockquote style="border-left: 3px solid #10b981; padding-left: 12px; color: #374151; margin: 8px 0;">
              ${eChallenge}
            </blockquote>`
      : "";
    const kind = isAudit
      ? "audit request"
      : isAcademy
        ? "Academy interest"
        : isOrbit
          ? "Orbit waitlist"
          : "enquiry";

    // Notify Joshua
    const notify = resend.emails.send({
        from: "Vyso Website <noreply@vyso.co.za>",
        to: RECIPIENT,
        subject: `New ${kind} from ${sName}${sBusiness ? ` — ${sBusiness}` : ""}`.slice(0, 200),
        html: `
          <div style="font-family: sans-serif; max-width: 600px; color: #111;">
            <h2 style="margin-bottom: 4px;">New ${kind} via vyso.co.za</h2>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            <p><strong>Name:</strong> ${eName}</p>
            ${businessLine}
            ${eEmail ? `<p><strong>Email:</strong> <a href="mailto:${eEmail}">${eEmail}</a></p>` : ""}
            ${whatsappLine}
            ${locationsLine}
            ${businessTypeLine}
            ${tradeLine}
            ${cityLine}
            ${tierLine}
            ${challengeBlock}
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #6b7280; font-size: 13px;">Sent from the Vyso contact form.</p>
          </div>
        `,
    });

    /* ── The auto-reply ──────────────────────────────────────────────────────
       Two conditions, both introduced with the Orbit waitlist:

       1. **It needs an address.** `email` is optional on the Orbit form, and
          there is nothing to reply to without one. The internal notification
          above still goes out — the WhatsApp number is the contact channel.
       2. **It has to be the right reply.** The standing auto-reply offers a
          15-minute call about Vyso's operations work, which is the wrong thing
          to send someone who has just joined a waitlist for a product that has
          not opened. Orbit gets a shorter one that promises exactly what the
          form promised and nothing else — no call, no Calendly link, no
          "within 24 hours". */
    const orbitReply = () =>
      resend.emails.send({
        from: "Joshua at Vyso <joshua@vyso.co.za>",
        to: email,
        subject: "You're on the Orbit waitlist",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; color: #111;">
            <h2 style="margin-bottom: 4px;">You're on the list, ${eName}.</h2>
            <p style="color: #374151; line-height: 1.6;">
              Orbit is WhatsApp operations for South African tradespeople — you text what you did
              and what you charged, and it tracks the job and drafts the invoice.
            </p>
            <p style="color: #374151; line-height: 1.6;">
              It is still being built, so there is nothing to log into yet and nothing to pay.
              We'll WhatsApp you when it opens, and founding pricing is locked for the people on
              the list.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #6b7280; font-size: 13px;">
              Joshua Moreira<br>
              Vyso — Johannesburg<br>
              <a href="mailto:joshua@vyso.co.za" style="color: #BE5D23;">joshua@vyso.co.za</a>
              &nbsp;·&nbsp;
              <a href="https://vyso.co.za/orbit" style="color: #BE5D23;">vyso.co.za/orbit</a>
            </p>
          </div>
        `,
      });

    const standardReply = () =>
      resend.emails.send({
        from: "Joshua at Vyso <joshua@vyso.co.za>",
        to: email,
        subject: "Got your message — here's how to book a call",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; color: #111;">
            <h2 style="margin-bottom: 4px;">Thanks, ${eName} — we've received your enquiry.</h2>
            <p style="color: #374151; line-height: 1.6;">
              I'll personally read through what you've shared and get back to you within 24 hours.
            </p>
            <p style="color: #374151; line-height: 1.6;">
              In the meantime, if you'd like to jump straight in, you can book a free 15-minute
              call at a time that suits you:
            </p>
            <div style="margin: 24px 0;">
              <a
                href="${CALENDLY_LINK}"
                style="
                  display: inline-block;
                  background-color: #BE5D23;
                  color: #fff;
                  text-decoration: none;
                  padding: 12px 24px;
                  border-radius: 6px;
                  font-weight: 600;
                  font-size: 15px;
                "
              >
                Book a 15-minute call →
              </a>
            </div>
            <p style="color: #374151; line-height: 1.6;">
              It's a no-pressure conversation — we'll listen to what's breaking down in your
              ops and tell you honestly how Vyso can help.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #6b7280; font-size: 13px;">
              Joshua Moreira<br>
              Vyso — AI-Powered Operations for SMEs<br>
              <a href="mailto:joshua@vyso.co.za" style="color: #BE5D23;">joshua@vyso.co.za</a>
              &nbsp;·&nbsp;
              <a href="https://vyso.co.za" style="color: #BE5D23;">vyso.co.za</a>
            </p>
          </div>
        `,
      });

    await Promise.all(email ? [notify, isOrbit ? orbitReply() : standardReply()] : [notify]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 }
    );
  }
}

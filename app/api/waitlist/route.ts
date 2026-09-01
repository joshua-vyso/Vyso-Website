import { Resend } from "resend";
import { NextResponse } from "next/server";
import { rateLimitAllowed } from "@/lib/platform/rate-limit";

const resend = new Resend(process.env.RESEND_API_KEY);

const RECIPIENT = "joshua@vyso.co.za";

/**
 * The waitlist — the site's one conversion goal (agency redesign 2026-09).
 * Same hostile-input posture as `app/api/contact/route.ts`, which this handler
 * is modelled on: every field capped and escaped, one well-formed email only
 * (no CRLF smuggling), per-IP rate limit, and an auto-reply that promises
 * exactly what the form promised — a reply from a person — with no invented
 * queue numbers or scarcity.
 *
 * Spam: a honeypot field (`website`) that humans never see; bots that fill it
 * get a 200 with no mail sent, so they learn nothing.
 *
 * There is deliberately no database write — submissions live in the
 * joshua@vyso.co.za inbox like every other form on this site. If a durable
 * store is wanted later it needs a Supabase table Josh creates by hand (house
 * rule: all SQL pasted by Josh), and this handler gains one insert.
 */

const MAX_LEN: Record<string, number> = {
  name: 120,
  email: 254,
  company: 160,
  industry: 60,
  teamSize: 30,
  automate: 4000,
  website: 200,
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

const RATE_MAX = 5;
const RATE_WINDOW_SECONDS = 10 * 60;

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim();
    if (!(await rateLimitAllowed(`waitlist:${ip}`, RATE_MAX, RATE_WINDOW_SECONDS))) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again in a few minutes." },
        { status: 429 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const field = (k: string): string => (typeof body[k] === "string" ? (body[k] as string).trim() : "");

    const name = field("name");
    const email = field("email");
    const company = field("company");
    const industry = field("industry");
    const teamSize = field("teamSize");
    const automate = field("automate");
    const website = field("website"); // honeypot
    const consent = body.consent === true;

    // Honeypot tripped: pretend success, send nothing.
    if (website) {
      return NextResponse.json({ success: true });
    }

    if (!name || !email || !company || !consent) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }
    for (const [k, v] of Object.entries({ name, email, company, industry, teamSize, automate, website })) {
      if (v.length > MAX_LEN[k]) {
        return NextResponse.json({ error: `${k} is too long.` }, { status: 400 });
      }
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid work email address." }, { status: 400 });
    }

    const sName = name.replace(/[\r\n]+/g, " ");
    const sCompany = company.replace(/[\r\n]+/g, " ");

    const eName = escapeHtml(name);
    const eEmail = escapeHtml(email);
    const eCompany = escapeHtml(company);
    const eIndustry = escapeHtml(industry);
    const eTeamSize = escapeHtml(teamSize);
    const eAutomate = escapeHtml(automate).replace(/\n/g, "<br>");

    const notify = resend.emails.send({
      from: "Vyso Website <noreply@vyso.co.za>",
      to: RECIPIENT,
      subject: `Waitlist: ${sName} — ${sCompany}`.slice(0, 200),
      html: `
        <div style="font-family: sans-serif; max-width: 600px; color: #111;">
          <h2 style="margin-bottom: 4px;">New waitlist signup via vyso.co.za</h2>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
          <p><strong>Name:</strong> ${eName}</p>
          <p><strong>Email:</strong> <a href="mailto:${eEmail}">${eEmail}</a></p>
          <p><strong>Company:</strong> ${eCompany}</p>
          ${eIndustry ? `<p><strong>Industry:</strong> ${eIndustry}</p>` : ""}
          ${eTeamSize ? `<p><strong>Team size:</strong> ${eTeamSize}</p>` : ""}
          ${
            eAutomate
              ? `
          <p style="margin-top: 16px;"><strong>What they most want to automate:</strong></p>
          <blockquote style="border-left: 3px solid #FF7727; padding-left: 12px; color: #374151; margin: 8px 0;">
            ${eAutomate}
          </blockquote>`
              : ""
          }
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 13px;">Consent to be contacted: yes (required to submit).</p>
        </div>
      `,
    });

    const reply = resend.emails.send({
      from: "Joshua at Vyso <joshua@vyso.co.za>",
      to: email,
      subject: "You're on the Vyso waitlist",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; color: #111;">
          <h2 style="margin-bottom: 4px;">You're on the list, ${eName}.</h2>
          <p style="color: #374151; line-height: 1.6;">
            Thanks for telling us about ${eCompany}. Here's what happens next: I read every
            submission personally, and when a build slot opens we reach out to talk through the
            repetitive work you want off your team's plate — no obligation, no payment, and
            nothing to install in the meantime.
          </p>
          <p style="color: #374151; line-height: 1.6;">
            If something changes on your side, just reply to this email — it comes straight to me.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
          <p style="color: #6b7280; font-size: 13px;">
            Joshua Moreira<br>
            Vyso — AI automation agency, Johannesburg<br>
            <a href="mailto:joshua@vyso.co.za" style="color: #BD4A0E;">joshua@vyso.co.za</a>
            &nbsp;·&nbsp;
            <a href="https://vyso.co.za" style="color: #BD4A0E;">vyso.co.za</a>
          </p>
        </div>
      `,
    });

    await Promise.all([notify, reply]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Waitlist form error:", err);
    return NextResponse.json(
      { error: "Something went wrong sending your details. Please try again." },
      { status: 500 },
    );
  }
}

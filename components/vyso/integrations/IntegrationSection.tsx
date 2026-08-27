import Image from "next/image";

import type { IntegrationDetail } from "@/lib/marketing/integrations";
import { Pill } from "@/components/vyso/Card";

/* ── One tool, told honestly ──────────────────────────────────────────────────
   The eleven marks in `public/finch/integrations/` cover every tool in the
   roster except the two this page adds directly (`excel`, `google-sheets`,
   see `lib/marketing/integrations.ts`'s header) — those get a mono monogram
   instead of a missing image, the same fallback `ChromeFrame`'s WhatsApp
   avatar uses for the same reason: an absent asset should read as furniture,
   not as a broken image. */

const HAS_LOGO = new Set([
  "xero",
  "whatsapp",
  "yoco",
  "sage",
  "loyverse",
  "quickbooks",
  "gmail",
  "outlook",
  "notion",
  "n8n",
  "simplepay",
]);

function Mark({ slug, name }: { slug: string; name: string }) {
  if (HAS_LOGO.has(slug)) {
    return (
      <Image
        src={`/finch/integrations/${slug}.svg`}
        alt=""
        width={28}
        height={28}
        className="h-[28px] w-[28px] object-contain"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-[28px] w-[28px] items-center justify-center rounded-[8px] bg-[color:var(--vy-surface-2)] text-[12px] font-medium text-[color:var(--vy-ink-3)]"
    >
      {name.slice(0, 1)}
    </span>
  );
}

/** Accent is reserved for a status that is genuinely live today; everything
    else is a plain chip. Two accented chips on this page, out of thirteen, is
    the ratio the system's accent rule asks for: a real signal, not a decoration
    repeated on every row. */
function StatusChip({ status }: { status: IntegrationDetail["status"] }) {
  return <Pill accent={status === "CONNECTED IN ONBOARDING"}>{status}</Pill>;
}

export function IntegrationSection({ integration }: { integration: IntegrationDetail }) {
  return (
    <article
      id={integration.slug}
      className="scroll-mt-[96px] border-t border-[color:var(--vy-line)] py-[32px] first:border-0 first:pt-0"
    >
      <div className="mb-[16px] flex flex-wrap items-center gap-[12px]">
        <Mark slug={integration.slug} name={integration.name} />
        <h3 className="vy-h3 text-[19px] text-[color:var(--vy-ink)]">{integration.name}</h3>
        <StatusChip status={integration.status} />
      </div>

      <dl className="grid grid-cols-1 gap-[16px] md:grid-cols-3 md:gap-[24px]">
        <div>
          <dt className="vy-label text-[color:var(--vy-ink-3)]">What Vyso reads</dt>
          <dd className="vy-body mt-[6px] text-[color:var(--vy-ink-2)]">{integration.reads}</dd>
        </div>
        <div>
          <dt className="vy-label text-[color:var(--vy-ink-3)]">What Vyso can do with it</dt>
          <dd className="vy-body mt-[6px] text-[color:var(--vy-ink-2)]">{integration.canDo}</dd>
        </div>
        <div>
          <dt className="vy-label text-[color:var(--vy-ink-3)]">Setup</dt>
          <dd className="vy-body mt-[6px] text-[color:var(--vy-ink-2)]">{integration.setup}</dd>
        </div>
      </dl>

      {/* `integration.prompt` comes from `components/finch/integrations.ts` (out
          of this phase's scope) and is written in the old brand voice, "Finch,
          fetch our books from Xero." A plain string replace keeps the prompt's
          own words instead of duplicating all eleven of them here, while
          keeping the one name this whole redesign retires off the page. */}
      <p className="vy-small mt-[16px] text-[color:var(--vy-ink-3)] italic">
        {integration.prompt.replace(/Finch/g, "Vyso")}
      </p>
    </article>
  );
}

export default IntegrationSection;

/* ── The audit cluster's OG card ─────────────────────────────────────────────
   One generator, three routes: `/operations-audit` and the two tool pages under
   it (`/score`, `/calculator`). They share a card because they share an offer —
   the card states the audit's trade (a month of documents in, every finding in
   rand out), which is what both tools are a doorway to, and a second generator
   would be a second place for `PRICE.audit` to go stale.

   A function rather than a re-exported `default`: Next parses a metadata
   route's segment config statically and rejects `export { runtime } from …`
   outright ("it mustn't be reexported"), so each route declares its own
   `runtime`/`alt`/`size`/`contentType` and calls this for the picture. */

import { AUDIT_OG_ALT, PRICE } from "./audit-content";
import { renderOgImage } from "@/lib/og/render";

function rand(amount: number): string {
  return `R${amount.toLocaleString("en-US")}`;
}

export function renderAuditOgImage() {
  return renderOgImage({
    eyebrow: `THE OPERATIONS AUDIT · ${rand(PRICE.audit)}`,
    title: AUDIT_OG_ALT,
    finding: {
      agent: "THE AUDIT",
      /* `WHAT WE NEED` and `WHAT YOU GET`, compressed to one sentence each. */
      observation:
        "You bring a month of invoices, statements and stock sheets. You get every finding in rand, with the evidence attached.",
      impact: "One week. Where the money leaks.",
      evidence: `${rand(PRICE.audit)}, credited to month one`,
      meta: "LEAK REPORT · PRIORITY ROADMAP",
    },
    state: null,
  });
}

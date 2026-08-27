/* ── The audit cluster's OG card ─────────────────────────────────────────────
   One generator, three routes: `/operations-audit` and the two tool pages under
   it (`/score`, `/calculator`). They share a card because they share an offer —
   the card states the audit's trade (an hour of your time in, a roadmap out),
   which is what both tools are a doorway to.

   A function rather than a re-exported `default`: Next parses a metadata
   route's segment config statically and rejects `export { runtime } from …`
   outright ("it mustn't be reexported"), so each route declares its own
   `runtime`/`alt`/`size`/`contentType` and calls this for the picture.

   The audit is free (`.ai/plan_home_only.md`, change 4), so no amount appears
   on this card and `footerNote` is passed explicitly rather than taking the
   helper's default, which is still the old published monthly price. */

import { AUDIT_OG_ALT } from "./audit-content";
import { renderOgImage } from "@/lib/og/render";

export function renderAuditOgImage() {
  return renderOgImage({
    eyebrow: "THE OPERATIONS AUDIT · FREE",
    title: AUDIT_OG_ALT,
    finding: {
      agent: "THE AUDIT",
      /* `WHAT WE NEED` and `WHAT YOU GET`, compressed to one sentence each. */
      observation:
        "You give us about an hour and an honest walk through your day. You get where the money and the time are leaking, and what to do about it first.",
      impact: "About an hour. Free.",
      evidence: "A roadmap, priced per scope",
      meta: "WHERE IT LEAKS · WHAT TO AUTOMATE FIRST",
    },
    state: null,
    footerNote: "Book the free audit, vyso.co.za/operations-audit",
  });
}

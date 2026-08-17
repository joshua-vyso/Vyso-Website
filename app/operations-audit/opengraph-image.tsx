/* `/operations-audit`'s OG image. Title is the page's own H1
   (`components/finch/audit/AuditHero.tsx`); the card restates what the week
   trades — both from `audit-content.ts`, which is where the page reads them.
   The picture itself lives in `audit-og.tsx`, shared with the two tool routes
   under this one. */

import { AUDIT_OG_ALT } from "@/components/finch/audit/audit-content";
import { renderAuditOgImage } from "@/components/finch/audit/audit-og";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/render";

export const runtime = "nodejs";
export const alt = AUDIT_OG_ALT;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderAuditOgImage();
}

/* The audit cluster's shared OG card (`components/finch/audit/audit-og.tsx`).
   Without a file here, Next's convention would resolve the nearest image
   *above* this route — the root one, which still says "Operations, connected."
   The segment exports are declared rather than re-exported: Next parses
   `runtime` statically and refuses `export { runtime } from …`. */

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

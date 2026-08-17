/* See `lib/og/comparison.ts` — the three comparison images share one renderer
   and differ only in the spec they hand it. */

import { renderComparisonOgImage } from "@/lib/og/comparison";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/render";
import { ERP } from "@/lib/marketing/compare";

export const runtime = "nodejs";
export const alt = ERP.h1;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderComparisonOgImage(ERP);
}

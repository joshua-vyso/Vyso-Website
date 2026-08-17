/* `/integrations`'s OG image. The two counts are derived from
   `INTEGRATION_DETAILS`' status field — the roster's own honesty chips — so the
   image moves with the product rather than with whoever last edited a caption.
   `LIMITED ROLLOUT` (Gmail) is counted with neither: it is a real connection,
   but a gated one, and rounding it either way would misstate it. */

import { renderOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/render";
import { INTEGRATION_DETAILS } from "@/lib/marketing/integrations";

export const runtime = "nodejs";
export const alt = "Integrations — Xero, Sage, WhatsApp, Yoco, Loyverse & more";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const connected = INTEGRATION_DETAILS.filter(
  (integration) => integration.status === "CONNECTED IN ONBOARDING",
).length;

export default function Image() {
  return renderOgImage({
    eyebrow: "SENSES, NOT INTEGRATIONS",
    title: "Finch reads the tools you already run.",
    finding: {
      agent: "WHAT CONNECTS",
      observation:
        "Xero and WhatsApp Business connect during onboarding. The rest are scoped in your audit, in the order they earn.",
      impact: `${connected} connected in onboarding`,
      evidence: `${INTEGRATION_DETAILS.length} tools on the roster`,
      meta: "STATUS CHECKED AGAINST THE PRODUCT",
    },
    state: null,
  });
}

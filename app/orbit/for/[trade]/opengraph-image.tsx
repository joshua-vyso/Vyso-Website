/* One OG image per trade. The snippet is that trade's own first exchange, so a
   shared plumbing page previews as a plumber's message rather than a tiler's —
   which is the same rule `app/learn/[slug]/opengraph-image.tsx` follows with
   its article's own finding card. */

import { OG_CONTENT_TYPE, OG_SIZE, renderOrbitOgImage } from "@/lib/og/orbit";
import { getTrade, TRADES } from "@/lib/orbit/trades";

export const runtime = "nodejs";
/* Segment-level: `alt` cannot read `params`. */
export const alt = "Orbit — WhatsApp operations for South African tradespeople.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export function generateStaticParams() {
  return TRADES.map((trade) => ({ trade: trade.slug }));
}

export default async function Image({ params }: { params: Promise<{ trade: string }> }) {
  const { trade: slug } = await params;
  const trade = getTrade(slug);

  if (!trade) {
    return renderOrbitOgImage({
      eyebrow: "ORBIT BY VYSO",
      title: "Run your trade from WhatsApp.",
      lead: "Text Orbit what you did and what you charged. It tracks the job and drafts the invoice.",
    });
  }

  const out = trade.chat.messages.find((m) => m.side === "out");
  const reply = trade.chat.messages.find((m) => m.side === "in");

  return renderOrbitOgImage({
    eyebrow: `ORBIT · ${trade.name.toUpperCase()}`,
    title: trade.h1,
    lead: trade.pains[0].title,
    chat: out && reply ? { out: out.text, in: reply.text } : undefined,
  });
}

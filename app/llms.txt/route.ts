/* `/llms.txt` — the short, curated index an LLM/answer-engine reads instead
   of crawling the whole site (`.ai/vyso_v2.md` §7.4). Built entirely from the
   data files via `lib/marketing/llms.ts`; nothing here is invented. Static —
   the content only changes when a data file changes and the site redeploys —
   so it's marked `force-static` and given a 1-hour `Cache-Control`. */

import { NextResponse } from "next/server";

import { buildLlmsTxt } from "@/lib/marketing/llms";

export const dynamic = "force-static";

export async function GET() {
  return new NextResponse(buildLlmsTxt(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

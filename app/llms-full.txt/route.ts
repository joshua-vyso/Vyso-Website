/* `/llms-full.txt` — everything `/llms.txt` has, plus the full FAQ, glossary
   definitions, per-industry "what Finch watches" lines, per-solution
   summaries, per-module taglines, integration statuses and the compare-page
   answers (`.ai/vyso_v2.md` §7.4). Built entirely from the data files via
   `lib/marketing/llms.ts`. Static for the same reason `/llms.txt` is. */

import { NextResponse } from "next/server";

import { buildLlmsFullTxt } from "@/lib/marketing/llms";

export const dynamic = "force-static";

export async function GET() {
  return new NextResponse(buildLlmsFullTxt(), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

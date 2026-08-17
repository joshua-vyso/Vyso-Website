/* POST /api/indexnow — submits every URL in the sitemap to IndexNow. Admin-
   token protected (never exposed publicly, never called by the browser):
   trigger it manually or from a deploy hook after a real content change.
   `.ai/vyso_v2.md` §7.1 / `.ai/plan_phase4_search_ai_visibility.md` §A.4. See
   `docs/seo-operations.md` for the header to send and when to call this. */

import { NextRequest, NextResponse } from "next/server";

import sitemap from "@/app/sitemap";
import { submitUrls } from "@/lib/seo/indexnow";

export async function POST(request: NextRequest) {
  // Checked before the key so a wrong/missing token always reads as
  // "unauthorized" rather than leaking whether INDEXNOW_KEY is configured.
  const provided = request.headers.get("x-indexnow-admin-token");
  const expected = process.env.INDEXNOW_ADMIN_TOKEN;
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.INDEXNOW_KEY) {
    return NextResponse.json({ error: "INDEXNOW_KEY is not configured" }, { status: 400 });
  }

  const urls = sitemap().map((entry) => entry.url);
  const result = await submitUrls(urls);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status || 502 });
  }
  return NextResponse.json({ submitted: urls.length });
}

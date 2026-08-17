/* GET /api/indexnow/key?key=… — the target of the `next.config.ts` rewrite
   from `/{key}.txt`. IndexNow requires the key to be published verbatim at
   `https://vyso.co.za/{key}.txt`; a literal `app/[key].txt` route segment
   isn't a real Next.js convention and a `[[...slug]]` catch-all would be far
   more invasive than the one route + one rewrite this needs. Only the exact
   configured key resolves — every other `*.txt` request that lands here
   (including a stale/guessed key) 404s, so this can never leak the real key
   or serve as an open text-file host. See `docs/seo-operations.md`. */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const key = process.env.INDEXNOW_KEY;
  const provided = request.nextUrl.searchParams.get("key");

  if (!key || provided !== key) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(key, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

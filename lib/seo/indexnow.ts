/* ── IndexNow client ──────────────────────────────────────────────────────
   Pushes changed/new URLs to the shared IndexNow endpoint
   (https://www.indexnow.org) so Bing, Yandex and the other participating
   engines pick them up without waiting for their next crawl (`.ai/vyso_v2.md`
   §7.1 — "enable IndexNow via an API route on publish"). Google does not
   participate in IndexNow as of this writing; GSC submission stays a
   separate, manual step — see `docs/seo-operations.md`.

   The key-file this protocol requires at `https://vyso.co.za/{key}.txt` is
   served by the `next.config.ts` rewrite + `app/api/indexnow/key/route.ts`,
   not a static file in `/public` — the key lives only in `INDEXNOW_KEY`
   (env), never committed. See `docs/seo-operations.md` for how to generate
   and set it. */

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export type IndexNowResult =
  | { ok: true; status: number }
  | { ok: false; status: number; error: string };

/** Submits a batch of absolute URLs to IndexNow. Never throws — a missing
    key or empty list comes back as a `{ ok: false }` result so the caller
    (the admin route) can report it, rather than an unhandled rejection. */
export async function submitUrls(urls: readonly string[]): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    return { ok: false, status: 0, error: "INDEXNOW_KEY is not set" };
  }
  if (urls.length === 0) {
    return { ok: false, status: 0, error: "no URLs to submit" };
  }

  let host: string;
  try {
    host = new URL(urls[0]).host;
  } catch {
    return { ok: false, status: 0, error: `not a valid URL: ${urls[0]}` };
  }

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: urls,
      }),
    });

    if (!res.ok) {
      return { ok: false, status: res.status, error: await res.text() };
    }
    return { ok: true, status: res.status };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : "IndexNow request failed",
    };
  }
}

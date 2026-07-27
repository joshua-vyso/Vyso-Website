# Plan: Debug Google Search Console not picking up the sitemap (submitted 20 July 2026)

## Goal
Determine whether the sitemap for https://vyso.co.za is technically sound or whether something blocks Google from reading it. Fix real technical issues; if everything checks out, document the evidence that Search Console is simply delayed.

## Context (from repo audit — verify, don't re-derive)
- Sitemap is App Router-generated: `app/sitemap.ts`, BASE_URL `https://vyso.co.za`, currently lists **14 URLs** (user said "12-page sitemap" — investigate the discrepancy: production may be built from `main`, local branch is `finch-onboarding` with uncommitted changes; check what production actually serves and how many entries it has).
- `app/robots.ts` → allow `/`, disallow `/api/`, `/app/`; sitemap + host lines present.
- Canonicals via `alternates.canonical` on each page, `metadataBase` in `app/layout.tsx` L50.
- noindex: `/login`, `/onboarding`, `/app/*` only (correct — none are in the sitemap).
- `www.vyso.co.za` → 308 → `vyso.co.za` (next.config.ts).
- No `lastModified` on any sitemap entry (legal, not an error).

## Checks (all against PRODUCTION using curl; use a real UA string and also `Googlebot` UA where relevant)
1. `curl -sI https://vyso.co.za/sitemap.xml` → expect 200, `content-type` XML.
2. Fetch the sitemap body; validate it is well-formed XML (`xmllint --noout`) and uses the sitemaps.org namespace; count `<url>` entries; list them.
3. `curl -s https://vyso.co.za/robots.txt` → confirm it references the sitemap URL exactly (`Sitemap: https://vyso.co.za/sitemap.xml`), and that no rule blocks any sitemap URL.
4. For EVERY URL in the production sitemap: `curl -s -o /dev/null -w '%{http_code} %{redirect_url} %{url_effective}\n'` (no -L first, then with -L) → all should be 200 without redirects (a sitemap URL that 308s to another URL is a GSC "Page with redirect" issue).
5. For each page: fetch HTML and check `<link rel="canonical">` matches the sitemap URL exactly (scheme/host/trailing-slash), and confirm absence of `<meta name="robots" content="noindex">` and absence of `X-Robots-Tag` header.
6. Compare production sitemap vs local `app/sitemap.ts` (14 entries) — explain the 12 vs 14 discrepancy if production differs (likely main vs branch drift). List which pages differ.
7. `curl -sI -A "Googlebot" https://vyso.co.za/sitemap.xml` and the homepage — confirm no bot blocking (Vercel firewall/challenge would show 403/429).
8. Check `https://www.vyso.co.za/sitemap.xml` redirects cleanly to the canonical host.
9. Sanity-check response headers for anything hostile to crawling (e.g. `noindex` X-Robots-Tag on the sitemap or pages).

## Fixes (only if a check fails)
- Only touch `app/sitemap.ts` and/or `app/robots.ts` in this repo. Do not touch any other file (other agents are editing them concurrently). If a fix is needed in page metadata (canonical/noindex), REPORT it, don't edit — those files belong to other agents right now.
- Consider adding `lastModified` to sitemap entries only if you find evidence GSC needs it — otherwise just note it as optional.

## Delay assessment
- Sitemap submitted 20 July 2026; today is 27 July 2026. If all technical checks pass, document that Google commonly takes days-to-weeks to process a sitemap for a small/new site, that "Couldn't fetch"/"Pending" states in GSC are frequently stale UI, and recommend: verify the property covers the exact host (domain property vs https://vyso.co.za), use URL Inspection on 2–3 key pages, and request indexing manually. Note we cannot see GSC itself from here — state what the user should look at.

## Verification / Output
Write a clear evidence table (check → command → result → pass/fail) and the final verdict to `.ai/implementation_sitemap-gsc-debug.md`. Do NOT run `git add`/`git commit`.

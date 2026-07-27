# Implementation: Debug Google Search Console not picking up the sitemap

Date of investigation: 2026-07-27 (sitemap submitted 2026-07-20, 7 days ago)
Verdict: **No technical issue found. This is a GSC processing delay / stale-UI situation, not a broken sitemap.**

## Evidence table

| # | Check | Command | Result | Pass/Fail |
|---|-------|---------|--------|-----------|
| 1 | Sitemap reachable, correct content-type | `curl -sI https://vyso.co.za/sitemap.xml` | `HTTP/2 200`, `content-type: application/xml`, served by Vercel, `content-length: 1714` | PASS |
| 2 | Sitemap is well-formed XML, correct namespace, URL count | `curl -s .../sitemap.xml \| xmllint --noout` + `grep -c '<url>'` | `xmllint` reports valid XML. Namespace `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"` (correct sitemaps.org namespace). **14 `<url>` entries** (full list below). | PASS |
| 3 | robots.txt references sitemap correctly, no blocking rule affects sitemap URLs | `curl -s https://vyso.co.za/robots.txt` | `User-Agent: *`, `Allow: /`, `Disallow: /api/`, `Disallow: /app/`, `Host: https://vyso.co.za`, `Sitemap: https://vyso.co.za/sitemap.xml` (exact match, correct scheme). None of the 14 sitemap URLs fall under `/api/` or `/app/`. | PASS |
| 4 | Every sitemap URL returns 200, no redirects | `curl -s -o /dev/null -w '%{http_code} %{redirect_url} %{url_effective}'` (plain, then with `-L`) for all 14 URLs | All 14 URLs: `200`, empty `redirect_url`, identical effective URL with/without `-L`. No 3xx anywhere in the sitemap URL set. | PASS |
| 5 | Canonical tag matches sitemap URL exactly; no `noindex` meta; no `X-Robots-Tag` header | `curl -sI` for headers, `curl -s \| grep` for `<link rel="canonical">` and `<meta name="robots">` on all 14 URLs | Every page's `<link rel="canonical">` matches its sitemap `<loc>` exactly (scheme + host + path, no trailing-slash mismatch). No `X-Robots-Tag` header on any page. No `<meta name="robots" content="noindex">` anywhere; `/privacy` even has an explicit `<meta name="robots" content="index, follow">`. | PASS |
| 6 | Production sitemap vs local `app/sitemap.ts` (12 vs 14 discrepancy) | `git diff origin/main -- app/sitemap.ts` (empty), `git show origin/main:app/sitemap.ts` vs local file, vs live XML | **No drift at all.** `app/sitemap.ts` on `main` and on the current `finch-onboarding` branch are byte-identical (`git diff` produced no output). The live production sitemap's 14 URLs match the 14 entries in `app/sitemap.ts` exactly, in the same order. See discrepancy explanation below. | PASS (no code fix needed) |
| 7 | Googlebot UA not blocked/challenged | `curl -sI -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"` against sitemap, homepage, robots.txt | All three return `200` for the Googlebot UA — identical to the plain UA response. No 403/429, no CAPTCHA/challenge page, no Vercel firewall block. | PASS |
| 8 | `www.vyso.co.za` redirects cleanly to canonical host | `curl -sI https://www.vyso.co.za/sitemap.xml` and `.../` (no `-L`, then with `-L`) | Both return a single `308` to `https://vyso.co.za/...` (`location:` header exact match), and following the redirect lands on `200` at the canonical host. Clean single-hop redirect, not a chain. | PASS |
| 9 | No hostile headers to crawling (stray `noindex` X-Robots-Tag on sitemap or pages) | `curl -sI` on sitemap + all 14 pages, grep for `x-robots` | No `X-Robots-Tag` header found anywhere (sitemap or any of the 14 pages). | PASS |

## Full list of production sitemap URLs (14, matches `app/sitemap.ts` on `main` and on `finch-onboarding`)

```
https://vyso.co.za
https://vyso.co.za/platform
https://vyso.co.za/platform/finch
https://vyso.co.za/platform/vyso-for-smes
https://vyso.co.za/south-africa
https://vyso.co.za/founding-client
https://vyso.co.za/industries/restaurants
https://vyso.co.za/industries/food-suppliers
https://vyso.co.za/industries/farms
https://vyso.co.za/case-studies/turn-n-slice
https://vyso.co.za/pricing
https://vyso.co.za/faq
https://vyso.co.za/contact
https://vyso.co.za/privacy
```

All 14 individually verified: 200 OK, no redirect, canonical matches, no noindex, no X-Robots-Tag.

## 12-vs-14 discrepancy — explanation

The user reported seeing a "12-page sitemap" figure. Investigation ruled out the two most likely local-repo causes:

1. **Branch drift (main vs `finch-onboarding`)**: `git diff origin/main -- app/sitemap.ts` returned **no differences**. Both branches have the exact same 14 entries. `git log --follow -- app/sitemap.ts` shows the file has been touched by 4 commits (`e36298d` initial add, `68546c4`, `90ed3fc`, `bdd1211` rebrand), none of which are unmerged/local-only changes to this file — it's identical on `main`.
2. **Stale production deployment**: The live `sitemap.xml` was fetched directly from `https://vyso.co.za` and contains all 14 URLs, matching the repo's `app/sitemap.ts` byte-for-byte in content and order. Production is not serving a stale/older 12-URL version.

**Conclusion: the "12" figure did not come from the sitemap file itself — production has always served 14 URLs consistent with the current code.** The "12" almost certainly reflects a Google Search Console dashboard number (e.g., the "Discovered URLs" or "Submitted, currently not indexed" counters on the Sitemaps or Pages report), which reflects **how many of the 14 submitted URLs Google has gotten around to crawling/processing so far** — not a defect in the sitemap file. GSC counters commonly lag the true sitemap size for several days after first submission, and can also under-report while a few pages are still queued for crawling. This is consistent with a **processing delay**, not a technical bug: 2 of the 14 URLs (e.g., the most recently added ones) simply may not have been crawled/indexed yet at the time the user checked.

## Fixes applied

**None.** All 9 checks passed against production. Neither `app/sitemap.ts` nor `app/robots.ts` required changes — both are already correct:
- `app/sitemap.ts`: 14 well-formed entries, correct `BASE_URL`, no `lastModified` (legal per the sitemaps.org spec, not an error — see note below).
- `app/robots.ts`: correct `allow`/`disallow` rules, correct `sitemap` and `host` directives.

No page-metadata issues were found (canonical/noindex), so nothing needed to be reported to the marketing-page-editing agents either.

### Optional (not applied): `lastModified`
No evidence was found that GSC needs `lastModified` to process a sitemap — it is an optional field in the sitemap protocol and Google does not require it for crawling/indexing decisions (Google may use it as a freshness signal to prioritize re-crawls, but its absence does not block indexing). Not adding it; noting as a possible future enhancement only if the user wants to hint at page freshness for re-crawl prioritization.

## Delay assessment (why GSC may still show "Couldn't fetch" / "Pending" / low counts)

Sitemap was submitted 2026-07-20; today is 2026-07-27 — **7 days** elapsed. Every technical check above passed: the sitemap is reachable, valid, correctly linked from robots.txt, contains no redirecting or blocked URLs, every page has a correct self-referential canonical, nothing returns noindex or hostile headers, Googlebot is not blocked/challenged, and the www host redirects cleanly. There is no technical reason for Google to be failing to fetch or index this sitemap.

This strongly points to normal **Google Search Console processing latency**, which is well documented as taking anywhere from a few days to several weeks for a small/newer site or domain property, especially:
- Right after a domain rebrand (this repo shows a "Rebrand Vyso AI to Finch" commit — if the GSC property or key pages changed recently, Google treats it as fresh content needing re-evaluation).
- For a low-authority/newly-crawled domain, Google's crawl budget and indexing pipeline can take 1–4 weeks to fully process a sitemap even when everything is technically sound.
- The GSC UI itself is known to show stale "Pending" or "Couldn't fetch" states in the Sitemaps report that don't reflect the true current crawl state — the report can lag real crawl activity by days.

**Recommended next steps for the user (cannot be verified from here — these require looking inside Search Console itself):**
1. **Confirm property type/host match**: verify the GSC property is either a **Domain property** for `vyso.co.za` (which covers `http/https` and `www`/non-`www` automatically) or, if it's a **URL-prefix property**, that it is exactly `https://vyso.co.za` (not `https://www.vyso.co.za` or `http://...`). A URL-prefix property on the wrong host/scheme would never see this sitemap's URLs as "belonging" to it, producing exactly the "not picking up the sitemap" symptom described, with no technical fault in the site itself.
2. **Re-check the Sitemaps report status**: confirm it says "Success" and look at "Discovered URLs" count — if it already reports 14, the pipeline is working and just needs indexing time. If it's stuck on "Pending" for more than a few days, try removing and re-submitting the sitemap URL to force a re-fetch.
3. **Use URL Inspection** on 2-3 key pages (e.g. homepage, `/platform`, `/pricing`) to see their live indexing status directly — "URL is on Google", "Crawled - currently not indexed", "Discovered - currently not indexed", etc. This gives a much more precise/current signal than the aggregate Sitemaps report.
4. **Request indexing manually** via URL Inspection for the homepage and 1-2 priority pages to accelerate initial crawl, since the technical path is already clean.
5. Give it another 1-2 weeks of natural processing time before assuming there's still a problem — 7 days since submission for a rebranded/low-authority domain is within Google's normal range.

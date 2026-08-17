# SEO & AI-visibility operations

Runbook for the crawl-surface infrastructure built in
`.ai/plan_phase4_search_ai_visibility.md` Workstream A: `robots.txt`,
`/llms.txt` + `/llms-full.txt`, the sitemap, IndexNow, and search-engine
verification. See `.ai/vyso_v2.md` §7 for the strategy this operationalises.

## What's live

| Route | What it does |
| --- | --- |
| `/robots.txt` | `app/robots.ts`. Allows everyone, explicitly names the AI/answer-engine crawlers (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, Bingbot, Applebot-Extended, CCBot), disallows `/api/`, `/app/`, `/login`, `/onboarding` for all of them. |
| `/sitemap.xml` | `app/sitemap.ts`. Every marketing URL, with `lastModified`/`changeFrequency`/`priority`. |
| `/llms.txt` | `app/llms.txt/route.ts` + `lib/marketing/llms.ts`. Short curated index for LLMs — entity statement, price, audit, the full page list, settled facts, contact. |
| `/llms-full.txt` | `app/llms-full.txt/route.ts` + `lib/marketing/llms.ts`. Everything above plus the full FAQ, glossary, per-industry/solution/module/integration detail and the compare-page answers. |
| `/{INDEXNOW_KEY}.txt` | `next.config.ts` rewrite → `app/api/indexnow/key/route.ts`. The IndexNow key-file protocol requires. |
| `POST /api/indexnow` | `app/api/indexnow/route.ts` + `lib/seo/indexnow.ts`. Submits every sitemap URL to IndexNow. Admin-token protected. |

Both `/llms.txt` files are generated from the data files
(`lib/marketing/*.ts`, `components/finch/pricing/pricing-data.ts`,
`components/finch/integrations.ts`) — regenerating them means editing a data
file and redeploying, never hand-editing the route.

## Environment variables

See `.env.example` for the four this phase added:
`NEXT_PUBLIC_GSC_VERIFICATION`, `NEXT_PUBLIC_BING_VERIFICATION`,
`INDEXNOW_KEY`, `INDEXNOW_ADMIN_TOKEN`. None are set yet — the site works
without them (verification tags and the IndexNow route just stay inactive),
but none of the steps below work until they are.

## Google Search Console + Bing Webmaster setup

1. **Google Search Console** (search.google.com/search-console): add the
   `vyso.co.za` property (URL prefix, not Domain, so it matches the canonical
   host `next.config.ts` redirects everything to) → verify with the **HTML
   tag** method → copy the `content="…"` value into
   `NEXT_PUBLIC_GSC_VERIFICATION` → deploy → click "Verify" in GSC.
2. **Bing Webmaster Tools** (bing.com/webmasters): add the site → verify with
   the **HTML Meta Tag** method → copy the `content="…"` value into
   `NEXT_PUBLIC_BING_VERIFICATION` → deploy → click "Verify". Bing Webmaster
   also has an "Import from GSC" shortcut once step 1 is done, which skips
   its own verification step entirely.
3. Submit `https://vyso.co.za/sitemap.xml` in both consoles' sitemap
   submission forms.
4. Weekly: check both consoles' coverage/query reports for new impressions,
   indexing errors and manual actions, per `.ai/vyso_v2.md` §7.7.

## IndexNow

1. Generate a key: `openssl rand -hex 16` (any 8–128 char hex/UUID string
   works — IndexNow doesn't issue keys, you mint your own).
2. Set `INDEXNOW_KEY` to that value and `INDEXNOW_ADMIN_TOKEN` to a second,
   unrelated random string (`openssl rand -hex 24` is fine) in the deploy
   environment. Deploy — the key file now serves at
   `https://vyso.co.za/{INDEXNOW_KEY}.txt`. Confirm:

   ```sh
   curl -s https://vyso.co.za/$INDEXNOW_KEY.txt
   # → the key, verbatim, text/plain
   ```

3. **After any deploy that changes page content** (not every deploy — a CSS
   tweak doesn't need this), submit the sitemap to IndexNow:

   ```sh
   curl -X POST https://vyso.co.za/api/indexnow \
     -H "x-indexnow-admin-token: $INDEXNOW_ADMIN_TOKEN"
   ```

   `200` with `{"submitted": N}` means IndexNow accepted N URLs. `401` means
   the token header was missing or wrong. `400` means `INDEXNOW_KEY` isn't
   configured. Bing and Yandex pick these up within minutes; Google does not
   participate in IndexNow as of this writing, so GSC submission (above)
   stays the way to reach it.
4. Wire step 3 into the deploy pipeline once one exists (a post-deploy CI
   step or a Vercel deploy hook calling the same `curl`), rather than running
   it by hand every time.

## Directory & local listings (per `.ai/vyso_v2.md` §7.4)

Not automated — a one-time (then occasional) manual task:

- Google Business Profile: Johannesburg, category "Software company" /
  "Business management consultant".
- Bing Places.
- SA directories: Brabys, Yellow Pages SA, Cylex, SME South Africa directory.
- Clutch / GoodFirms / G2, once eligible (real reviews needed first).

Use the exact same one-line entity statement everywhere (`SITE.description`
in `lib/marketing/site.ts`) — consistency across listings is what builds the
"entity confidence" LLMs and search engines both key off (§7.4).

## Monthly LLM-citation log

Track whether "Vyso" or "Finch by Vyso" gets mentioned/cited when the same 15
prompts are put to ChatGPT, Perplexity, Gemini and Claude — run all 15
against all four monthly, log a row per (prompt × engine). The 15 are a
starting set built from the intent clusters in `.ai/vyso_v2.md` §7's opening
paragraph; add/retire prompts as real search behaviour data comes in from GSC.

1. best operations software for a food supplier in South Africa
2. what is an AI COO
3. how do I stop supplier price creep
4. best operations management software for South African SMEs
5. AI operations assistant for small business South Africa
6. fractional COO vs software South Africa
7. invoice automation software South Africa
8. how to reconcile invoices against delivery notes automatically
9. WhatsApp business automation for orders in South Africa
10. stock control / inventory software for South African wholesalers
11. debtors management and follow-up automation for small business
12. weekly operations report software for SMEs
13. restaurant back-office software South Africa
14. Xero integration for a South African food supplier or wholesaler
15. business intelligence / analytics tools for small business South Africa

Log template (one row per prompt × engine × month):

| Month | Engine | Prompt # | Vyso/Finch mentioned? | Cited as a source/link? | Notes |
| --- | --- | --- | --- | --- | --- |
| 2026-08 | ChatGPT | 1 | No | No | — |

Keep the raw log in a spreadsheet (out of the repo — it's operational data,
not code); this file just holds the template and the prompt list so it can't
drift between reviewers.

## Quarterly

- Core Web Vitals audit (`.ai/vyso_v2.md` §7.1 targets: LCP < 2.0s,
  CLS < 0.05, INP < 200ms) — see `.ai/perf_baseline.md` (Workstream D) for the
  Lighthouse baseline this phase recorded.
- Refresh `dateModified` on the top-20 pages by traffic once content actually
  changes — bump the relevant `CONTENT_LAST_MODIFIED`/`lastModified` in
  `app/sitemap.ts`, or the underlying `dateModified` in
  `lib/marketing/learn-articles.ts`, not the sitemap alone.
- Re-run this doc's IndexNow key-file curl check — a rotated deploy
  environment is the one thing that would silently break it.

# Vyso Security and Engineering Audit

**Audit date:** 15 July 2026  
**Scope:** Next.js web application, Supabase SQL and access patterns, server APIs, upload/OCR pipeline, Anthropic integration, dependencies, and available client code.  
**Method:** Read-only static review plus non-writing TypeScript and ESLint checks. No production systems were accessed.

## Executive summary

- No Critical issue was confirmed, but multiple High-severity authorization, abuse, and data-integrity defects need remediation before scaling.
- All 65 tables created by checked-in SQL enable RLS and have policies; however, 11 actively used tables have no versioned DDL or policies, so complete tenant isolation cannot be verified.
- Role and subscription authorization is ineffective: most policies grant every organisation member full CRUD, feature flags are forcibly enabled, and client-side gates expose financial data in rendered payloads.
- Two anonymous endpoints enable email abuse and computational denial of service; authenticated AI routes also lack quotas, rate limits, and spend controls.
- Core order, invoice, document, and inventory workflows consist of unchecked multi-step writes without transactions or reliable idempotency.
- Upload/OCR validation is mostly client-side, storage policies are absent from the repository, and the advertised 13 MiB AI upload flow exceeds Vercel's request limit.
- No committed API key or service-role secret was found, but the repository documents a weak, auto-confirmed owner demo credential that is High risk if deployed.
- TypeScript passes, but database/model boundaries are largely untyped; ESLint reports 68 errors and 19 warnings, and no test suite or CI gate was found.

## Findings table

| ID | Severity | Category | File:line | Issue |
|---|---|---|---|---|
| SEC-01 | High | Multi-tenancy / RLS | `supabase/demo-fresh-valley/README.md:40-42`; `lib/platform/supabase-server.ts:61-79` | Eleven actively queried tenant tables have no DDL or RLS definitions in the repository. |
| SEC-02 | Medium | Multi-tenancy / RLS | `supabase/feedback.sql:9-35` | The feedback INSERT policy validates `user_id` but not membership in the supplied `org_id`. |
| SEC-03 | High | Authorization | `supabase/core-data.sql:512-544`; `app/app/orderflow/page.tsx:15-31`; `components/platform/orderflow/Dashboard.tsx:332-357` | Organisation membership grants broad CRUD, while intended role-based financial restrictions are bypassable and leak data. |
| SEC-04 | High | Entitlements | `lib/platform/supabase-server.ts:70-85`; `components/platform/ModuleLockGuard.tsx:24-40`; `app/app/layout.tsx:12-27` | Every feature is forced on and module locks are enforced only after server rendering. |
| SEC-05 | High | Credentials / auth | `supabase/demo-fresh-valley/0-bootstrap.sql:8-38`; `supabase/demo-fresh-valley/README.md:10-15` | A known password is documented for an auto-confirmed owner account with all modules. |
| SEC-06 | High | Public API abuse | `app/api/contact/route.ts:9-50` | Anonymous mail relay lacks rate limiting and interpolates attacker input into trusted-domain HTML emails. |
| SEC-07 | High | Public API DoS | `app/api/import/parse-xlsx/route.ts:38-163` | Unauthenticated XLSX parsing permits ZIP expansion, memory, and CPU exhaustion. |
| SEC-08 | High | AI security / cost | `app/api/ai/message/route.ts:13-30`; `lib/ai/anthropic.ts:487-537`; `app/api/ai/agent/route.ts:90-195` | AI endpoints lack quotas and expose expensive models; caching and document processing are inefficient. |
| SEC-09 | High | API authorization | `app/api/orderflow/order-from-document/route.ts:20-63`; `lib/platform/orderflow-from-doc.ts:442-580` | Any tenant member can convert an arbitrary visible document and request forced finalisation. |
| SEC-10 | High | Email security | `app/api/email/senders/route.ts:52-110`; `app/api/email/address/route.ts:63-129` | Sender approval/blocking and address rotation ignore failed security-control writes. |
| SEC-11 | Medium | Email authentication | `lib/platform/email-ingest.ts:217-234`; `lib/platform/email-ingest-policy.ts:132-249` | Conditional: raw MIME fallback may trust a sender-forged `Authentication-Results` header. |
| SEC-12 | High | Upload / OCR | `app/app/docu/upload/page.tsx:15-64`; `components/platform/docu/UploadBubble.tsx:35-77`; `app/api/ai/extract/route.ts:34-54` | Server-side type/size validation is incomplete; objects are buffered and multi-step uploads leak orphaned state. |
| SEC-13 | Low | Client privacy | `lib/ai/vyso-agent/order-handoff.ts:22-37`; `components/platform/vyso-ai/VysoAIOrderPrefill.tsx:27-35` | Customer and order data persists in origin-wide `localStorage` after sign-out. |
| AUTH-01 | Medium | Session handling | `lib/platform/supabase-server.ts:12-27`; `lib/ai/auth.ts:36-47` | Refreshed Supabase cookies are discarded and there is no Next.js request proxy. |
| REL-01 | High | Correctness / transactions | `lib/platform/procurepulse-feed.ts:177-419`; `app/api/orderflow/order-stock/route.ts:11-127` | Inventory changes are non-transactional, race-prone, and can deliberately fall back to non-idempotent behaviour. |
| REL-02 | High | Correctness / architecture | `lib/platform/document-ingest.ts:128-255`; `components/platform/orderflow/InvoiceBuilder.tsx:240-284` | Workflows report success after failed side effects and can leave header-only or partially replaced records. |
| COR-01 | High | Data integrity | `components/platform/coredata/ImportWizard.tsx:80-99,650-666` | Imports silently delete unsupported mapped fields and count affected rows as successful. |
| REL-03 | High | Upload reliability | `components/platform/vyso-ai/VysoAIModal.tsx:20-24,64-66,240-249,405-419`; `app/api/ai/agent/ingest-document/route.ts:10-53` | The application accepts 13 MiB base64 requests that Vercel rejects before route execution. |
| TYPE-01 | Medium | Type safety | `lib/platform/supabase-browser.ts:10-12`; `lib/platform/supabase-server.ts:12-27`; `lib/ai/anthropic.ts:165-181` | Supabase clients, model JSON, and important API boundaries are not runtime- or schema-typed. |
| PERF-01 | High | Performance / correctness | `app/app/pricepilot/analytics/page.tsx:14-88`; `lib/platform/procurepulse-feed.ts:315-446` | Full-history unpaginated reads can truncate analytics and combine with N+1 and unindexed queries. |
| PERF-02 | Medium | Frontend performance | `components/sections/SystemsShowcase.tsx:47-236`; `components/PixelTrail.tsx:23-89` | Large unoptimised images and thousands of motion components are mounted from the root experience. |
| DEP-01 | Low | Supply chain | `package.json:20-32`; `package-lock.json:7891-7898,7938-7942`; `components/PixelTrail.tsx:3` | Production dependencies include unused tooling, while code relies on an undeclared transitive package. |
| QUAL-01 | Medium | Maintainability | `components/ChaosScene.tsx:445-447`; `components/platform/supplysync/Risk.tsx:196-214` | The lint baseline has 68 errors and 19 warnings, and no tests or CI definitions were found. |

## Detailed findings

### SEC-01 — The repository is not a complete RLS source of truth

**What's wrong:** A static inventory found 65 unique tables created in checked-in SQL. All 65 have `ENABLE ROW LEVEL SECURITY` and at least one policy; no `USING (true)`, `WITH CHECK (true)`, `DISABLE ROW LEVEL SECURITY`, or `SECURITY DEFINER` bypass was found. However, these actively queried tables have no DDL or policies in the repository: `document_folders`, `documents`, `org_features`, `organisations`, `pp_item_suppliers`, `pp_movements`, `pp_notifications`, `pp_settings`, `pp_stock_items`, `profiles`, and `suppliers`. The demo documentation explicitly says it relies on pre-existing database tables, while SQL files are described as scripts to paste into the dashboard rather than canonical migrations.

**Why it matters:** There is no evidence that live RLS is absent, but there is also no way to verify the most important profile, organisation, document, inventory, or storage isolation rules from source control. Drift between manually applied environments could create a cross-tenant exposure without a reviewable code change.

**Recommended fix:** Establish one ordered migration history or checked-in schema dump that includes tables, policies, grants, functions, and storage rules. Make deployment and CI fail if a tenant table lacks `relrowsecurity`, an expected policy, or the required tenant key.

### SEC-02 — Feedback permits cross-organisation attribution

**What's wrong:** The feedback INSERT policy checks `user_id = auth.uid()` but does not require `org_id` to match the caller's profile. The normal API route derives the organisation correctly, but a caller able to use the Supabase Data API can bypass that route.

**Why it matters:** An authenticated user who knows another organisation UUID can create feedback attributed to that organisation. This is a cross-tenant integrity problem, although no cross-tenant read was demonstrated.

**Recommended fix:** Derive or validate both identity and organisation membership in the policy and do not trust a client-supplied tenant identifier. Apply the same invariant to any associated screenshot/object path.

### SEC-03 — Intended role authorization is not enforced

**What's wrong:** Many business-table policies use `FOR ALL` with only organisation membership, including invoices, quotes, payments, settings, orders, and ServiceDen records. Any organisation member can therefore bypass UI restrictions and directly read or mutate these tables through Supabase's Data API. The OrderFlow page also fetches full invoice, payment, credit-note, and balance data for all roles. Only some KPI components are hidden; recent invoice balances remain visible and all records are present in the RSC/client payload. The AI recent-orders tool separately returns `subtotal_ex_vat` without receiving the route's `canSeeMoney` capability.

**Why it matters:** This is not a demonstrated cross-organisation read, but it is a confirmed privilege-boundary failure within a tenant. A member role can access or alter data that the UI and comments describe as owner/admin-only.

**Recommended fix:** Enforce capabilities in RLS, role-scoped views or RPCs, server data-access functions, and server-side projections before serialization. Centralise financial redaction so every API and AI tool receives the same enforced capability. Treat client gates as cosmetic only.

### SEC-04 — Subscription entitlements are bypassed

**What's wrong:** `loadPlatformSession` overwrites every loaded feature flag to `true`. `ModuleLockGuard` then checks locks in a client component after the protected Server Component has already executed and potentially serialized its data. API routes generally do not repeat the entitlement check.

**Why it matters:** A tenant can access modules or APIs regardless of its stored plan configuration. This undermines both commercial controls and any security boundary associated with a restricted module.

**Recommended fix:** Remove the force-enable override and require a shared server-side entitlement check before queries and mutations. Back sensitive entitlements with database enforcement so direct Data API calls cannot bypass them.

### SEC-05 — Weak owner demo credential is committed as operational instruction

**What's wrong:** The demo bootstrap instructs an operator to create and auto-confirm `demo@vyso.co.za` with password `1234`, then assigns it the owner role and enables all modules.

**Why it matters:** This is High severity if that account exists in any shared, staging, or production environment. The repository alone cannot establish whether it does.

**Recommended fix:** Delete or rotate any deployed instance of the account. Use isolated demo infrastructure and random, short-lived credentials, and remove reusable passwords from setup instructions.

No committed Anthropic key, Supabase service-role value, private key, or tracked `.env` file was found. `.env.local` is ignored, and the service-role and Anthropic clients are marked `server-only`.

### SEC-06 — Contact endpoint is an email relay

**What's wrong:** The anonymous route performs only truthiness checks. Each request sends an internal notification and an autoreply to the caller-controlled email address, with no CAPTCHA, IP/device rate limit, deduplication, length limit, or delivery quota. Attacker-controlled values are interpolated into HTML without escaping, including `name` in the victim-facing autoreply.

**Why it matters:** This permits mail bombing, Resend cost and reputation abuse, and phishing-like HTML delivered from Vyso's domain.

**Recommended fix:** Validate and bound every field, escape rendered values, introduce layered abuse controls and idempotency, and avoid sending an autoreply until the address or submission has passed an abuse check.

### SEC-07 — Public XLSX parsing is computationally unsafe

**What's wrong:** The endpoint is unauthenticated and accepts up to 15 MB compressed input. Its custom parser synchronously calls `inflateRawSync` without limits for expanded bytes, compression ratio, ZIP entries, XML size, strings, cells, or execution time. A malicious cell reference can produce an extremely large `maxc`, causing a long allocation/iteration loop despite the row cap.

**Why it matters:** A remote unauthenticated attacker can consume function CPU and memory, create availability incidents, and generate platform cost.

**Recommended fix:** Require authentication and rate limiting, use a maintained parser in an isolated worker, and enforce limits on compressed and expanded sizes, entries, sheets, rows, columns, cells, and processing time.

### SEC-08 — AI spend is unbounded and caching is largely ineffective

**What's wrong:** `/api/ai/message` lets every authenticated caller supply unbounded prompt and system text and invokes the default Opus model. Import assistance also uses this generic Opus path, while the agent permits client-selected workflow mode to trigger up to five Sonnet turns. There are no per-user or per-organisation quotas, token limits, concurrency controls, spend ceilings, or idempotency protections. Order documents undergo generic multimodal extraction and then a second order-specific pass over the same bytes. The limited Haiku cache markers appear on prompts the code itself notes are below the applicable minimum.

**Why it matters:** A low-privilege account can generate material Anthropic spend or exhaust shared provider limits. Duplicate document processing increases latency and cost. Anthropic documents a 4,096-token minimum for Haiku 4.5 and states shorter cache-marked prefixes are accepted but not cached: [Anthropic prompt-caching documentation](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).

**Recommended fix:** Introduce plan-aware quotas and accounting, hard input/output token limits, server-owned model routing, concurrency limits, and per-operation idempotency. Use cheaper models for mapping and classification, avoid duplicate image processing, and use cache breakpoints only where a sufficiently large stable prefix is reused.

### SEC-09 — Order creation from documents lacks business authorization

**What's wrong:** The route checks that the authenticated user can see the document through RLS but does not require an owner/admin role, `document_type = 'order'`, an approved review state, or other workflow prerequisites. The caller controls `finalize`, which bypasses confidence and unpriced-line gates. The helper can then create or replace orders, lines, invoices, invoice lines, and stock state.

**Why it matters:** A member can turn an invoice or statement into a finalised order, and partial failures can produce inconsistent records.

**Recommended fix:** Require an explicit role or capability, validate document type and state, determine finalisation server-side, and execute the conversion atomically.

### SEC-10 — Email security state changes fail open

**What's wrong:** The sender block/approve route ignores database errors and still returns success. A failed block can leave a sender approved; a failed approval can nevertheless release quarantined work, while the worker does not revalidate current allowlist state when claiming it. Address rotation similarly deactivates the existing address before inserting the replacement and ignores part of the result.

**Why it matters:** Security-control state shown to an administrator can differ from actual state. Rotation failure can also leave an organisation with no active inbound address.

**Recommended fix:** Make the transitions transactional, check every result, fail closed, revalidate the sender when work is claimed, and never deactivate the last working address until its replacement is committed.

### SEC-11 — Conditional forged email-authentication header risk

**What's wrong:** When provider authentication data is unavailable, ingestion parses the first raw `Authentication-Results` header. The parser ignores the `authserv-id` and accepts an aligned SPF, DKIM, or DMARC `pass`.

**Why it matters:** This is exploitable only if Resend can deliver attacker-supplied headers ahead of a provider-controlled header or does not otherwise guarantee their provenance; that guarantee is not established in the codebase. An attacker could otherwise impersonate an approved sender.

**Recommended fix:** Confirm the provider contract with a crafted-message test. Prefer structured provider-verified authentication data, or accept raw results only from a known trusted `authserv-id`.

### SEC-12 — Upload and OCR validation is not authoritative

**What's wrong:** The standalone upload page performs no effective type or size validation; other paths rely on browser checks and accept broad `image/*` values. The extraction route downloads and buffers the entire object without a server-enforced byte limit, magic-byte inspection, or strict MIME allowlist. Email ingestion advertises HEIC/BMP support even though the Anthropic content block only handles JPEG, PNG, GIF, and WebP. Storage upload, document insertion, and extraction initiation are separate operations. Failed inserts leave orphaned objects, and fire-and-forget extraction can leave documents pending indefinitely. Attachment and raw-email responses are buffered before a reliable byte ceiling is applied.

**Why it matters:** Authenticated abuse can exhaust function memory or model budget, unsupported files fail late, and partial failures leave storage and database state inconsistent. Actual storage-prefix isolation is unknown because no `storage.objects` or bucket policy SQL is present.

**Recommended fix:** Centralise validation at a server-owned ingestion boundary, inspect actual file signatures, stream with hard limits, use one supported format list, and implement durable, retryable OCR jobs with object cleanup. No conventional filesystem path traversal was found: server ingestion uses an organisation/UUID prefix and sanitises the filename.

### SEC-13 — Order data survives sign-out in local storage

**What's wrong:** AI order handoff stores customer names, items, quantities, and prices in origin-wide `localStorage` until consumed or dismissed.

**Why it matters:** The data survives sign-out and is available to later sessions on a shared workstation or to any same-origin XSS.

**Recommended fix:** Use an in-memory or session-scoped handoff, or a short-lived server draft bound to user and organisation. Apply a TTL and clear outstanding data during sign-out.

### AUTH-01 — Supabase session refresh cookies are discarded

**What's wrong:** The server client catches cookie-write failures in Server Components, while the route-oriented auth client makes `setAll` a no-op. No root `proxy.ts` or legacy middleware exists to refresh and propagate Supabase cookies before protected pages render.

**Why it matters:** Supabase's SSR guidance requires a request proxy because Server Components cannot persist refreshed tokens themselves. The likely result is intermittent null sessions, repeated refreshes, or unexpected logout after token rotation—not a demonstrated token forgery. See [Supabase Next.js SSR guidance](https://supabase.com/docs/guides/auth/server-side/nextjs).

**Recommended fix:** Add a Next.js 16-compatible proxy with appropriately narrow route matching and response-cookie propagation. Allow route handlers that refresh a session to return updated cookies.

### REL-01 — Inventory operations are non-transactional and race-prone

**What's wrong:** Feed/unfeed deletes movements, queries or creates stock items per line, inserts replacement movements, and performs read-modify-write stock updates in separate calls. Document deletion swallows reversal failures and proceeds. `order-stock` treats an error querying the optional `order_id` column as "no previous movement" and falls back to inserting rows without it. Repeating the request can reapply the sale, while reversal cannot locate it. The accompanying index is non-unique, so it does not guarantee idempotency even when the column exists.

**Why it matters:** Concurrent or interrupted operations can lose increments, duplicate movements, leave a deleted document whose stock remains applied, or make reversal impossible. Product merging and unit conversion exhibit similar unchecked multi-table behaviour.

**Recommended fix:** Move movement creation and stock deltas into transaction-backed PostgreSQL functions with row locks or atomic increments. Enforce unique operation keys, fail closed when required schema is unavailable, and make storage cleanup a retryable post-commit operation.

### REL-02 — Workflows can report success after partial failure

**What's wrong:** `runDocumentSideEffects` can return a nested `{ok:false}` order-sync result without treating it as failure. `commitDocument` then continues, ignores the final status-update error, and returns success. Invoice editing updates the header, deletes all existing lines, and inserts replacements without a transaction. Recipe replacement and stock-order creation use similar destructive or header-first sequences.

**Why it matters:** A document can appear approved without an order, an order can exist while the document remains reprocessable, or an invoice can retain new metadata with no items.

**Recommended fix:** Model each workflow as an atomic database transaction or durable state machine. Treat any unsuccessful sub-result as failure, check every database response, use idempotency keys, and reserve asynchronous outbox jobs for genuinely external effects such as storage or AI calls.

### COR-01 — Import schema drift silently discards data

**What's wrong:** When Supabase reports a missing column, the import helper deletes that field from every row and retries. The caller discards the returned list of dropped columns and counts the chunk as inserted.

**Why it matters:** A migration omission can result in apparently successful imports with mapped customer, product, or financial fields silently lost.

**Recommended fix:** Stop the import on schema incompatibility, identify the missing migration or column, and require explicit operator acknowledgement before any intentionally lossy fallback. Never count a row as fully successful when mapped data was discarded.

### REL-03 — Advertised upload size cannot reach the route

**What's wrong:** The UI and API accept approximately 13 MiB raw files by embedding base64 in JSON. Base64 expands input by roughly one third, while Vercel documents a 4.5 MB request-body limit for functions: [Vercel body-limit guidance](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions).

**Why it matters:** Files above approximately 3.3 MiB raw size can fail at the platform edge before route validation, despite being accepted by the UI.

**Recommended fix:** Upload directly to private object storage using a short-lived server-authorised upload, then pass only the verified object identifier to the processing route.

### TYPE-01 — Database and model boundaries bypass TypeScript

**What's wrong:** Supabase clients are not parameterised with a generated `Database` type. The application instead maintains handwritten domain interfaces and uses broad `any`, `unknown as T`, and empty-array casts. Anthropic output is parsed with `JSON.parse` and cast to `Partial<ExtractionResult>`; arrays are accepted without validating element shapes, bounds, quantities, or numeric fields before downstream stock writes.

**Why it matters:** The passing TypeScript check says little about database drift or malformed external payloads. Invalid model or database values can reach operational writes.

**Recommended fix:** Generate types from the applied schema, parameterise every Supabase client, derive row/insert/update types, and validate route, email, spreadsheet, and model inputs with runtime schemas before operational writes.

### PERF-01 — Analytics will truncate or degrade as tenants grow

**What's wrong:** Several PricePilot pages fetch entire histories with unpaginated `select("*")` calls and aggregate in JavaScript. Supabase documents a default maximum of 1,000 returned rows: [Supabase JavaScript `select` documentation](https://supabase.com/docs/reference/javascript/select). The same histories are fetched separately across dashboard, analytics, products, recommendations, and notifications. ProcurePulse feed processing performs per-line lookup/create/insert/update sequences, and `of_order_items` is filtered by `org_id` despite having only an `order_id` index in the checked-in schema.

**Why it matters:** Larger tenants can receive silently incomplete analytics unless the hosted limit has been changed, while repeated full-history and N+1 queries increase latency and database cost.

**Recommended fix:** Move aggregates and bounded date-range queries into SQL views, RPCs, or materialised summaries. Use keyset pagination for detail, eliminate per-line N+1 lookups, and add composite indexes based on verified production query plans.

### PERF-02 — Marketing assets and animation are unnecessarily expensive

**What's wrong:** Showcase sections reference roughly 13.8 MiB of PNG assets through raw `<img>` elements. Inactive opacity-hidden system images remain mounted and fetched. The root experience statically imports the pixel-trail animation and its motion dependency. At 30-pixel cells, a 1080p display can create roughly 2,300 motion components.

**Why it matters:** Initial network, parse, render, and animation cost is substantially higher than necessary, especially on mobile and lower-end hardware.

**Recommended fix:** Isolate marketing-only code to marketing routes, lazy-mount inactive slides, use responsive optimised image formats, and replace the dense component grid with a sparse or canvas implementation.

### DEP-01 — Dependency boundaries are untidy

**What's wrong:** `shadcn` and `@types/three` are production dependencies despite no runtime use; `shadcn` brings the `msw` install-script surface into production installation. Conversely, `PixelTrail.tsx` imports `framer-motion` directly even though it is only transitively installed through the declared `motion` dependency.

**Why it matters:** Unnecessary production packages increase supply-chain and install surface, while undeclared transitive imports can break after a valid lockfile or dependency-layout change.

**Recommended fix:** Move build, CLI, and type tooling to development dependencies and declare every runtime import directly or use the declared package's supported entry point. The lockfile otherwise uses registry URLs and integrity hashes, with no Git, plain-HTTP, or local-file dependency found.

The pinned Next.js 16.2.7 and React 19.2.4 versions are on the patched side of the specific reviewed [Next.js middleware-bypass advisory](https://github.com/vercel/next.js/security/advisories/GHSA-26hh-7cqf-hhc6) and [React RSC denial-of-service advisory](https://github.com/facebook/react/security/advisories/GHSA-83fc-fqcc-2hmg). This is not a substitute for a complete advisory scan.

### QUAL-01 — Static quality checks are not deployment-ready

**What's wrong:** `tsc --noEmit --incremental false` passes. ESLint over `app`, `lib`, `components`, and `hooks` reports 87 problems: 68 errors and 19 warnings. Examples include render-time `Date.now()`, accessing refs during render, missing React keys, synchronous effect state updates, reassignment of the reserved `module` name, and unoptimised images. No tests, specs, CI workflow, Dependabot, or Renovate configuration were found.

**Why it matters:** The red lint baseline cannot prevent React 19 correctness regressions, and the highest-risk tenant, transaction, webhook, and upload behaviour lacks automated regression coverage.

**Recommended fix:** Make lint clean and blocking, then add tenant-isolation, role-authorisation, upload-limit, webhook-authentication, idempotency, and transaction-failure integration tests around the concrete risks above.

## Verified controls

- All 65 tables actually created by checked-in SQL enable RLS and have at least one policy.
- No checked-in `USING (true)`, `WITH CHECK (true)`, disabled RLS, or `SECURITY DEFINER` function was found.
- The service-role client necessarily bypasses RLS, but it is isolated in a `server-only` module using a non-public environment variable. Reviewed callers generally derive the organisation from an authenticated profile or secret ingest address and add explicit organisation filters.
- `resolveUser` validates cookie and mobile bearer credentials with `auth.getUser`; it does not trust locally decoded claims.
- The inbound webhook verifies its Resend/Svix signature before database work and creates an idempotency record before processing.
- No committed service-role, Anthropic, private-key, or tracked environment-file secret was found.
- No server actions were found.
- No conventional server-side path traversal was identified; the unresolved concern is storage policy and prefix enforcement.

## Anything that could not be assessed

- **Live Supabase state:** The deployed definitions for the 11 missing base tables, table grants, `profiles` update permissions, organisation-role protections, storage buckets, and `storage.objects` policies are required. A schema-only dump plus `pg_policies`, `pg_class.relrowsecurity`, grants, and storage-policy output would close this gap.
- **Migration drift:** There is no canonical `supabase/migrations` history or deployment record showing which dashboard scripts reached production.
- **Mobile client:** No React Native/Expo source, `app.json`, `eas.json`, native package manifest, secure-storage implementation, deep-link configuration, or mobile sign-out logic exists in this workspace. Those files are needed to assess Expo secret exposure and token storage.
- **Deployment controls:** Vercel environment settings, WAF/rate-limit configuration, function logs, Supabase Auth configuration, and whether the documented demo owner account exists were unavailable.
- **Email provenance:** Resend's exact handling and ordering of raw `Authentication-Results` headers must be confirmed through provider documentation or a crafted-message test.
- **Runtime database behaviour:** Production row counts, configured Supabase API row limits, query plans, indexes actually applied, contention, and transaction failure rates require read-only production metadata and representative `EXPLAIN` output.
- **Complete dependency vulnerability status:** No live advisory audit was run under the original strict no-write audit constraint. Registry-backed vulnerability output or CI security results would be needed.
- **Production build and runtime tests:** A build was not run because it writes `.next`; no existing automated test suite was available to execute.

## Suggested remediation order

1. Lock down anonymous endpoints (`SEC-06`, `SEC-07`) and remove or rotate the demo owner credential (`SEC-05`).
2. Establish the canonical database/RLS source of truth and close cross-tenant policy gaps (`SEC-01`, `SEC-02`).
3. Enforce roles and entitlements at database and server boundaries (`SEC-03`, `SEC-04`, `SEC-09`).
4. Add AI spend controls and authoritative upload/OCR validation (`SEC-08`, `SEC-12`, `REL-03`).
5. Move inventory, order, document, invoice, and email state transitions into transactional workflows (`SEC-10`, `REL-01`, `REL-02`, `COR-01`).
6. Correct session refresh and runtime type validation (`AUTH-01`, `TYPE-01`).
7. Address scale, frontend cost, dependency hygiene, and the quality gate (`PERF-01`, `PERF-02`, `DEP-01`, `QUAL-01`).

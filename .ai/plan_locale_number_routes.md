# Plan: Micro-sweep — locale-aware coercion in four ProcurePulse routes

Author: Fable (architect). Implementer: subagent. Date: 2026-08-28.
Follow-up to `.ai/plan_locale_number_sweep.md`. Status: AWAITING USER APPROVAL.

## Goal

The four ProcurePulse save routes coerce request-body numerics with a bare `Number(v)`. That is not the comma-deleting corruption class (a `"12,5"` fails safe to `null`), but it silently discards a value a user typed into inputs that — since the C-sweep — legitimately accept comma decimals. Route them through `parseLocaleNumber` so comma-decimal strings coerce instead of vanishing.

## Sites (each a private helper, near-identical)

1. `app/api/procurepulse/thresholds/route.ts:17-21` — `num()`; fields: low_threshold, par_level, lead_time_days, freshness_value.
2. `app/api/procurepulse/product-units/route.ts:19-23` — `posNum()`; field: conversion_factor (keeps its `> 0` guard).
3. `app/api/procurepulse/recipe/route.ts:19-23` — `num()`; fields: qty_per_batch etc. (`number | string` inputs).
4. `app/api/procurepulse/batch/route.ts:33-38` — `num()`; fields: qty_used etc.

## Treatment (identical at each site)

Replace the helper body with a delegate:

```ts
const num = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  return parseLocaleNumber(String(v)); // reads "12,5"; malformed still → null
};
```

- `posNum` keeps its positive guard on top of the same delegate.
- Import `parseLocaleNumber` from `@/lib/platform/locale-number`.
- No hint anywhere: these are single user-typed values with no document context; the parser's unambiguous rules cover "12,5"-style input, and an ambiguous "1,234" keeps the en-thousands default — same trade-off as `coerceField`, note it in a one-line comment.
- House style: one why-comment per site noting that the UI inputs now legitimately send comma decimals and that malformed still fails to null (never a guess).

## Leave untouched

- `batch/route.ts:75,265` — `Number()` over DB-numeric `on_hand` values; not user input.
- Everything else in these routes (auth, RLS scoping, upsert logic, error mapping).

## Acceptance criteria

1. Each helper coerces: `"12,5"` → 12.5, `"1 234,56"` → 1234.56, `12.5` (number) → 12.5, `""`/null → null, `"abc"` → null; `posNum("0,00")` → null.
2. Prior en behavior unchanged: `"12.5"` → 12.5, `"1234"` → 1234.
3. No route's public request/response shape changes.
4. `npx tsc --noEmit`, `npm run lint`, `npm test` — zero new issues, full suite passes.

## Tests

These helpers are private to `server-only` route files (same import constraint that blocked direct tests in the previous sweep), and the algorithm itself is covered by `tests/locale-number.test.ts`. Do NOT export the helpers or refactor the routes for testability — out of proportion for four three-line delegates. Verification is tsc + lint + full suite + a diff review.

## Ordered steps

1. Edit the four helpers (one commit-sized change, no other lines touched).
2. Run the three verification commands.
3. Append outcomes to `.ai/implementation_locale_number_sweep.md` under a "Route micro-sweep" section.

## Hard constraints

No git commits, no deploys, no DB writes, no changes outside the four helper bodies + imports + comments. If anything material is missing here, stop and report.

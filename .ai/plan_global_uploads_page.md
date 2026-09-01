# Plan: standalone global Uploads page

**Directive from Josh (2026-09-01):** the global Upload button must NOT land on Stock's uploads tab; it needs its own standalone page for all things ingestion. Stock keeps its uploads subpage (per the original 7-page spec); it becomes the domain-scoped view when `documents.domain` lands with the spine.

**Worktree/branch:** continue on `feature/phase0-teardown-shell` in `.claude/worktrees/phase0-teardown-shell` (base = deployed 686ed84).

## Goal & acceptance

1. `/app/uploads` — standalone page (own header, NOT under the stock layout): upload tray + ingestion KPI strip + recent-documents table across ALL document types.
2. `/app/uploads/[id]` — extraction-edit detail hosting the unchanged `DocumentDetailPanel`, back-links to `/app/uploads`.
3. `components/platform/shell/UploadButton.tsx` href → `/app/uploads`.
4. `/app/stock/uploads` stays as-is (links inside it unchanged).
5. tsc clean, lint ≤81 baseline, tests pass, build succeeds.

## Files

- NEW `app/app/uploads/page.tsx` — modelled directly on `app/app/stock/uploads/page.tsx` but standalone: `ModuleHeader` title "Uploads" (subtitle about every document entering here), then the same composition. Reuse `components/platform/stock/UploadDropZone.tsx` and `UploadDocumentsTable.tsx` — parameterise the table's detail-link base href via a prop (default stays `/app/stock/uploads`) rather than duplicating the component.
- NEW `app/app/uploads/[id]/page.tsx` — from `app/app/stock/uploads/[id]/page.tsx`, back/not-found links → `/app/uploads`. If the shared bulk is large, extract the common loader into `lib/platform/stock-data.ts` or a small shared module rather than duplicating 270 lines; judgement call, report it.
- EDIT `components/platform/shell/UploadButton.tsx` (href + docblock).
- Optional: on `/app/stock/uploads`, nothing changes this task.

## Constraints

- No nav-config change (the Upload button is the entry; the 10 rows stay).
- `DocumentDetailPanel` and everything under `components/platform/docu/` stay frozen.
- No mutations against the live DB during verification; unauthenticated 307 checks only.
- House style, `--pf-*` tokens, server components by default.

## Verification

`npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build` · curl 307 checks for `/app/uploads` and `/app/uploads/<uuid>`.

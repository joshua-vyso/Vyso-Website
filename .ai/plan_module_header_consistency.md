# Plan — Module header above nav bar, all modules (2026-07-29)

## Goal / acceptance
Every module shows its identity header (icon + name + description, plus module-level primary
actions where they exist) ABOVE the tab nav, exactly like InsightGen/SupplySync (Chrome.tsx
pattern: ModuleHeader → SubNav → children). No module may render its page title/header below
the tabs, and no header may appear twice.

## Current state
- Correct already: reportgen/InsightGen, suppliers/SupplySync, serviceden (bespoke header above).
- Wrong (nav first, heading below): docu (per-page DocuNav, no layout), orderflow, procurepulse
  (PpSubnav in ui.tsx), pricepilot (SubNav in layout, hand-rolled header in page), marginview/
  PlanWise, shiftboard, wastelog/WasteWatch (SubNav in layout, ModuleHeader inside views).

## Approach
Per module: hoist the header into the module layout (or a small Chrome client component when
actions/state are needed), following components/platform/supplysync/Chrome.tsx. Remove the
now-duplicate ModuleHeader/hand-rolled titles from views/pages. Header content from MODULE_META
where the key exists; otherwise from the MODULES registry entry (docu/orderflow/procurepulse/
pricepilot/shiftboard) with matching accent tints from AppIcon. Page-level section titles
(e.g. "Documents", "Review queue") may remain as smaller in-page headings BELOW the nav — only
the module identity header moves above. Keep all existing actions working.

## Constraints
- No changes to shared kit signatures (module-ui.tsx ModuleHeader stays as-is; additive props ok).
- Doc-U/OrderFlow/ProcurePulse: header-placement restructure ONLY — zero feature-logic changes.
- Verify: tsc, lint (no new), npm run build, all module routes compile.

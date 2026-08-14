/**
 * Pure data helpers for the platform shell (components/platform/shell/**).
 * No 'use client' here on purpose: AppRail (server) and MobileTopBar (client)
 * both import from this file, so it has to stay import-safe for either side of
 * the server/client boundary — no hooks, no framework state.
 *
 * See .ai/plan_chat_first_shell.md §4.2 and §10 (Wave 1).
 */
import { MODULES, type ModuleDefinition } from '@/lib/platform/modules';
import type { FeatureKey } from '@/lib/platform/types';

/** One "Under the hood" row. `key` rides along (not just label/href, unlike
 *  BriefRail's original RailModule) so the rail can check `lockedModules`
 *  without a second lookup — see UnderTheHood.tsx and MobileDrawer.tsx. */
export interface RailModule {
  key: FeatureKey;
  label: string;
  href: string;
}

/**
 * The modules the org can see in "Under the hood", in registry order. Mirrors
 * the filter app/app/page.tsx currently applies before handing modules to
 * BriefRail (`m.status === 'active' && session.features[m.key]`) — lifted here
 * so the layout and any future page can share one copy (plan §4.1).
 *
 * Locked modules (`lockedModules`, a separate per-org override — see
 * lib/platform/supabase-server.ts) are DELIBERATELY still included: the rail
 * renders them, just as a non-navigating row that opens ModuleLockNotice
 * instead of a <Link> (plan §8 E2). Callers read `usePlatform().lockedModules`
 * client-side to tell the two apart.
 */
export function railModules(features: Record<FeatureKey, boolean>): RailModule[] {
  return MODULES.filter((m) => m.status === 'active' && features[m.key]).map((m) => ({
    key: m.key,
    label: m.label,
    href: m.screens.desktop,
  }));
}

/**
 * The MODULES entry that owns `pathname`, by longest-matching `screens.desktop`
 * prefix — the same resolution ModuleLockGuard.tsx uses to decide what's
 * locked, and the shell's active-row / active-lock logic reuses it rather than
 * re-deriving it. Returns null for non-module routes (`/app`,
 * `/app/organisation`, `/app/settings`, `/app/notifications`,
 * `/app/serviceden` — none of these are MODULES entries).
 */
export function moduleForPathname(pathname: string): ModuleDefinition | null {
  let current: ModuleDefinition | null = null;
  for (const m of MODULES) {
    const route = m.screens.desktop;
    const matches = pathname === route || pathname.startsWith(`${route}/`);
    if (matches && (current === null || route.length > current.screens.desktop.length)) {
      current = m;
    }
  }
  return current;
}

/** "Trial · N days left" copy, singular/zero-aware. Byte-identical to TopBar's
 *  former helper (components/platform/TopBar.tsx) — callers only render this
 *  when `trial` is non-null and not expired; TrialGate owns the expired state. */
export function trialPillLabel(daysLeft: number | null): string {
  if (daysLeft === 0) return 'Trial ends today';
  if (daysLeft === 1) return 'Trial · 1 day left';
  return `Trial · ${daysLeft} days left`;
}

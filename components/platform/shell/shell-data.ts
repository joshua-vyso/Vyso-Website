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

/** One module the org has. `key` rides along (not just label/href, unlike
 *  BriefRail's original RailModule) so a caller can check `lockedModules`
 *  without a second lookup — which is now `firstOpenableModuleHref` below
 *  rather than a rail row: Phase 0 replaced the "Under the hood" launcher with
 *  a fixed nav (nav-config.ts), so nothing RENDERS this list any more. */
export interface RailModule {
  key: FeatureKey;
  label: string;
  href: string;
}

/**
 * The modules the org has, in registry order (`m.status === 'active' &&
 * features[m.key]`).
 *
 * IT NO LONGER FEEDS A RAIL. Phase 0 replaced the module launcher with a fixed
 * nav, so the only callers left are the four routes that redirect someone away
 * from a screen they may not see — always through `firstOpenableModuleHref`
 * below, never by rendering this list.
 *
 * Locked modules (`lockedModules`, a separate per-org override — see
 * lib/platform/supabase-server.ts) are DELIBERATELY still included, which is
 * exactly why that helper exists rather than callers taking `[0]`.
 */
export function railModules(features: Record<FeatureKey, boolean>): RailModule[] {
  return MODULES.filter((m) => m.status === 'active' && features[m.key]).map((m) => ({
    key: m.key,
    label: m.label,
    href: m.screens.desktop,
  }));
}

/**
 * Where to send someone who may not open the screen they asked for.
 *
 * Used by the Brief's two routes (app/app/page.tsx, app/app/finding/[id]/page.tsx)
 * when `canSeeBrief` is false: a member gets bounced to work they can actually
 * do rather than a 403 (v2b — lib/platform/access.ts explains why a redirect and
 * not a refusal).
 *
 * THE `lockedModules` FILTER IS THE WHOLE POINT of this function existing rather
 * than the call sites writing `railModules(features)[0].href`. `railModules`
 * deliberately KEEPS locked modules, so its first entry can perfectly well be a
 * module this org has not bought. Redirecting someone we have just turned away
 * from the Brief onto a module they have not paid for would be two refusals in
 * a row, which is worse than the 403 we were avoiding. Hence "their first
 * UNLOCKED module", per plan §1.3.
 *
 * `/app/settings` is the floor: an org with every module off still has a
 * settings page, and it is the one route in the platform that is never gated by
 * features, locks or roles. It cannot bounce back here, so the redirect cannot
 * loop — nor can any module page: since Phase 0 removed `ModuleLockGuard`
 * nothing intercepts a module route at all, so the target simply renders.
 */
export function firstOpenableModuleHref(
  modules: readonly RailModule[],
  lockedModules: readonly FeatureKey[],
): string {
  return modules.find((m) => !lockedModules.includes(m.key))?.href ?? '/app/settings';
}

/**
 * The MODULES entry that owns `pathname`, by longest-matching `screens.desktop`
 * prefix. It used to be shared with `ModuleLockGuard` (deleted in Phase 0); its
 * one remaining caller is FinchBubble, which names the module in the chat
 * bubble's header. Returns null for non-module routes (`/app`,
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

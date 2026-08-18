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
 * Where to send someone who may not open the screen they asked for.
 *
 * Used by the Brief's two routes (app/app/page.tsx, app/app/finding/[id]/page.tsx)
 * when `canSeeBrief` is false: a member gets bounced to work they can actually
 * do rather than a 403 (v2b — lib/platform/access.ts explains why a redirect and
 * not a refusal).
 *
 * THE `lockedModules` FILTER IS THE WHOLE POINT of this function existing rather
 * than the call sites writing `railModules(features)[0].href`. `railModules`
 * deliberately KEEPS locked modules — the rail draws them as a row that opens
 * ModuleLockNotice — so its first entry can perfectly well be a module this org
 * has not bought. Redirecting someone we have just turned away from the Brief
 * onto a screen that says "this module is locked, email Joshua" would be two
 * refusals in a row, which is worse than the 403 we were avoiding. Hence "their
 * first UNLOCKED module", per plan §1.3.
 *
 * `/app/settings` is the floor: an org with every module off still has a
 * settings page, and it is the one route in the platform that is never gated by
 * features, locks or roles. It cannot bounce back here, so the redirect cannot
 * loop — nor can any module page, since ModuleLockGuard RENDERS a locked screen
 * rather than redirecting.
 */
export function firstOpenableModuleHref(
  modules: readonly RailModule[],
  lockedModules: readonly FeatureKey[],
): string {
  return modules.find((m) => !lockedModules.includes(m.key))?.href ?? '/app/settings';
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

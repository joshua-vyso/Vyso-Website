'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';

/**
 * Keep a server-rendered list live without a manual refresh.
 *
 * Subscribes to Supabase Realtime `postgres_changes` on one or more tables, scoped to
 * the caller's org, and re-runs the server component (router.refresh()) whenever a row
 * changes. This reconciles against server truth exactly like the existing optimistic
 * patterns — no client-side data shape to maintain.
 *
 * Requirements (both external to this file):
 *  - each table is in the `supabase_realtime` publication (supabase/realtime.sql), and
 *  - each table has an RLS SELECT policy scoped to the org — Realtime enforces RLS, so
 *    without it the browser simply receives nothing (fails closed, never cross-tenant).
 *
 * No-ops on the marketing/unconfigured path (createClient() null) and before an org is
 * known. The refresh is debounced so a batch insert (e.g. many line items at once)
 * collapses into a single re-fetch.
 */

/** A refresh newer than this is still server truth — returning to the tab changes nothing. */
const FRESH_MS = 60_000;
/** Away longer than this and we reconcile even if the socket claims it stayed healthy. */
const LONG_ABSENCE_MS = 5 * 60_000;
/** `focus` and `visibilitychange` both fire on a tab return; collapse them into one. */
const RETURN_DEDUPE_MS = 1_000;

export function useRealtimeRefresh(tables: string | readonly string[]): void {
  const router = useRouter();
  const { org } = usePlatform();
  const orgId = org?.id;
  // Stable primitive key so an inline array literal doesn't re-subscribe every render.
  const key = Array.isArray(tables) ? [...tables].sort().join(',') : (tables as string);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase || !orgId) return;

    const list = key.split(',').filter(Boolean);
    let timer: ReturnType<typeof setTimeout> | null = null;
    // The route just rendered on the server, so it starts as fresh as a refresh would make it.
    let lastRefreshAt = Date.now();
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        lastRefreshAt = Date.now();
        router.refresh();
      }, 400);
    };

    const channel = supabase.channel(`rt:${key}:${orgId}`);
    for (const table of list) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `org_id=eq.${orgId}` },
        refresh,
      );
    }
    // Only a SUBSCRIBED channel is actually delivering rows; TIMED_OUT / CLOSED /
    // CHANNEL_ERROR all mean events may be going missing right now.
    let socketHealthy = false;
    channel.subscribe((status) => {
      socketHealthy = String(status) === 'SUBSCRIBED';
    });

    // Self-heal if a realtime event is ever missed — a dropped socket, a laptop waking
    // from sleep, or a spotty connection. Coming back to the tab reconciles against
    // server truth, so the list is never silently stale even when the socket isn't.
    //
    // That only needs to happen when something could have been missed, so the reconcile
    // is gated: skip while the data is still fresh, and skip while the socket is healthy
    // unless the absence was long enough that a healthy-looking socket can't be trusted.
    // A plain window refocus with a live channel — the common case — now costs nothing.
    let hiddenSince: number | null = null;
    let lastReturnAt = 0;
    const onReturn = () => {
      if (document.visibilityState !== 'visible') {
        hiddenSince = Date.now();
        return;
      }
      const now = Date.now();
      // `focus` and `visibilitychange` both fire on a tab return — handle the first only.
      if (now - lastReturnAt < RETURN_DEDUPE_MS) return;
      lastReturnAt = now;

      const awayFor = hiddenSince === null ? 0 : now - hiddenSince;
      hiddenSince = null;

      if (now - lastRefreshAt < FRESH_MS) return;
      if (socketHealthy && awayFor < LONG_ABSENCE_MS) return;
      refresh();
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);

    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      void supabase.removeChannel(channel);
    };
  }, [key, orgId, router]);
}

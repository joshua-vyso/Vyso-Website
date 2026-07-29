'use client';

import type { ReactNode } from 'react';
import { useRealtimeRefresh } from '@/lib/platform/useRealtimeRefresh';
import { ShiftEditor } from './ShiftEditor';
import { CoverDrawer } from './CoverDrawer';
import { SwapCentre, SwapDraftModal } from './Swaps';

/**
 * ShiftBoard chrome: the cross-tab overlays (shift editor, cover finder, swap
 * centre) plus the live subscription.
 *
 * People ops is the module most likely to be watched on a second screen while
 * someone else edits — a clock-in, a call-out, an approved swap — so every tab
 * reconciles against server truth rather than going stale mid-shift.
 */
export function ShiftBoardChrome({ children }: { children: ReactNode }) {
  useRealtimeRefresh(['sb_roster_shifts', 'sb_attendance', 'sb_employees', 'sb_leave_requests', 'sb_shift_swaps']);

  return (
    <>
      {children}
      <ShiftEditor />
      <CoverDrawer />
      <SwapCentre />
      <SwapDraftModal />
    </>
  );
}

'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ModuleHeader, PrimaryAction } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { SubNav } from '@/components/platform/SubNav';
import { useRealtimeRefresh } from '@/lib/platform/useRealtimeRefresh';
import { ShiftEditor } from './ShiftEditor';
import { CoverDrawer } from './CoverDrawer';
import { SwapCentre, SwapDraftModal } from './Swaps';

const M = MODULE_META.shiftboard;

const TABS = [
  { label: 'Overview', href: '/app/shiftboard' },
  { label: 'Live Ops', href: '/app/shiftboard/live' },
  { label: 'Roster', href: '/app/shiftboard/roster' },
  { label: 'People', href: '/app/shiftboard/people' },
  { label: 'Attendance', href: '/app/shiftboard/attendance' },
  { label: 'Leave', href: '/app/shiftboard/leave' },
  { label: 'Insights', href: '/app/shiftboard/insights' },
];

/**
 * ShiftBoard chrome: the module identity header above the shared sub-nav (the
 * SupplySync/InsightGen arrangement), plus the cross-tab overlays (shift editor,
 * cover finder, swap centre) and the live subscription. "+ Create shift" is
 * module-level — it takes you to the Roster tab from wherever you are.
 *
 * People ops is the module most likely to be watched on a second screen while
 * someone else edits — a clock-in, a call-out, an approved swap — so every tab
 * reconciles against server truth rather than going stale mid-shift.
 */
export function ShiftBoardChrome({ children }: { children: ReactNode }) {
  const router = useRouter();
  useRealtimeRefresh(['sb_roster_shifts', 'sb_attendance', 'sb_employees', 'sb_leave_requests', 'sb_shift_swaps']);

  return (
    <>
      <ModuleHeader
        icon={M.icon}
        title={M.name}
        description={M.description}
        actions={<PrimaryAction onClick={() => router.push('/app/shiftboard/roster')}>+ Create shift</PrimaryAction>}
      />
      <div className="mt-5">
        <SubNav tabs={TABS} rootHref="/app/shiftboard" />
      </div>
      <div className="mt-6">{children}</div>

      <ShiftEditor />
      <CoverDrawer />
      <SwapCentre />
      <SwapDraftModal />
    </>
  );
}

import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getShiftBoardData } from '@/lib/platform/shiftboard-data';
import { EMPTY_SHIFTBOARD } from '@/lib/platform/shiftboard';
import { ShiftBoardProvider } from '@/components/platform/shiftboard/context';
import { ShiftBoardChrome } from '@/components/platform/shiftboard/Chrome';

/** ShiftBoard chrome: fetch the org's people-ops data once, provide it to every
 *  tab, and host the module header + sub-nav + cross-tab overlays. */
export default async function ShiftBoardLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const data = session.org ? await getShiftBoardData(session.org.id) : EMPTY_SHIFTBOARD;

  return (
    <div className="px-8 py-7">
      <ShiftBoardProvider data={data}>
        <ShiftBoardChrome>{children}</ShiftBoardChrome>
      </ShiftBoardProvider>
    </div>
  );
}

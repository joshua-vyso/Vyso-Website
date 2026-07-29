import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getWasteWatchData, EMPTY_WASTEWATCH } from '@/lib/platform/wastewatch-data';
import { WasteWatchProvider } from '@/components/platform/wastewatch/categories';
import { WasteWatchChrome } from '@/components/platform/wastewatch/Chrome';

/** WasteWatch chrome: fetch the org's waste intelligence once, provide it to
 *  every tab, and host the module header + sub-nav + log-waste modal. */
export default async function WasteWatchLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const data = session.org ? await getWasteWatchData(session.org.id) : EMPTY_WASTEWATCH;

  return (
    <div className="px-8 py-7">
      <WasteWatchProvider data={data}>
        <WasteWatchChrome>{children}</WasteWatchChrome>
      </WasteWatchProvider>
    </div>
  );
}

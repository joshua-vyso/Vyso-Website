import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getPlanWiseData, EMPTY_PLANWISE } from '@/lib/platform/planwise-data';
import { PlanWiseProvider } from '@/components/platform/planwise/context';
import { PlanWiseChrome } from '@/components/platform/planwise/Chrome';

/** PlanWise chrome: fetch the org's plan + its measured month-to-date actuals
 * once, provide them to every tab, and host the sub-nav / live subscription. */
export default async function PlanWiseLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const data = session.org ? await getPlanWiseData(session.org.id) : EMPTY_PLANWISE;

  return (
    <div className="px-8 py-7">
      <PlanWiseProvider data={data}>
        <PlanWiseChrome>{children}</PlanWiseChrome>
      </PlanWiseProvider>
    </div>
  );
}

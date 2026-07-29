import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { getInsightGenBrain, EMPTY_BRAIN } from '@/lib/platform/insightgen-data';
import { InsightGenProvider } from '@/components/platform/insightgen/context';
import { InsightGenChrome } from '@/components/platform/insightgen/Chrome';

/** InsightGen chrome: run the cross-module aggregation once per request, provide
 *  it to every tab, and host the shared create-report modal. */
export default async function InsightGenLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformSession();
  if (!session) redirect('/login');

  const data = session.org ? await getInsightGenBrain(session.org.id) : EMPTY_BRAIN;

  return (
    <div className="px-8 py-7">
      <InsightGenProvider data={data}>
        <InsightGenChrome>{children}</InsightGenChrome>
      </InsightGenProvider>
    </div>
  );
}

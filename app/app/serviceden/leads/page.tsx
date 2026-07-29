import { LeadsView } from '@/components/platform/serviceden/LeadsView';
import { getServiceDenLeadPageData } from '@/lib/platform/serviceden-leads-data';
import { requireServiceDenOrgSession } from '@/lib/platform/serviceden-access';

export default async function ServiceDenLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail_connected?: string; gmail_error?: string }>;
}) {
  const session = await requireServiceDenOrgSession();

  const [data, query] = await Promise.all([
    getServiceDenLeadPageData(session.org.id, session.userId),
    searchParams,
  ]);

  return (
    <LeadsView
      initialData={data}
      orgId={session.org.id}
      userId={session.userId}
      notice={query.gmail_connected ? `Connected ${query.gmail_connected}` : null}
      initialError={query.gmail_error ?? null}
    />
  );
}

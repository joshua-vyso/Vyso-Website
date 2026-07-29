import { TemplatesView } from '@/components/platform/serviceden/TemplatesView';
import { getServiceDenTemplatePageData } from '@/lib/platform/serviceden-email-data';
import { requireServiceDenOrgSession } from '@/lib/platform/serviceden-access';

export default async function ServiceDenTemplatesPage() {
  const session = await requireServiceDenOrgSession();

  const data = await getServiceDenTemplatePageData(session.org.id);

  return <TemplatesView initialData={data} orgId={session.org.id} userId={session.userId} />;
}

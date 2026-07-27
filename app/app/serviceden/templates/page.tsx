import { redirect } from 'next/navigation';
import { TemplatesView } from '@/components/platform/serviceden/TemplatesView';
import { getServiceDenTemplatePageData } from '@/lib/platform/serviceden-email-data';
import { SERVICEDEN_ACCOUNT_EMAIL } from '@/lib/platform/serviceden';
import { getPlatformSession } from '@/lib/platform/supabase-server';

export default async function ServiceDenTemplatesPage() {
  const session = await getPlatformSession();
  if (!session) redirect('/login');
  if (!session.org || session.email.toLowerCase() !== SERVICEDEN_ACCOUNT_EMAIL) redirect('/app');

  const data = await getServiceDenTemplatePageData(session.org.id);

  return <TemplatesView initialData={data} orgId={session.org.id} userId={session.userId} />;
}

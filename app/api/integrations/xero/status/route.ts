import { NextResponse } from 'next/server';
import {
  createServerSupabase,
  getPlatformSession,
} from '@/lib/platform/supabase-server';
import { xeroOAuthConfigured } from '@/lib/platform/xero';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getPlatformSession();
  if (!session?.org) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from('xero_connections')
    .select('id, tenant_name, status, last_synced_at, updated_at')
    .eq('org_id', session.org.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    configured: xeroOAuthConfigured,
    canManage: session.profile?.role === 'owner' || session.profile?.role === 'admin',
    connection: data ?? null,
  });
}

import { NextResponse } from 'next/server';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';
import { getOutreachLeads } from '@/lib/platform/notion-outreach';
import { listOutreachBounces } from '@/lib/platform/outreach-bounces';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Polled by Today's Outreach for a minute or so after a send, and read directly
 * by the Bounces page. `days` is narrowed by the poller so a just-sent batch is
 * checked cheaply instead of re-scanning a month of reports.
 */
export async function GET(request: Request) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const days = Number(new URL(request.url).searchParams.get('days')) || 30;
  const result = await listOutreachBounces(ctx, await getOutreachLeads(), {
    days: Math.min(Math.max(days, 1), 90),
  });
  if (!result.bounces) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ bounces: result.bounces });
}

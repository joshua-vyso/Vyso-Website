import { NextResponse } from 'next/server';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';
import {
  ResearchError,
  getLeadResearch,
  runLeadResearch,
  serviceDenResearchConfigured,
  toggleResearchExclusion,
} from '@/lib/platform/serviceden-research';

export const runtime = 'nodejs';
export const maxDuration = 60;

function failure(error: unknown) {
  if (error instanceof ResearchError) return NextResponse.json({ error: error.message }, { status: error.status });
  const message = error instanceof Error ? error.message : 'Company research failed.';
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    const result = await getLeadResearch(ctx, id);
    return NextResponse.json({ ...result, configured: serviceDenResearchConfigured }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    refresh?: unknown;
    confirmUrl?: unknown;
    toggleExclude?: unknown;
  };

  try {
    if (typeof body.toggleExclude === 'string' && body.toggleExclude) {
      const research = await toggleResearchExclusion(ctx, id, body.toggleExclude);
      return NextResponse.json({ research, staleSuggested: false });
    }
    if (!serviceDenResearchConfigured) {
      return NextResponse.json({ error: 'Company research is not configured on the server.' }, { status: 400 });
    }
    const result = await runLeadResearch(ctx, id, {
      refresh: body.refresh === true,
      confirmUrl: typeof body.confirmUrl === 'string' && body.confirmUrl ? body.confirmUrl : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return failure(error);
  }
}

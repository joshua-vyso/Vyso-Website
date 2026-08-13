import { NextResponse } from 'next/server';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';
import {
  createSegment,
  getSegments,
  notionErrorStatus,
  updateSegment,
  type SegmentEdit,
} from '@/lib/platform/notion-outreach';

export const runtime = 'nodejs';

function asEdit(body: Record<string, unknown>): SegmentEdit {
  return {
    name: String(body.name ?? ''),
    dailyQuota: Number(body.dailyQuota ?? 0),
    searchBrief: String(body.searchBrief ?? ''),
    industryLabels: String(body.industryLabels ?? ''),
    active: body.active === true,
    priority: Number(body.priority ?? 999),
  };
}

export async function GET() {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ segments: await getSegments() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not read segments.' },
      { status: notionErrorStatus(error) },
    );
  }
}

/** Create (no pageId) or update (pageId set). n8n reads the database fresh on
 *  every run, so a save here is live on the very next execution — there is no
 *  deploy step and nothing else to sync. */
export async function POST(request: Request) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const pageId = typeof body.pageId === 'string' ? body.pageId : '';

  try {
    const edit = asEdit(body);
    if (pageId) {
      await updateSegment(pageId, edit);
      return NextResponse.json({ ok: true, id: pageId });
    }
    const id = await createSegment(edit);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Save failed.' },
      { status: notionErrorStatus(error) },
    );
  }
}

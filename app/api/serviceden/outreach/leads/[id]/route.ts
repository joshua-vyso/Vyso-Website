import { NextResponse } from 'next/server';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';
import { notionErrorStatus, updateLead, type LeadEdit } from '@/lib/platform/notion-outreach';

export const runtime = 'nodejs';

/** Only these keys may be written; anything else in the body is ignored. */
const EDITABLE: (keyof LeadEdit)[] = [
  'company',
  'email',
  'phone',
  'website',
  'notes',
  'industry',
  'campaign',
  'outreachStage',
  'icpScore',
  'nextFollowUp',
  'replied',
  'signed',
];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const edit: LeadEdit = {};
  for (const key of EDITABLE) {
    if (!(key in body)) continue;
    const value = body[key];
    if (key === 'icpScore') {
      if (value === null || value === '') {
        edit.icpScore = null;
      } else {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0 || n > 8) {
          return NextResponse.json({ error: 'ICP score must be between 0 and 8.' }, { status: 400 });
        }
        edit.icpScore = Math.round(n);
      }
    } else if (key === 'replied' || key === 'signed') {
      edit[key] = value === true;
    } else if (key === 'nextFollowUp') {
      const s = typeof value === 'string' ? value.trim() : '';
      if (s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return NextResponse.json({ error: 'Next follow-up must be YYYY-MM-DD.' }, { status: 400 });
      }
      edit.nextFollowUp = s || null;
    } else if (typeof value === 'string') {
      edit[key] = value;
    }
  }

  if (Object.keys(edit).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  try {
    await updateLead(id, edit);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Notion update failed.';
    return NextResponse.json({ error: message }, { status: notionErrorStatus(error) });
  }

  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}

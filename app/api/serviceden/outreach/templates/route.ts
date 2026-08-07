import { NextResponse } from 'next/server';
import { requireServiceDenServerContext } from '@/lib/platform/serviceden-server';
import {
  createTemplate,
  getEmailTemplates,
  notionErrorStatus,
  updateTemplate,
  type TemplateEdit,
} from '@/lib/platform/notion-outreach';

export const runtime = 'nodejs';

function readEdit(body: Record<string, unknown>): TemplateEdit | string {
  const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) : '');
  const edit: TemplateEdit = {
    name: str('name').trim(),
    campaign: str('campaign').trim(),
    templateKey: str('templateKey').trim(),
    subject: str('subject'),
    body: str('body'),
    active: body.active !== false,
    notes: typeof body.notes === 'string' ? body.notes : undefined,
  };
  if (!edit.name) return 'A template name is required.';
  return edit;
}

export async function GET() {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json({ templates: await getEmailTemplates() }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read templates.';
    return NextResponse.json({ error: message }, { status: notionErrorStatus(error) });
  }
}

export async function POST(request: Request) {
  const ctx = await requireServiceDenServerContext();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const edit = readEdit(body);
  if (typeof edit === 'string') return NextResponse.json({ error: edit }, { status: 400 });

  const pageId = typeof body.pageId === 'string' ? body.pageId.trim() : '';
  try {
    // A campaign+key pair must stay unique: n8n looks templates up by that pair and
    // would pick an arbitrary one of two duplicates.
    if (!pageId) {
      const existing = await getEmailTemplates();
      const clash = existing.find(
        (t) => t.campaign === edit.campaign && t.templateKey === edit.templateKey && t.active,
      );
      if (clash) {
        return NextResponse.json(
          { error: `An active ${edit.campaign} "${edit.templateKey}" template already exists (${clash.name}). Edit it, or deactivate it first.` },
          { status: 409 },
        );
      }
      const id = await createTemplate(edit);
      return NextResponse.json({ ok: true, id });
    }
    await updateTemplate(pageId, edit);
    return NextResponse.json({ ok: true, id: pageId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Notion write failed.';
    return NextResponse.json({ error: message }, { status: notionErrorStatus(error) });
  }
}

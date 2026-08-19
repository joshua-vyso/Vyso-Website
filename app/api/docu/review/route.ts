import { NextResponse } from 'next/server';
import { resolveUser } from '@/lib/ai/auth';
import { commitDocument, discardDocument } from '@/lib/platform/document-ingest';

export const maxDuration = 120;

/**
 * Act on a document sitting in the Doc-U review queue — owner/admin only.
 *
 * Email-ingested documents are extracted and parked at status 'extracted' WITHOUT
 * committing their side effects. A human decides here:
 *
 *   save    — run the side effects (OrderFlow order/invoice, ProcurePulse stock +
 *             supplier prices) and mark the document approved. This is the FIRST time
 *             anything touches stock or money for an emailed document.
 *   discard — mark it rejected. It leaves the queue but stays for audit; nothing was
 *             committed, so there is nothing to reverse.
 *
 * All writes go through the caller's RLS-scoped client and are additionally pinned to
 * the caller's org, so a document id from another tenant resolves to nothing.
 *
 * Body: { id, action: 'save' | 'discard' }.
 */
export async function POST(req: Request) {
  const auth = await resolveUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', auth.userId)
    .maybeSingle<{ org_id: string | null; role: string }>();
  if (!profile?.org_id || (profile.role !== 'owner' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Only an owner or admin can review documents.' }, { status: 403 });
  }
  const orgId = profile.org_id;

  const body = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown };
  const id = typeof body.id === 'string' ? body.id : '';
  const action = body.action === 'save' || body.action === 'discard' ? body.action : '';
  if (!id || !action) {
    return NextResponse.json({ error: 'An id and a valid action are required.' }, { status: 400 });
  }

  if (action === 'discard') {
    // Soft reject — the write itself, its org scoping and its claim guard now live in
    // `discardDocument` (document-ingest.ts), so the Review chat's pane and this route
    // cannot drift into two opinions about what a discard does.
    const discarded = await discardDocument(auth.supabase, { documentId: id, orgId, userId: auth.userId });
    if (!discarded.ok) {
      return NextResponse.json({ error: discarded.error }, { status: discarded.status });
    }
    return NextResponse.json({ ok: true, id, action });
  }

  const result = await commitDocument(auth.supabase, { documentId: id, orgId, userId: auth.userId });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, id, action });
}

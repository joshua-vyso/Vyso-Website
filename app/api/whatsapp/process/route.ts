import { NextResponse } from 'next/server';
import { createServiceSupabase } from '@/lib/platform/supabase-service';
import { processWhatsAppIngest, STALE_PROCESSING_MS } from '@/lib/platform/whatsapp-ingest';

export const maxDuration = 300;

/** Give up on a message after this many attempts so a poison one can't loop. */
const MAX_ATTEMPTS = 3;
/** Bounded per run so one invocation can't run past its budget. */
const BATCH = 10;

/**
 * An unanswered confirm card goes stale after this long.
 *
 * Without an expiry, a customer who never replies leaves a draft open forever — and a
 * stray "yes" weeks later would place an order they no longer want, at prices that have
 * moved. It also blocks that sender's open-draft slot. Three days covers a weekend,
 * which is the realistic gap for a produce order that went unanswered on a Friday.
 */
const DRAFT_EXPIRY_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Safety net for the inbound-WhatsApp queue.
 *
 * The happy path never needs this: /api/whatsapp/inbound processes each message in
 * after() right when it lands. This drains what that missed — messages whose
 * invocation timed out or crashed mid-way — and expires confirm cards nobody answered.
 * Runs on a Vercel Cron (see vercel.json); the schedule is deliberately not
 * load-bearing, so a slow cron tier only delays recovery, never normal ingest.
 *
 * Authenticated with CRON_SECRET — Vercel Cron sends it as a bearer token.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not set.' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Service role is not configured.' }, { status: 503 });
  }

  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();

  // Queued work, plus anything that died mid-flight.
  const { data: queued } = await supabase
    .from('whatsapp_ingests')
    .select('id')
    .eq('status', 'queued')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH);

  // Staleness is measured from when a worker CLAIMED the row, not from when the
  // message arrived. A NULL claimed_at (a row left 'processing' by pre-migration code,
  // or any future writer that forgets to stamp it) must read as STALE — `claimed_at <
  // x` is NULL-not-true in SQL, so without the explicit is.null it would be excluded
  // forever and the message stranded with no recovery path.
  const { data: stale } = await supabase
    .from('whatsapp_ingests')
    .select('id')
    .eq('status', 'processing')
    .lt('attempts', MAX_ATTEMPTS)
    .or(`claimed_at.is.null,claimed_at.lt.${staleBefore}`)
    .order('claimed_at', { ascending: true, nullsFirst: true })
    .limit(BATCH);

  const ids = [
    ...((queued ?? []) as { id: string }[]).map((r) => r.id),
    ...((stale ?? []) as { id: string }[]).map((r) => r.id),
  ].slice(0, BATCH);

  // Serial on purpose: each one runs an AI extraction, and a burst would blow both the
  // function budget and the model rate limit.
  for (const id of ids) {
    await processWhatsAppIngest(supabase, id);
  }

  // Confirm cards nobody answered. Expiring them frees the sender's open-draft slot and
  // stops a very late "yes" placing a stale order. The document stays in Doc-U, so
  // nothing the customer sent is lost — a founder can still act on it by hand.
  const { data: expired } = await supabase
    .from('whatsapp_ingests')
    .update({ status: 'expired', error: 'The customer never confirmed this order.' })
    .eq('status', 'awaiting_confirmation')
    .lt('created_at', new Date(Date.now() - DRAFT_EXPIRY_MS).toISOString())
    .select('id');

  // Anything that has burned through its attempts is dead — stop retrying it.
  await supabase
    .from('whatsapp_ingests')
    .update({ status: 'failed', error: 'Gave up after repeated failures.' })
    .in('status', ['queued', 'processing'])
    .gte('attempts', MAX_ATTEMPTS);

  return NextResponse.json({
    ok: true,
    processed: ids.length,
    expired: ((expired ?? []) as { id: string }[]).length,
  });
}

import { NextResponse } from 'next/server';
import { disconnectXero, requireXeroServerContext } from '@/lib/platform/xero';

export const runtime = 'nodejs';

export async function POST() {
  const ctx = await requireXeroServerContext();
  if (!ctx) return NextResponse.json({ error: 'Only an owner or admin can disconnect Xero.' }, { status: 403 });

  try {
    const result = await disconnectXero(ctx);
    return NextResponse.json({ ok: true, warning: result.warning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not disconnect Xero.' },
      { status: 500 },
    );
  }
}

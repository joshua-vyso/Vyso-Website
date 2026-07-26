import { NextResponse } from 'next/server';
import {
  createXeroAuthorizationUrl,
  requireXeroServerContext,
} from '@/lib/platform/xero';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const ctx = await requireXeroServerContext();
  if (!ctx) return NextResponse.json({ error: 'Only an owner or admin can connect Xero.' }, { status: 403 });

  try {
    return NextResponse.redirect(await createXeroAuthorizationUrl(ctx));
  } catch (error) {
    const destination = new URL('/app/settings', request.url);
    destination.searchParams.set(
      'xero_error',
      (error instanceof Error ? error.message : 'Could not connect Xero.').slice(0, 300),
    );
    return NextResponse.redirect(destination);
  }
}

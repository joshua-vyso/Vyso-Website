import { NextResponse } from 'next/server';
import {
  finishXeroAuthorization,
  requireXeroServerContext,
} from '@/lib/platform/xero';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const ctx = await requireXeroServerContext();
  if (!ctx) return NextResponse.redirect(new URL('/login', request.url));

  const requestUrl = new URL(request.url);
  const destination = new URL('/app/settings', request.url);
  const providerError = requestUrl.searchParams.get('error');
  const providerDescription = requestUrl.searchParams.get('error_description');
  const code = requestUrl.searchParams.get('code');
  const state = requestUrl.searchParams.get('state');

  if (providerError) {
    destination.searchParams.set(
      'xero_error',
      `Xero authorization was cancelled: ${providerDescription || providerError}`.slice(0, 300),
    );
    return NextResponse.redirect(destination);
  }
  if (!code || !state) {
    destination.searchParams.set(
      'xero_error',
      'Xero did not return a valid authorization response.',
    );
    return NextResponse.redirect(destination);
  }

  try {
    const result = await finishXeroAuthorization(ctx, { code, state });
    destination.searchParams.set('xero_connected', result.tenantName);
  } catch (error) {
    destination.searchParams.set(
      'xero_error',
      (error instanceof Error ? error.message : 'Could not finish the Xero connection.').slice(
        0,
        300,
      ),
    );
  }
  return NextResponse.redirect(destination);
}

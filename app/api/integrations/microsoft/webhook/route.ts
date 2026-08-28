import { rateLimitAllowed } from '@/lib/platform/rate-limit';
import {
  handleMicrosoftGraphWebhook,
  type MicrosoftGraphWebhookLog,
} from '@/lib/platform/microsoft-graph-webhook';

export const runtime = 'nodejs';
export const maxDuration = 10;

function configured(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function safeLog(event: MicrosoftGraphWebhookLog): void {
  // The event type contains no raw payload fields or secrets. Keep it that way:
  // webhook terminal output is an operational audit trail, not customer data.
  console.log('[microsoft-graph-webhook]', event);
}

export async function POST(request: Request): Promise<Response> {
  return handleMicrosoftGraphWebhook(
    request,
    {
      clientState: configured('MICROSOFT_GRAPH_CLIENT_STATE'),
      expectedSubscriptionId: configured('MICROSOFT_GRAPH_SUBSCRIPTION_ID'),
      tenantId: configured('ENTRA_DIRECTORY_ID_TNS'),
      mailbox: configured('MICROSOFT_MAILBOX'),
    },
    { rateLimitAllowed, log: safeLog },
  );
}

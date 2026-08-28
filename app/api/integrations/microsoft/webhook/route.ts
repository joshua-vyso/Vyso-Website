import { after } from 'next/server';
import { rateLimitAllowed } from '@/lib/platform/rate-limit';
import { processEmailIngest } from '@/lib/platform/email-ingest';
import { enqueueMicrosoftGraphNotifications } from '@/lib/platform/microsoft-graph-ingest';
import {
  handleMicrosoftGraphWebhook,
  type MicrosoftGraphWebhookLog,
} from '@/lib/platform/microsoft-graph-webhook';
import { createServiceSupabase } from '@/lib/platform/supabase-service';

export const runtime = 'nodejs';
// The response stays fast; after() shares this budget with the existing durable worker.
export const maxDuration = 300;

function configured(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function safeLog(event: MicrosoftGraphWebhookLog): void {
  // The event type contains no raw payload fields or secrets. Keep it that way:
  // webhook terminal output is an operational audit trail, not customer data.
  console.log('[microsoft-graph-webhook]', event);
}

export async function POST(request: Request): Promise<Response> {
  const mailbox = configured('MICROSOFT_MAILBOX');
  return handleMicrosoftGraphWebhook(
    request,
    {
      clientState: configured('MICROSOFT_GRAPH_CLIENT_STATE'),
      expectedSubscriptionId: configured('MICROSOFT_GRAPH_SUBSCRIPTION_ID'),
      tenantId: configured('ENTRA_DIRECTORY_ID_TNS'),
      mailbox,
    },
    {
      rateLimitAllowed,
      log: safeLog,
      onNotifications: async (notifications) => {
        const orgId = configured('MICROSOFT_GRAPH_ORG_ID');
        const supabase = createServiceSupabase();
        if (!orgId || !mailbox || !supabase) {
          throw new Error('Microsoft Graph ingestion persistence is not configured.');
        }
        const ingestIds = await enqueueMicrosoftGraphNotifications(supabase, {
          orgId,
          mailbox,
          notifications,
        });
        for (const ingestId of ingestIds) {
          after(async () => {
            const client = createServiceSupabase();
            if (client) await processEmailIngest(client, ingestId);
          });
        }
      },
    },
  );
}

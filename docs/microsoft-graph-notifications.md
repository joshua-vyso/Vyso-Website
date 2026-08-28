# Microsoft Graph order-inbox notifications

This milestone is notification-only. It does not fetch mail, fetch attachments,
run extraction, enqueue work, or modify the mailbox.

## Public endpoint

`POST https://vyso.co.za/api/integrations/microsoft/webhook`

The route is a public Next.js App Router handler on Vercel. It is outside `/app`,
so the authenticated UI's Supabase proxy, browser cookies, user sessions, and CSRF
controls are not involved.

Microsoft's validation request is the only reflected input: a URL-decoded
`validationToken` is returned immediately as exact `text/plain`. It is never logged.

Normal notification bodies are capped at 128 KiB and must pass all of these checks:

- configured 256-bit `clientState`, compared in constant time;
- configured subscription id;
- Turn n Slice tenant id;
- `changeType === "created"`;
- Outlook message resource type and a present message id;
- a Microsoft Graph message-instance resource path, with no explicitly different
  mailbox or non-Inbox folder;
- the existing durable, fleet-wide rate limiter (1,000 authenticated deliveries per
  subscription per minute; fail-open because it is defense in depth).

Logs contain only outcome/category, count, change type, resource-match and id-presence
booleans, timestamp, and the first 12 hex characters of a SHA-256 subscription-id hash.

## Why incoming `resource` is not literal subscription-resource equality

The subscription is created for exactly:

`users/orders@turnnslice.com/mailFolders('Inbox')/messages`

Microsoft's Outlook notification payload describes the changed message instance,
however, commonly as `Users/{mailbox-directory-guid}/Messages/{message-id}`. It does
not necessarily repeat the mailbox UPN or folder. The configured subscription id,
tenant id, and secret client state therefore bind that instance path to the exact
Inbox subscription. If a payload explicitly names another mailbox or folder, it is
rejected.

## Initial deployment and creation

1. Generate the local secret without printing it:
   `npm run microsoft:subscription:init`.
2. Set the same `MICROSOFT_GRAPH_CLIENT_STATE` value in Vercel.
3. Set `MICROSOFT_GRAPH_WEBHOOK_URL` in Vercel to the production endpoint above.
4. Leave `MICROSOFT_GRAPH_SUBSCRIPTION_ID` empty for the first deployment. The
   validation-token handshake remains available, while normal notifications fail
   closed.
5. Deploy and verify the HTTPS route is reachable.
6. Run `npm run microsoft:subscription:create`. Microsoft validates the URL during
   this request. The command prints only safe subscription metadata.
7. Store the returned id as `MICROSOFT_GRAPH_SUBSCRIPTION_ID` in `.env.local` and
   Vercel, then redeploy. Never put the client state or Microsoft client secret in Git.
8. Run `npm run microsoft:subscription:inspect` to confirm the pinned subscription.

## Expiration and renewal

Basic Outlook message subscriptions have a maximum lifetime of seven days. Vyso asks
for six days to retain renewal headroom. For this milestone renewal is deliberately
manual:

`npm run microsoft:subscription:renew`

The renewal request PATCHes `expirationDateTime` only. No resource, permission,
notification URL, or mailbox state changes.

Automated renewal is required in the next reliability milestone, but no scheduler or
worker is added now. When integration persistence is introduced, store subscription id,
expiration, resource, last-renewed time, and status in that integration-config record;
the environment variable is the smallest safe single-client bridge, not the eventual
multi-client data model.

## Edge filtering

The deployment is Vercel. Microsoft does not document a stable Graph-webhook-specific
CIDR set suitable for a route allowlist, so no application IP filter is applied. A
Vercel Firewall rule can be evaluated separately if Microsoft publishes an authoritative
range. Client state, subscription id, tenant id, and resource validation remain the
primary controls.

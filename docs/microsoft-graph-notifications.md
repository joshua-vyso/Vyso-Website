# Microsoft Graph order-inbox notifications

Microsoft 365 is a permanently read-only source for Vyso. Subscription lifecycle
operations are allowed; mailbox access is limited to GET requests. Vyso never moves,
deletes, edits, flags, categorises, marks read/unread, replies to, forwards, or sends
mail. `Application Mail.Read` remains the maximum mailbox permission.

All workflow state lives in Supabase and all attachment processing happens on a copy
in Vyso's private `documents` Storage bucket. Outlook is never used as a queue or as a
processing-status store.

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

## Durable ingestion boundary

The validated notification and document processing are separate durability boundaries:

1. Before returning `202`, the webhook inserts a queued `email_ingests` row containing
   the trusted Vyso org id, mailbox, and Graph message id.
2. Unique database indexes make duplicate message notifications a no-op.
3. Next.js `after()` starts processing immediately when possible, but correctness does
   not depend on it.
4. The existing `/api/email/process` cron claims queued or stale-processing rows and
   runs the same provider-dispatch worker. The owner/admin Retry action can requeue an
   explicit `failed` row.
5. Attachment ids are recorded as each document is filed. A retry also queries existing
   `documents.source_attachment_id` values to heal a crash between document insert and
   progress update. The database additionally forbids a second document for the same
   `(email_ingest_id, source_attachment_id)`.

The Graph adapter performs only these mailbox reads:

- GET one message's metadata, text body, preview, and conversation id;
- GET attachment metadata without `contentBytes`;
- GET `$value` for supported PDF/image file attachments within the existing 13 MiB cap.

The copied bytes are handed to `lib/platform/document-ingest.ts`; no Microsoft-specific
PDF, image, OCR, or AI parser exists.

## Message-level classification and attachment dispositions

Classification keeps each source distinct instead of concatenating everything into one
keyword string. The deterministic pass considers subject, sender/domain, full text body,
body preview, attachment filename, attachment MIME type, and later the existing document
parser's result. It stores only bounded machine evidence codes, never body, subject,
sender, or filename content in classification diagnostics.

The result records:

- taxonomy and confidence;
- whether a real request to supply goods was detected;
- `attachment`, `email_body`, `combined`, or `none` as the primary source;
- safe machine evidence explaining the decision.

Ordering intent requires corroboration such as an explicit supply/delivery request plus
quantity/UOM lines, a structured Order/Requisition message, or an order-labelled
attachment. Price and availability enquiries, complaints, product discussion, historic
order references, and an unsubstantiated "please see attached" do not become orders.

Every attachment receives a durable disposition. Inline furniture and non-document
parts are ignored; unsupported business documents remain actionable. A non-inline `.pdf`
reported as `application/octet-stream` is provisional: Vyso downloads it through the
same bounded Graph GET, requires a `%PDF-` byte signature, then normalises only the
Vyso-side processing MIME to `application/pdf`. The provider MIME remains unchanged in
provenance. A fake PDF filename never reaches the parser.

Final email status uses the existing state model:

- `done` only when a document was successfully processed;
- `failed` when parsing/storage fails, a business document is unsupported, or a
  detected body order cannot be preserved/extracted into review;
- `ignored` for genuine non-actionable correspondence with no processable business
  document.

Re-run `supabase/microsoft-graph-ingest.sql` before deploying this Wave A code. The
idempotent additions store classification evidence, attachment diagnostics, and Graph
id-format provenance.

`deferCommit: true` is mandatory for Microsoft email attachments. It files and extracts
the document for review, but does not resolve/create suppliers, create orders or
invoices, update stock, or feed ProcurePulse/SupplySync. Those side effects remain behind
the existing human Save/approval path.

Apply `supabase/microsoft-graph-ingest.sql` before deploying ingestion, and configure
`MICROSOFT_GRAPH_ORG_ID` to the trusted Turn n Slice organisation UUID. Never derive an
organisation from sender, subject, body, or attachment content.

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

`MICROSOFT_GRAPH_ID_TYPE` defaults to `rest_id`. Leave it there for the current live
subscription. Merely deploying Wave A does not opt into immutable identifiers.

## Future immutable-id cutover (manual; not performed by Wave A)

The transport is prepared for `rest_immutable_entry_id`, but it is deliberately
default-off. Microsoft applies `Prefer: IdType="ImmutableId"` to the subscription create
request only when that id type is explicitly configured, and the worker applies the same
preference to subsequent read-only message/attachment GETs. Each queued ingest records
which format its message id uses, so mutable and future immutable rows do not get mixed.

Microsoft does not convert an existing change-notification subscription in place. A
future cutover therefore requires a separately approved operation:

1. Apply the updated `supabase/microsoft-graph-ingest.sql` and deploy this compatible
   code while `MICROSOFT_GRAPH_ID_TYPE=rest_id`.
2. Inspect the live subscription and drain/reconcile queued or stale ingests.
3. Record a UTC cutover start time for a later read-only Inbox reconciliation.
4. Delete the existing subscription only after explicit approval. This changes the
   Graph subscription, not mailbox content.
5. Set `MICROSOFT_GRAPH_ID_TYPE=rest_immutable_entry_id` for both the admin command and
   Vercel, then create the same Inbox-only, `created`, basic-notification subscription.
6. Store the returned subscription id in Vercel and redeploy immediately.
7. Reconcile the short cutover window using Graph Inbox GETs only.
8. Leave historical `rest_id` rows unchanged. `translateExchangeIds` is a Graph POST and
   is outside Vyso's mailbox-GET-only invariant unless separately approved.

Do not change the current subscription merely to test this preparation.

## Email-body orders and message-level reconciliation

Wave B keeps the email message as the intent envelope:

```text
email message
  |-- body evidence
  `-- attachment evidence
          |
          v
message-level reconciliation
          |
          v
one canonical review order
```

For a genuine body-only order, Vyso stores the exact Graph-returned text representation
in the private `documents` bucket and files exactly one order document with:

- `documents.source_type = 'email_body'`;
- deterministic `source_attachment_id = 'email-body'`;
- deterministic Storage key derived from `(email_ingest_id, 'email-body')`;
- the same canonical order extraction schema as PDF/image orders;
- `deferCommit: true`.

`email_ingests.body_source_storage_path` and `body_source_content_type` are safe source
references; raw body text is never copied into logs. The existing unique document index
on `(email_ingest_id, source_attachment_id)` makes duplicate notifications, crashes and
retries converge on the same document and Storage object. A pending/errored body row is
recoverable into that same row by the cron/retry worker.

When an attachment order and meaningful body order evidence coexist, the attachment
document remains the one canonical review object. The body copy is privately preserved,
then source fields are reconciled conservatively:

- one source supplies a value: use it and record that source;
- both agree after narrow normalization: use it with provenance `both`;
- both provide different meaningful values: clear the canonical value, retain both
  alternatives in `extracted_data.message_order_evidence`, and require human review;
- lines join only on exact normalized product descriptions; similar products are never
  fuzzy-merged;
- clearly multiple order attachments are flagged as a known one-order-per-message
  limitation.

Doc-U labels body sources as **Email body** and reconciled sources as
**Email + attachment**, and shows field/line conflicts with both values. The original
source stays accessible through its short-lived private signed URL.

Existing customer aliases and UOM rules are evaluated by a read-only preview helper.
All three reads are scoped to the verified organisation and selected existing customer.
The helper preserves the raw description/UOM and stores interpreted values plus rule
provenance in `customer_interpretation_preview`; it contains no mutation or operational
OrderFlow-sync path. The review grid opens on the previewed values, displays their source,
and any actual write still requires the existing human Save/approval action.

Before deploying Wave B, apply `supabase/microsoft-graph-ingest.sql` so production has
the additive nullable source columns and `documents.source_type` check constraint.
Historical rows remain valid. Do not backfill body orders until the migration and this
code are deployed and the relevant failed/zero-document `email_ingests` rows have been
identified in a fresh read-only audit.

## Expiration and renewal

Basic Outlook message subscriptions have a maximum lifetime of seven days. Vyso asks
for six days to retain renewal headroom.

Renewal is now automated: a daily Vercel Cron hits
`/api/integrations/microsoft/renew-subscription` (`vercel.json`, `10 3 * * *`,
CRON_SECRET-authenticated). Each tick GETs the configured subscription, and PATCHes
`expirationDateTime` only when Graph reports it within 48 hours of expiry — otherwise
it no-ops. The 48h threshold gives a daily cron against the 6-day lifetime room for two
missed ticks before real risk of lapsing, and reading Graph's current expiration first
(rather than trusting local state) makes repeated ticks idempotent. If the subscription
has already expired, the route fails loudly (502, visible in Vercel cron logs) instead
of recreating it — recreation stays a deliberate, documented manual cutover:

`npm run microsoft:subscription:renew`

remains available for emergencies and manual verification. No resource, permission,
notification URL, or mailbox state changes in either path.

When integration persistence is introduced, store subscription id, expiration,
resource, last-renewed time, and status in that integration-config record; the
environment variable is the smallest safe single-client bridge, not the eventual
multi-client data model.

## Edge filtering

The deployment is Vercel. Microsoft does not document a stable Graph-webhook-specific
CIDR set suitable for a route allowlist, so no application IP filter is applied. A
Vercel Firewall rule can be evaluated separately if Microsoft publishes an authoritative
range. Client state, subscription id, tenant id, and resource validation remain the
primary controls.

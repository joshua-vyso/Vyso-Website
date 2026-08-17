# WhatsApp ordering — setup runbook

Customers message the business's WhatsApp number the way they always have. Vyso reads
the message, reads the order back for confirmation, and on a YES creates the OrderFlow
order — attributed to the customer by their phone number.

This is Phase 2 of [plans/whatsapp-email-capture.md](plans/whatsapp-email-capture.md).
Phases 0 and 1 (service-role client, ingest tables, extraction, review UI) were already
built for the email lane and are reused unchanged.

---

## What happens to a message

```
Customer WhatsApp message
        │  Meta Cloud API
        ▼
POST /api/whatsapp/inbound
        │  1. verify X-Hub-Signature-256 over the RAW body
        │  2. phone_number_id → org           (whatsapp_connections)
        │  3. insert (org_id, wa_message_id)  (whatsapp_ingests — idempotency)
        │  4. 200 OK, then after():
        ▼
resolveSender: wa_id → of_customers.phone     (whatsapp_senders)
        │  not a known customer → quarantined, human decides. Nothing is ordered.
        ▼
       text ──────────────► extractOrderFromText (Haiku + the org's catalogue)
        │                          │  no items → ignored (+ a nudge if it looked like a try)
        │                          ▼
        │                   file a Doc-U document (the raw text, for audit)
        │                          ▼
        │                   status awaiting_confirmation + send the confirm card
        │                          ▼
        │                   customer replies YES ──► syncOrderFromDocument ──► OrderFlow
        │                                    NO  ──► cancelled
        │
       photo/PDF ─────────► ingestDocument(deferCommit) ──► Doc-U review queue
        │
       voice note ────────► "please send text or a photo" (transcription is Phase 3)
```

**Nothing becomes an order without the customer confirming it.** The confirm card
restates the parse in full — it is the control that catches a misread before it reaches
the books.

**Photos and PDFs deliberately skip the confirm loop** and go to the Doc-U review queue
instead, exactly as forwarded email does. A confirm card can only ask "is this right?"
about the lines the model managed to see, never about the ones it missed entirely — and
a photo is where that risk lives.

---

## 1. Meta app setup

You already have the developer account. In [developers.facebook.com](https://developers.facebook.com):

1. **Create the app** — type *Business*, then add the **WhatsApp** product.
2. **Connect a WhatsApp Business Account (WABA)** and a phone number.
   - For testing, Meta gives you a free test number that can message up to 5
     pre-registered recipients. Use it for the whole of section 4 below.
   - For production the client's real orders number must be migrated to the WhatsApp
     **Business API**. It cannot run in the consumer WhatsApp or WhatsApp Business app
     at the same time — see "Number migration" below, it's the item with real-world
     lead time.
3. **Note the `phone_number_id`** — WhatsApp → API Setup. This is the routing key, not
   the display number.
4. **Create a System User token** — Business Settings → Users → System Users → Add,
   assign the app and the WABA, generate a token with `whatsapp_business_messaging` and
   `whatsapp_business_management`. Choose a **never-expiring** token; the 24-hour
   developer token in the API Setup panel is only good for a first smoke test.
5. **App Secret** — App Settings → Basic → Show.

## 2. Environment variables

```bash
WHATSAPP_APP_SECRET=...          # App Settings → Basic → App Secret
WHATSAPP_VERIFY_TOKEN=...        # any random string you choose; Meta echoes it back
WHATSAPP_ACCESS_TOKEN=...        # the System User token from step 4
WHATSAPP_GRAPH_VERSION=v23.0     # optional, defaults to v23.0
WHATSAPP_DEFAULT_COUNTRY_CODE=27 # optional, defaults to 27 (South Africa)
```

Already required by the email lane and reused here: `SUPABASE_SERVICE_ROLE_KEY`,
`ANTHROPIC_API_KEY`, `CRON_SECRET`.

Without the first three, `/api/whatsapp/inbound` returns 503 and does nothing. That's
deliberate: an unsigned public webhook is not something to degrade gracefully into.

## 3. Database

Paste [`supabase/whatsapp-ingest.sql`](../supabase/whatsapp-ingest.sql) into the
Supabase SQL editor and run it. Idempotent.

Then connect the number to the org:

```sql
insert into whatsapp_connections (org_id, phone_number_id, waba_id, display_number)
select o.id, '<PHONE_NUMBER_ID>', '<WABA_ID>', '+27 11 123 4567'
from organisations o where o.name = 'Turn ''n Slice';
```

**Check `of-order-source-doc.sql` has been applied.** `syncOrderFromDocument` needs
`of_orders.source_document_id` to dedup, and without it every confirmed order returns
`migration-needed` and nothing is created.

## 4. Webhook

1. Deploy, so the URL is live.
2. Meta app dashboard → WhatsApp → Configuration → Edit webhook.
   - **Callback URL**: `https://vyso.co.za/api/whatsapp/inbound`
   - **Verify token**: your `WHATSAPP_VERIFY_TOKEN`
   - Meta immediately GETs the URL and expects the challenge echoed as plain text. A
     403 here means the token doesn't match.
3. **Subscribe to the `messages` field.** Nothing arrives without this — it is the most
   common reason a correctly configured webhook stays silent.

## 5. Who is allowed to order

A number is auto-approved when it already appears on an `of_customers.phone` record for
that org — the org's own data saying "this number is this customer". Every other number
is recorded `pending` in `whatsapp_senders`, gets a polite "we'll pick this up manually"
reply, and orders nothing.

So before go-live, **make sure customer phone numbers are populated in OrderFlow**. Any
format works — `082 123 4567`, `+27 82 123 4567`, `0027821234567` all normalise to the
same number.

To approve a number by hand:

```sql
update whatsapp_senders
   set status = 'approved',
       customer_id = (select id from of_customers where org_id = whatsapp_senders.org_id and name = 'Corner Cafe')
 where org_id = '<ORG_ID>' and wa_id = '27821234567';
```

There is **no settings UI for this yet** — see "Not built" below.

## 6. Test it end to end

With the Meta test number, from a registered recipient:

| Send | Expect |
|---|---|
| `5 boxes tomatoes, 2 bags onions` | The confirm card, listing both lines |
| `YES` | "Order placed — invoice INV-…" (or "we'll confirm pricing" if any line is unpriced) |
| `no tomatoes today, make it 5 onions` | A **new** confirm card — this is a correction, not a cancellation |
| `NO` | "No problem — I've cancelled that one" |
| `Hi` | Nothing. Pleasantries get no reply |
| a photo of an order | "We're checking that order now"; it lands in Doc-U → Awaiting review |
| a voice note | "Please send the order as a text or a photo" |

Then check: **OrderFlow → Orders** for the order, and **Doc-U → Orders folder** for the
audit copy of the message text.

---

## Operational notes

**Retries and recovery.** `/api/whatsapp/process` is the safety net for messages whose
processing crashed or timed out, and it expires confirm cards nobody answered after 3
days. It's on a daily Vercel cron (`vercel.json`) to stay within the Hobby plan's
one-cron-a-day limit. **On Pro, change it to `*/15 * * * *`** — orders are time-sensitive
and a message that fell through shouldn't wait until 03:30 to recover.

**The 24-hour session window.** Free-form replies are only allowed within 24 hours of the
customer's last message. Every reply this lane sends answers a message we just received,
so it's always inside the window and never needs an approved template. Messaging a
customer *first* (an unprompted "your order is on its way") does need one.

**Cost.** Meta charges per 24-hour conversation, not per message, and service
conversations opened by the customer are currently free. Extraction runs on Haiku and is
cheap. The real cost driver would be replying to conversations that were never going to
be orders — which is why pleasantries get no reply.

**POPIA.** `whatsapp_ingests.raw_payload` holds customer message content and phone
numbers. The org is the responsible party, Vyso the operator. The SQL file ends with a
90-day scrub statement for the raw payloads; wire it to a cron once the feature is past
bedding in. The ingest rows themselves must be kept — they're the idempotency guard.

**Number migration.** Moving the client's existing orders number into the Business API
is the item with real lead time and it is not reversible on a whim. Customers keep
messaging the same number, but the founders lose the consumer WhatsApp app on it. Plan
it deliberately: it's worth doing the whole test pass on the Meta test number first.

---

## Not built (deliberately)

- **A settings UI** for connecting the number and approving senders. Both are SQL today.
  This is the first thing to add — a pending sender with no screen to approve it on is a
  customer waiting.
- **Voice-note transcription.** Common for produce orders; needs Whisper/Deepgram in
  front of `extractOrderFromText`. Phase 3 in the original plan.
- **Quick reorder** ("repeat my last order", "my usuals") off the customer's order
  history. The natural next step now that the sender resolves to a customer.
- **A Capture Inbox** showing WhatsApp captures with the raw message beside the parsed
  draft. `whatsapp_ingests` holds everything it needs; nothing renders it yet.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  classifyReply,
  formatOrderConfirmation,
  mediaTypeSupported,
  normaliseMsisdn,
  parseInboundMessages,
  phoneMatchesWaId,
  verifyHandshake,
  verifyMetaSignature,
} from '../lib/platform/whatsapp-policy.ts';

// ---------------------------------------------------------------------------
// Phone normalisation — the identity function for the whole feature
// ---------------------------------------------------------------------------

test('normaliseMsisdn accepts every way a South African number gets typed', () => {
  const expected = '27821234567';
  for (const input of [
    '0821234567',
    '082 123 4567',
    '082-123-4567',
    '(082) 123 4567',
    '+27821234567',
    '+27 82 123 4567',
    '0027821234567',
    '27821234567',
    '821234567',
  ]) {
    assert.equal(normaliseMsisdn(input), expected, `failed on ${input}`);
  }
});

test('normaliseMsisdn leaves a foreign country code alone', () => {
  // A UK mobile must not have '27' bolted onto the front of it.
  assert.equal(normaliseMsisdn('+44 7700 900123'), '447700900123');
  assert.equal(normaliseMsisdn('00447700900123'), '447700900123');
});

test('normaliseMsisdn rejects what cannot be a phone number', () => {
  assert.equal(normaliseMsisdn(''), null);
  assert.equal(normaliseMsisdn(null), null);
  assert.equal(normaliseMsisdn('no digits here'), null);
  assert.equal(normaliseMsisdn('12345'), null); // too short even with a country code
  assert.equal(normaliseMsisdn('1234567890123456789'), null); // beyond E.164
});

test('phoneMatchesWaId matches a customer stored in national format', () => {
  assert.equal(phoneMatchesWaId('082 123 4567', '27821234567'), true);
  assert.equal(phoneMatchesWaId('+27 82 123 4567', '27821234567'), true);
  assert.equal(phoneMatchesWaId('082 123 4568', '27821234567'), false);
  assert.equal(phoneMatchesWaId(null, '27821234567'), false);
  assert.equal(phoneMatchesWaId('', '27821234567'), false);
});

// ---------------------------------------------------------------------------
// Webhook signature — the only thing guarding a public write path
// ---------------------------------------------------------------------------

const SECRET = 'app-secret-123';
const sign = (body: string, secret = SECRET) =>
  `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;

test('verifyMetaSignature accepts a correctly signed body', () => {
  const body = '{"object":"whatsapp_business_account","entry":[]}';
  assert.equal(verifyMetaSignature(body, sign(body), SECRET), true);
});

test('verifyMetaSignature rejects a tampered body', () => {
  const body = '{"object":"whatsapp_business_account","entry":[]}';
  const signature = sign(body);
  assert.equal(verifyMetaSignature(`${body} `, signature, SECRET), false);
});

test('verifyMetaSignature rejects a signature made with a different secret', () => {
  const body = '{"a":1}';
  assert.equal(verifyMetaSignature(body, sign(body, 'not-the-secret'), SECRET), false);
});

test('verifyMetaSignature fails closed on missing or malformed input', () => {
  const body = '{"a":1}';
  assert.equal(verifyMetaSignature(body, null, SECRET), false);
  assert.equal(verifyMetaSignature(body, sign(body), ''), false);
  assert.equal(verifyMetaSignature(body, 'sha256=abc', SECRET), false); // wrong length
  assert.equal(verifyMetaSignature(body, createHmac('sha256', SECRET).update(body).digest('hex'), SECRET), false); // no prefix
});

test('verifyHandshake echoes the challenge only for the exact token', () => {
  const ok = new URLSearchParams({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'tok',
    'hub.challenge': '1158201444',
  });
  assert.equal(verifyHandshake(ok, 'tok'), '1158201444');

  const wrongToken = new URLSearchParams({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'nope',
    'hub.challenge': '1158201444',
  });
  assert.equal(verifyHandshake(wrongToken, 'tok'), null);

  const wrongMode = new URLSearchParams({
    'hub.mode': 'unsubscribe',
    'hub.verify_token': 'tok',
    'hub.challenge': '1158201444',
  });
  assert.equal(verifyHandshake(wrongMode, 'tok'), null);

  assert.equal(verifyHandshake(ok, ''), null); // unconfigured
});

// ---------------------------------------------------------------------------
// Payload parsing
// ---------------------------------------------------------------------------

const textPayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'WABA-1',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '27111234567', phone_number_id: 'PNID-1' },
            contacts: [{ profile: { name: 'Sipho at Corner Cafe' }, wa_id: '27821234567' }],
            messages: [
              {
                from: '27821234567',
                id: 'wamid.ABC',
                timestamp: '1754380800',
                type: 'text',
                text: { body: '5 boxes toms and 2 bags onions pls' },
              },
            ],
          },
        },
      ],
    },
  ],
};

test('parseInboundMessages reads a text order with its routing key and sender', () => {
  const [message] = parseInboundMessages(textPayload);
  assert.equal(message.phoneNumberId, 'PNID-1');
  assert.equal(message.wabaId, 'WABA-1');
  assert.equal(message.fromWaId, '27821234567');
  assert.equal(message.profileName, 'Sipho at Corner Cafe');
  assert.equal(message.kind, 'text');
  assert.equal(message.text, '5 boxes toms and 2 bags onions pls');
  assert.equal(message.waMessageId, 'wamid.ABC');
});

test('parseInboundMessages ignores delivery-status callbacks', () => {
  // Statuses arrive through the same webhook and must never read as customer input.
  const statuses = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '27111234567', phone_number_id: 'PNID-1' },
              statuses: [{ id: 'wamid.XYZ', status: 'delivered', recipient_id: '27821234567' }],
            },
          },
        ],
      },
    ],
  };
  assert.deepEqual(parseInboundMessages(statuses), []);
});

test('parseInboundMessages drops anything that is not a WhatsApp message webhook', () => {
  assert.deepEqual(parseInboundMessages({ object: 'instagram', entry: [] }), []);
  assert.deepEqual(parseInboundMessages(null), []);
  assert.deepEqual(parseInboundMessages('nope'), []);
  assert.deepEqual(parseInboundMessages({ object: 'whatsapp_business_account' }), []);
});

test('parseInboundMessages requires a phone_number_id to route by', () => {
  // No routing key means no org. Nothing in the message may stand in for it.
  const noMetadata = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {},
              messages: [{ from: '27821234567', id: 'wamid.ABC', type: 'text', text: { body: 'hi' } }],
            },
          },
        ],
      },
    ],
  };
  assert.deepEqual(parseInboundMessages(noMetadata), []);
});

test('parseInboundMessages unpacks a batched delivery', () => {
  const batched = {
    object: 'whatsapp_business_account',
    entry: [
      textPayload.entry[0],
      {
        id: 'WABA-1',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { phone_number_id: 'PNID-1' },
              messages: [
                {
                  from: '27829999999',
                  id: 'wamid.DEF',
                  type: 'image',
                  image: { id: 'MEDIA-9', mime_type: 'image/jpeg', caption: "today's order" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const messages = parseInboundMessages(batched);
  assert.equal(messages.length, 2);
  assert.equal(messages[1].kind, 'image');
  assert.equal(messages[1].mediaId, 'MEDIA-9');
  assert.equal(messages[1].mediaMimeType, 'image/jpeg');
  assert.equal(messages[1].text, "today's order");
});

test('parseInboundMessages recognises voice notes so they can be answered, not dropped', () => {
  const voice = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA-1',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'PNID-1' },
              messages: [{ from: '27821234567', id: 'wamid.V', type: 'audio', audio: { id: 'M-1' } }],
            },
          },
        ],
      },
    ],
  };
  assert.equal(parseInboundMessages(voice)[0].kind, 'audio');
});

test('mediaTypeSupported allows what the vision model actually reads', () => {
  assert.equal(mediaTypeSupported('image/jpeg'), true);
  assert.equal(mediaTypeSupported('application/pdf'), true);
  assert.equal(mediaTypeSupported('image/jpeg; charset=binary'), true);
  assert.equal(mediaTypeSupported('image/heic'), false);
  assert.equal(mediaTypeSupported('audio/ogg'), false);
  assert.equal(mediaTypeSupported(null), false);
});

// ---------------------------------------------------------------------------
// The confirm loop
// ---------------------------------------------------------------------------

test('classifyReply recognises the ways people say yes and no', () => {
  for (const yes of ['YES', 'yes', 'y', 'Yes please', 'ok', 'confirm', 'Yebo', 'ja', '👍', '✅']) {
    assert.equal(classifyReply(yes), 'confirm', `expected confirm for ${yes}`);
  }
  for (const no of ['NO', 'no', 'n', 'nope', 'cancel', 'No thanks', 'Nee', '❌']) {
    assert.equal(classifyReply(no), 'cancel', `expected cancel for ${no}`);
  }
});

test('classifyReply does NOT treat an order correction as a cancellation', () => {
  // This is the one that matters: reading "no tomatoes today..." as a cancel would
  // throw away the customer's actual instruction and tell them nothing.
  assert.equal(classifyReply('no tomatoes today, make it 5 onions instead'), null);
  assert.equal(classifyReply('yes but change the tomatoes to 10 boxes'), null);
  assert.equal(classifyReply('5 boxes toms and 2 bags onions pls'), null);
  assert.equal(classifyReply(''), null);
});

test('formatOrderConfirmation reads the whole order back', () => {
  const card = formatOrderConfirmation({
    customerName: 'Corner Cafe',
    lines: [
      { description: 'Tomatoes', quantity: '5', unit: 'boxes' },
      { description: 'Onions', quantity: '2', unit: 'bags' },
    ],
  });
  assert.match(card, /Corner Cafe/);
  assert.match(card, /1\. Tomatoes — 5 boxes/);
  assert.match(card, /2\. Onions — 2 bags/);
  assert.match(card, /\*YES\*/);
  assert.match(card, /\*NO\*/);
});

test('formatOrderConfirmation copes with a line that has no quantity or unit', () => {
  const card = formatOrderConfirmation({
    customerName: null,
    lines: [{ description: 'Mixed Veg', quantity: '', unit: '' }],
  });
  assert.match(card, /1\. Mixed Veg\n/);
  assert.match(card, /^Thanks! /);
});

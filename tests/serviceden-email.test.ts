/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContextSections,
  buildMimeMessage,
  domainFromLeadEmail,
  draftContentHash,
  encodeMimeForGmail,
  isSafePublicHost,
  isSafeResearchUrl,
  normalizeWebsiteUrl,
  parseGeneratedDraft,
  replySubject,
  researchContentHash,
  selectExamplesForStage,
  shouldRevokeApproval,
  threadingHeaders,
} from '../lib/platform/serviceden-email.ts';

// 1. URL normalisation ------------------------------------------------------
test('normalizeWebsiteUrl adds a scheme, drops query/hash, keeps the path', () => {
  assert.deepEqual(normalizeWebsiteUrl('WWW.Acme.co.za/path?q=1#x'), {
    url: 'https://www.acme.co.za/path',
    domain: 'acme.co.za',
  });
  assert.deepEqual(normalizeWebsiteUrl('acme.co.za'), { url: 'https://acme.co.za', domain: 'acme.co.za' });
  assert.equal(normalizeWebsiteUrl(''), null);
});

test('normalizeWebsiteUrl rejects unusable or dangerous inputs', () => {
  assert.equal(normalizeWebsiteUrl('javascript:alert(1)'), null);
  assert.equal(normalizeWebsiteUrl('ftp://x.com'), null);
  assert.equal(normalizeWebsiteUrl('https://user:pass@x.com'), null);
  assert.equal(normalizeWebsiteUrl('https://x.com:444'), null);
  assert.notEqual(normalizeWebsiteUrl('https://x.com:443'), null);
});

// 2. Private-network protection ---------------------------------------------
test('isSafePublicHost refuses every private and loopback range', () => {
  const unsafe = [
    '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.2', '127.0.0.1',
    '169.254.1.1', '100.64.0.1', '::1', '[::1]', 'fc00::1', 'fe80::1',
    'localhost', 'app.localhost', 'printer.local', 'db.internal', 'x.home.arpa', '',
  ];
  for (const host of unsafe) assert.equal(isSafePublicHost(host), false, host);
  assert.equal(isSafePublicHost('acme.co.za'), true);
  assert.equal(isSafeResearchUrl('https://acme.co.za'), true);
  assert.equal(isSafeResearchUrl('http://192.168.0.5/admin'), false);
  assert.equal(isSafeResearchUrl('https://localhost:3000'), false);
});

// 3. Lead email domains ------------------------------------------------------
test('domainFromLeadEmail ignores consumer mailboxes', () => {
  for (const generic of ['a@gmail.com', 'a@outlook.com', 'a@yahoo.com', 'a@icloud.com', 'a@proton.me']) {
    assert.equal(domainFromLeadEmail(generic), null, generic);
  }
  assert.equal(domainFromLeadEmail('Greg@Acme.co.za'), 'acme.co.za');
});

// 4. Example selection -------------------------------------------------------
function template(over: Partial<any> = {}): any {
  return {
    id: 't1',
    name: 'T',
    stages: ['new'],
    active: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    examples: [{ id: 'e1', active: true }],
    ...over,
  };
}

test('selectExamplesForStage filters, ranks by specificity and caps at three', () => {
  const specific = template({ id: 'specific', stages: ['new'], examples: [{ id: 'a', active: true }] });
  const broad = template({ id: 'broad', stages: ['new', 'contacted', 'replied'], examples: [{ id: 'b', active: true }] });
  const inactiveTemplate = template({ id: 'off', active: false, examples: [{ id: 'c', active: true }] });
  const inactiveExample = template({ id: 'stale', examples: [{ id: 'd', active: false }] });
  const wrongStage = template({ id: 'other', stages: ['won'], examples: [{ id: 'e', active: true }] });
  const extra = template({ id: 'extra', stages: ['new'], examples: [{ id: 'f', active: true }, { id: 'g', active: true }, { id: 'h', active: true }] });

  const picked = selectExamplesForStage([broad, specific, inactiveTemplate, inactiveExample, wrongStage], 'new');
  assert.deepEqual(picked.map((entry) => entry.example.id), ['a', 'b']);

  assert.equal(selectExamplesForStage([extra, broad], 'new').length, 3);
  assert.equal(selectExamplesForStage([extra], 'new', 1).length, 1);
  assert.deepEqual(selectExamplesForStage([template({ stages: ['lost'] })], 'lost'), []);
});

// 5. Context priority --------------------------------------------------------
const thread: any = {
  id: 'th1',
  messages: [
    { fromAddress: 'lead@acme.co.za', bodyText: 'first', internetMessageId: '<1>' },
    { fromAddress: 'me@vyso.co.za', bodyText: 'second', internetMessageId: '<2>' },
    { fromAddress: 'lead@acme.co.za', bodyText: 'third', internetMessageId: '<2>' },
  ],
};

function composeInput(over: Partial<any> = {}): any {
  return {
    lead: { name: 'Greg', company: 'Acme', email: 'greg@acme.co.za', stage: 'new', summary: null, primaryPain: null, notes: 'call him Greg' },
    isReply: true,
    thread,
    research: null,
    examples: [{ template: template(), example: { id: 'e1', subjectExample: 'S', bodyExample: 'B' } }],
    callToAction: null,
    sender: { name: 'Josh', email: 'me@vyso.co.za', businessName: 'Vyso' },
    ...over,
  };
}

test('buildContextSections orders thread over notes over research over examples', () => {
  const research: any = {
    summary: 'Acme bakes bread.',
    excludedSourceIds: [],
    operationalSignals: [
      { claim: 'Might deliver daily', sourceId: 's2', kind: 'hypothesis' },
      { claim: 'Runs three branches', sourceId: 's1', kind: 'fact' },
    ],
  };
  const sections = buildContextSections(composeInput({ research }));
  assert.deepEqual(sections.map((section) => section.priority), [1, 2, 3, 4, 5]);

  const titles = sections.map((section) => section.title);
  assert.ok(titles.indexOf('Latest Gmail thread') < titles.indexOf('User notes and lead facts'));
  assert.ok(titles.indexOf('User notes and lead facts') < titles.indexOf('Website research'));
  assert.ok(titles.indexOf('Website research') < titles.indexOf('Templates and examples'));

  const researchSection = sections.find((section) => section.priority === 3)!;
  assert.ok(researchSection.content.indexOf('Runs three branches') < researchSection.content.indexOf('Might deliver daily'));
  assert.match(researchSection.content, /\[source:s1\]/);
});

test('buildContextSections drops claims from excluded sources', () => {
  const research: any = {
    summary: 'Acme bakes bread.',
    excludedSourceIds: ['s2'],
    operationalSignals: [
      { claim: 'Runs three branches', sourceId: 's1', kind: 'fact' },
      { claim: 'Wrong guess', sourceId: 's2', kind: 'hypothesis' },
    ],
  };
  const researchSection = buildContextSections(composeInput({ research })).find((section) => section.priority === 3)!;
  assert.match(researchSection.content, /Runs three branches/);
  assert.doesNotMatch(researchSection.content, /Wrong guess/);
});

test('buildContextSections omits the thread section when there is no conversation', () => {
  const sections = buildContextSections(composeInput({ thread: null, isReply: false }));
  assert.deepEqual(sections.map((section) => section.priority), [2, 4, 5]);
});

// 6. Model output validation -------------------------------------------------
const validDraft = { subject: 'Hello', body: 'Body', usedSourceIds: ['s1'], reasoningSummary: 'Why', suggestedFollowUpDays: 3 };

test('parseGeneratedDraft accepts a well-formed answer', () => {
  assert.deepEqual(parseGeneratedDraft(validDraft), validDraft);
});

test('parseGeneratedDraft rejects anything malformed', () => {
  assert.equal(parseGeneratedDraft(null), null);
  assert.equal(parseGeneratedDraft('nope'), null);
  assert.equal(parseGeneratedDraft({}), null);
  assert.equal(parseGeneratedDraft({ ...validDraft, subject: 12 }), null);
  assert.equal(parseGeneratedDraft({ ...validDraft, usedSourceIds: 's1' }), null);
  assert.equal(parseGeneratedDraft({ ...validDraft, suggestedFollowUpDays: 'soon' }), null);
  assert.equal(parseGeneratedDraft({ subject: 'a', body: 'b', usedSourceIds: [], suggestedFollowUpDays: 3 }), null);
});

test('parseGeneratedDraft clamps and trims', () => {
  assert.equal(parseGeneratedDraft({ ...validDraft, suggestedFollowUpDays: 0 })?.suggestedFollowUpDays, 1);
  assert.equal(parseGeneratedDraft({ ...validDraft, suggestedFollowUpDays: 90 })?.suggestedFollowUpDays, 30);
  assert.equal(parseGeneratedDraft({ ...validDraft, suggestedFollowUpDays: 2.6 })?.suggestedFollowUpDays, 3);
  assert.equal(parseGeneratedDraft({ ...validDraft, subject: 'x'.repeat(400) })?.subject.length, 300);
  assert.equal(parseGeneratedDraft({ ...validDraft, body: 'y'.repeat(30_000) })?.body.length, 20_000);
  assert.deepEqual(parseGeneratedDraft({ ...validDraft, usedSourceIds: ['s1', 7, null] })?.usedSourceIds, ['s1']);
});

// 7. Draft integrity hash ----------------------------------------------------
test('draftContentHash is stable, case-insensitive on the recipient, sensitive elsewhere', () => {
  const base = draftContentHash('greg@acme.co.za', 'Subject', 'Body');
  assert.equal(base, draftContentHash(' Greg@Acme.co.za ', 'Subject', 'Body'));
  assert.notEqual(base, draftContentHash('other@acme.co.za', 'Subject', 'Body'));
  assert.notEqual(base, draftContentHash('greg@acme.co.za', 'Subject!', 'Body'));
  assert.notEqual(base, draftContentHash('greg@acme.co.za', 'Subject', 'Body '));
  assert.match(base, /^[0-9a-f]{64}$/);
});

test('researchContentHash is stable under key order and changes when a field changes', () => {
  const hash = researchContentHash({ summary: 'Bakery in Cape Town', industry: 'food', confidence: 'high' });
  // Same fields, different key order → identical hash.
  assert.equal(hash, researchContentHash({ confidence: 'high', industry: 'food', summary: 'Bakery in Cape Town' }));
  // Any changed field → different hash.
  assert.notEqual(hash, researchContentHash({ summary: 'Bakery in Durban', industry: 'food', confidence: 'high' }));
  assert.match(hash, /^[0-9a-f]{64}$/);
});

// 8. MIME --------------------------------------------------------------------
test('buildMimeMessage writes valid headers and a decodable base64 body', () => {
  const mime = buildMimeMessage({
    from: 'me@vyso.co.za',
    to: 'greg@acme.co.za',
    subject: 'Olá — a quick question',
    bodyText: 'Hello there',
    inReplyTo: '<a@mail>',
    references: ['<a@mail>', '<b@mail>'],
  });
  const [headers, body] = mime.split('\r\n\r\n');
  assert.match(headers, /^From: me@vyso\.co\.za\r\n/);
  assert.match(headers, /\r\nTo: greg@acme\.co\.za\r\n/);
  assert.match(headers, /Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=/);
  assert.match(headers, /MIME-Version: 1\.0/);
  assert.match(headers, /Content-Type: text\/plain; charset=UTF-8/);
  assert.match(headers, /Content-Transfer-Encoding: base64/);
  assert.match(headers, /In-Reply-To: <a@mail>/);
  assert.match(headers, /References: <a@mail> <b@mail>/);
  assert.equal(Buffer.from(body.replaceAll('\r\n', ''), 'base64').toString('utf8'), 'Hello there');
  assert.equal(Buffer.from(headers.split('Subject: =?UTF-8?B?')[1].split('?=')[0], 'base64').toString('utf8'), 'Olá — a quick question');
});

test('buildMimeMessage omits threading headers for a new email and wraps long bodies', () => {
  const mime = buildMimeMessage({ from: 'a@x.co', to: 'b@y.co', subject: 'Plain', bodyText: 'z'.repeat(500) });
  const [headers, body] = mime.split('\r\n\r\n');
  assert.match(headers, /Subject: Plain/);
  assert.doesNotMatch(headers, /In-Reply-To/);
  assert.doesNotMatch(headers, /References/);
  for (const line of body.split('\r\n')) assert.ok(line.length <= 76);
  assert.equal(Buffer.from(body.replaceAll('\r\n', ''), 'base64').toString('utf8'), 'z'.repeat(500));
});

test('buildMimeMessage refuses header injection through the subject or threading ids', () => {
  const mime = buildMimeMessage({
    from: 'me@vyso.co.za',
    to: 'greg@acme.co.za',
    subject: 'Hi\r\nBcc: victim@example.com\r\n\r\nInjected body',
    bodyText: 'Real body',
    inReplyTo: '<a@mail>\r\nBcc: victim@example.com',
    references: ['<a@mail>', 'not-a-message-id', '<b@mail>\r\nX-Evil: 1'],
  });
  const [headers, body] = mime.split('\r\n\r\n');
  // The injected text survives only as literal characters inside one header
  // line — it never becomes a header of its own or ends the header block.
  const headerNames = headers.split('\r\n').map((line) => line.split(':')[0].toLowerCase());
  assert.deepEqual(headerNames, ['from', 'to', 'subject', 'mime-version', 'content-type', 'content-transfer-encoding', 'references']);
  assert.equal(mime.split('\r\n\r\n').length, 2);
  assert.match(headers, /Subject: Hi Bcc: victim@example\.com/);
  assert.doesNotMatch(headers, /In-Reply-To/);
  assert.match(headers, /References: <a@mail>$/m);
  assert.equal(Buffer.from(body.replaceAll('\r\n', ''), 'base64').toString('utf8'), 'Real body');
});

test('parseGeneratedDraft strips line breaks from the subject but not the body', () => {
  const parsed = parseGeneratedDraft({ ...validDraft, subject: 'Hi\r\nBcc: x@y.co', body: 'Line one\nLine two' });
  assert.equal(parsed?.subject, 'Hi Bcc: x@y.co');
  assert.equal(parsed?.body, 'Line one\nLine two');
});

test('encodeMimeForGmail produces url-safe base64 without padding', () => {
  const encoded = encodeMimeForGmail(buildMimeMessage({ from: 'a@x.co', to: 'b@y.co', subject: 'Sub', bodyText: 'body?!' }));
  assert.doesNotMatch(encoded, /[+/=]/);
  assert.match(Buffer.from(encoded, 'base64url').toString('utf8'), /^From: a@x\.co/);
});

// 9. Threading ---------------------------------------------------------------
test('threadingHeaders replies to the last identified message with deduped references', () => {
  assert.deepEqual(threadingHeaders(thread), { inReplyTo: '<2>', references: ['<1>', '<2>'] });
  assert.deepEqual(threadingHeaders(null), { inReplyTo: null, references: [] });
  assert.deepEqual(threadingHeaders({ messages: [] } as any), { inReplyTo: null, references: [] });
  assert.deepEqual(
    threadingHeaders({ messages: [{ internetMessageId: null }, { internetMessageId: '<x>' }] } as any),
    { inReplyTo: '<x>', references: ['<x>'] },
  );
});

// 10. Reply subject ----------------------------------------------------------
test('replySubject prefixes once and is idempotent', () => {
  assert.equal(replySubject('Quick question'), 'Re: Quick question');
  assert.equal(replySubject('RE: Quick question'), 'RE: Quick question');
  assert.equal(replySubject('re: quick question'), 're: quick question');
  assert.equal(replySubject(null), 'Re: ');
});

// 11. Approval invalidation --------------------------------------------------
test('shouldRevokeApproval fires on any content change and only on a change', () => {
  const before = { recipientEmail: 'greg@acme.co.za', subject: 'Hi', body: 'Body' };
  assert.equal(shouldRevokeApproval(before, {}), false);
  assert.equal(shouldRevokeApproval(before, { subject: 'Hi' }), false);
  assert.equal(shouldRevokeApproval(before, { subject: 'Hi!' }), true);
  assert.equal(shouldRevokeApproval(before, { body: 'Body edited' }), true);
  assert.equal(shouldRevokeApproval(before, { recipientEmail: 'other@acme.co.za' }), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLUGINS,
  isPluginPath,
  pluginToneDot,
  pluginToneLabel,
  xeroStatusTone,
  type PluginTone,
} from '../lib/platform/plugins.ts';

/**
 * The plugin registry's truth table.
 *
 * WHY THIS IS WORTH A TEST FILE for what is, on the face of it, four small
 * functions. The status dot is the ONE thing the rail says about a connection,
 * and it is says it in a colour — there is no sentence beside it on the desktop
 * rail to contradict a wrong one. A green dot over a connection that has been
 * dead for a week is the failure mode this section exists to prevent, so the
 * mapping from `xero_connections.status` onto that colour is pinned here rather
 * than trusted to a glance at a `?:` chain.
 *
 * Relative, `.ts`-suffixed import: `node --test` cannot resolve the `@/` alias
 * (the 2026-08-14 Price Watch outage in person). Every unit-tested module under
 * lib/platform follows the same rule.
 */

// ---------------------------------------------------------------------------
// The five statuses xero_connections can hold, plus the ones it cannot
// ---------------------------------------------------------------------------

const TONE_CASES: Array<{ status: string | null | undefined; tone: PluginTone; why: string }> = [
  { status: 'connected', tone: 'connected', why: 'the healthy case' },
  {
    status: 'syncing',
    tone: 'connected',
    why: 'mid-read is still connected — a dot that flicked amber for the length of a sync would teach the owner to distrust it',
  },
  { status: 'error', tone: 'attention', why: 'linked, but nothing is coming through' },
  { status: 'reauth_required', tone: 'attention', why: 'linked, but Xero has stopped accepting us' },
  { status: 'disconnected', tone: 'idle', why: 'the owner disconnected it' },
  { status: null, tone: 'idle', why: 'no row at all is the same fact as disconnected' },
  { status: undefined, tone: 'idle', why: 'a read that could not be made says nothing' },
  {
    status: 'CONNECTED',
    tone: 'idle',
    why: 'the column is free text — a casing this build does not know must not draw green',
  },
  {
    status: 'some_future_state',
    tone: 'idle',
    why: 'fail closed: a wrong "not connected" costs a click, a wrong green costs a night of data',
  },
];

for (const c of TONE_CASES) {
  test(`xeroStatusTone(${JSON.stringify(c.status)}) → ${c.tone} — ${c.why}`, () => {
    assert.equal(xeroStatusTone(c.status), c.tone);
  });
}

// ---------------------------------------------------------------------------
// The tone's two renderings
// ---------------------------------------------------------------------------

test('every tone has words and a colour, and no two tones share either', () => {
  const tones: PluginTone[] = ['connected', 'attention', 'idle'];
  const labels = tones.map(pluginToneLabel);
  const dots = tones.map(pluginToneDot);

  for (const label of labels) assert.ok(label.length > 0, 'a tone with no words is a silent dot');
  for (const dot of dots) assert.match(dot, /^#[0-9A-Fa-f]{6}$/);

  assert.equal(new Set(labels).size, tones.length, 'two tones reading the same is a tone too many');
  assert.equal(new Set(dots).size, tones.length, 'two tones drawn the same is a dot that says nothing');
});

test('the labels are the owner’s words, not the column’s', () => {
  assert.equal(pluginToneLabel('connected'), 'Connected');
  assert.equal(pluginToneLabel('attention'), 'Needs attention');
  assert.equal(pluginToneLabel('idle'), 'Not connected');
});

// ---------------------------------------------------------------------------
// Which row lights up
// ---------------------------------------------------------------------------

test('a plugin row is active on its own page and on anything beneath it', () => {
  assert.equal(isPluginPath('/app/plugins/xero', '/app/plugins/xero'), true);
  assert.equal(isPluginPath('/app/plugins/xero/history', '/app/plugins/xero'), true);
});

test('a plugin row is NOT active on a path that merely starts with its name', () => {
  // The `/` anchor is the whole point: without it a future `/app/plugins/xerox`
  // would light the Xero row.
  assert.equal(isPluginPath('/app/plugins/xerox', '/app/plugins/xero'), false);
  assert.equal(isPluginPath('/app/plugins', '/app/plugins/xero'), false);
  assert.equal(isPluginPath('/app', '/app/plugins/xero'), false);
});

// ---------------------------------------------------------------------------
// The registry itself
// ---------------------------------------------------------------------------

test('every plugin has a distinct key and a route under /app/plugins', () => {
  assert.ok(PLUGINS.length > 0, 'a section with no rows is a promise the rail cannot keep');
  assert.equal(new Set(PLUGINS.map((p) => p.key)).size, PLUGINS.length);
  assert.equal(new Set(PLUGINS.map((p) => p.href)).size, PLUGINS.length);
  for (const p of PLUGINS) {
    assert.ok(p.href.startsWith('/app/plugins/'), `${p.key} must live under the section it is in`);
    assert.ok(p.label.length > 0);
    assert.ok(p.blurb.length > 0, 'the index card needs a line that says what the connection does');
  }
});

test('X1 ships exactly one plugin, and it is Xero', () => {
  // Josh's ask, verbatim: "We'll do this just for Xero for now". If a second
  // entry lands, this test is the reminder that the rail, the index page and the
  // runbook all describe a one-row section.
  assert.deepEqual(
    PLUGINS.map((p) => p.key),
    ['xero'],
  );
});

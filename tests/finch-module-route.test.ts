import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_MODULE_ROUTES, agentModuleForPathname, isBubbleRoute } from '../lib/ai/finch/module-route.ts';
import { MODULES } from '../lib/platform/modules.ts';

// Which Finch answers, and where the bubble is (.ai/plan_brief_chat_v2.md §1.5,
// §2.5 — W4).
//
// Both functions are one-liners that decide something the owner would notice
// immediately if it were wrong: the first picks the tool set (OrderFlow's
// screens answering with the Brief's tools was the bug this wave fixes), the
// second decides whether a screen gets the collapsed bubble or the Brief's
// full-width dock. The cross-check against MODULES is the interesting one — the
// route table is written out literally, so a module whose desktop route is
// renamed must fail here rather than quietly downgrade that screen to 'brief'.

/* ── agentModuleForPathname ───────────────────────────────────────────────── */

test('a module with its own knowledge gets its own agent', () => {
  assert.equal(agentModuleForPathname('/app/orderflow'), 'orderflow');
  assert.equal(agentModuleForPathname('/app/orderflow/orders/new'), 'orderflow');
  assert.equal(agentModuleForPathname('/app/docu'), 'docu');
  assert.equal(agentModuleForPathname('/app/docu/review'), 'docu');
});

test('the Brief and the chat pages are the brief agent', () => {
  assert.equal(agentModuleForPathname('/app'), 'brief');
  assert.equal(agentModuleForPathname('/app/chat/new'), 'brief');
  assert.equal(agentModuleForPathname('/app/chat/abc-123'), 'brief');
});

test('modules with no Finch knowledge fall to the cross-module agent', () => {
  // Not a fallback — ProcurePulse has no knowledge doc and no tools of its own,
  // so the honest answer on its screens is the COO surface.
  assert.equal(agentModuleForPathname('/app/procurepulse'), 'brief');
  assert.equal(agentModuleForPathname('/app/pricepilot/items'), 'brief');
  assert.equal(agentModuleForPathname('/app/suppliers'), 'brief');
});

test('the account routes are the brief agent too (plan §5)', () => {
  assert.equal(agentModuleForPathname('/app/settings'), 'brief');
  assert.equal(agentModuleForPathname('/app/organisation'), 'brief');
  assert.equal(agentModuleForPathname('/app/notifications'), 'brief');
});

test('a route that merely starts with a module name is not that module', () => {
  // `/app/docuwhatever` is not inside Doc-U; prefix matching has to be on
  // segment boundaries or a future module could be swallowed by an older one.
  assert.equal(agentModuleForPathname('/app/documents'), 'brief');
  assert.equal(agentModuleForPathname('/app/orderflowers'), 'brief');
});

test('every route in the table is a real module route', () => {
  for (const [route, module] of AGENT_MODULE_ROUTES) {
    const entry = MODULES.find((m) => m.key === module);
    assert.ok(entry, `no MODULES entry keyed '${module}'`);
    assert.equal(
      entry.screens.desktop,
      route,
      `'${module}' lives at ${entry.screens.desktop}, but the agent table says ${route}`,
    );
  }
});

/* ── isBubbleRoute ────────────────────────────────────────────────────────── */

test('the two screens that own the conversation get no bubble', () => {
  assert.equal(isBubbleRoute('/app'), false);
  assert.equal(isBubbleRoute('/app/chat/new'), false);
  assert.equal(isBubbleRoute('/app/chat/abc-123'), false);
});

test('every other platform screen gets one', () => {
  assert.equal(isBubbleRoute('/app/orderflow'), true);
  assert.equal(isBubbleRoute('/app/docu/review'), true);
  assert.equal(isBubbleRoute('/app/settings'), true);
  // A search param on the Brief is still the Brief — history is `?view=history`
  // on the same route, which is why the test is on pathname alone.
  assert.equal(isBubbleRoute('/app/finding/abc'), true);
});

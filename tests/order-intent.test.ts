import test from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeOrderRequest } from '../lib/ai/finch/order-intent.ts';

// The regex that decides which model answers (.ai/plan_brief_chat_v2.md W4).
//
// It had two copies until this wave — one in the agent route, one in FinchModal
// — and they had to agree, because the client arms the workflow tier and the
// server decides it. Now there is one, read by both, and these pin the
// behaviour that was previously only guaranteed by two identical literals
// sitting in different files.

test('the ways an owner asks for an order', () => {
  for (const text of [
    'create an order for Bakers Inc',
    'Make me a new order',
    'please put together an order for the Sandton branch',
    'draft an order: 3 crates tomatoes',
    'start an order',
    'prepare an order for Jozi Dairy',
    'order for Meridian: 6 boxes',
  ]) {
    assert.equal(looksLikeOrderRequest(text), true, text);
  }
});

test('questions about existing orders are not order-building', () => {
  // A false positive costs one Q&A turn on a pricier model, so the regex is
  // deliberately loose — but these are the everyday questions on the OrderFlow
  // screens, and escalating all of them would move the whole module to Sonnet.
  for (const text of [
    'who owes me money?',
    'what did I invoice last week?',
    'how do I add a customer?',
    'show me the price list',
  ]) {
    assert.equal(looksLikeOrderRequest(text), false, text);
  }
});

test('empty and missing text are not requests', () => {
  assert.equal(looksLikeOrderRequest(''), false);
  assert.equal(looksLikeOrderRequest(undefined as unknown as string), false);
});

test('it does not carry state between calls', () => {
  // A `/g` flag here would make every second identical call return false via
  // `lastIndex` — the classic way this bug ships, and invisible until the owner
  // asks for two orders in a row.
  assert.equal(looksLikeOrderRequest('create an order for Bakers'), true);
  assert.equal(looksLikeOrderRequest('create an order for Bakers'), true);
});

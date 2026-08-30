import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { CdCustomerItemAlias } from '../lib/platform/coredata.ts';
import {
  buildCustomerInterpretationPreview,
} from '../lib/platform/docu/customer-interpretation-preview.ts';
import type { CustomerUomRuleLite } from '../lib/platform/docu/customer-uom-rules.ts';

const ORG = 'org-turn-n-slice';
const CUSTOMER = 'customer-capital';

function alias(overrides: Partial<CdCustomerItemAlias> = {}): CdCustomerItemAlias {
  return {
    id: 'alias-1',
    org_id: ORG,
    customer_id: CUSTOMER,
    raw_name: 'Potatoes',
    stock_item_id: 'stock-peeled-potatoes',
    invoice_name: 'Potatoes Peeled',
    unit: null,
    quantity_basis: null,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function rule(overrides: Partial<CustomerUomRuleLite> = {}): CustomerUomRuleLite {
  return {
    id: 'rule-1',
    org_id: ORG,
    customer_id: CUSTOMER,
    match_kind: 'token',
    description_condition: 'punnet',
    printed_unit: 'kg',
    target_unit: 'punnet',
    active: true,
    ...overrides,
  };
}

test('existing product alias and UOM rule apply as a read-only preview', () => {
  const lines = [
    { raw_description: 'Potatoes', description: 'Potatoes', quantity: '10', unit: 'kg', confidence: 95 },
    { raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit: 'KG', confidence: 95 },
  ];
  const preview = buildCustomerInterpretationPreview({
    orgId: ORG,
    customerId: CUSTOMER,
    lines,
    aliases: [alias()],
    uomRules: [rule()],
    stockItems: [{ id: 'stock-peeled-potatoes', org_id: ORG, name: 'Potatoes Peeled', unit: 'kg' }],
  });
  assert.equal(preview.read_only, true);
  assert.equal(preview.lines[0].interpreted_stock_item_id, 'stock-peeled-potatoes');
  assert.equal(preview.lines[0].interpreted_description, 'Potatoes Peeled');
  assert.equal(preview.lines[1].source_uom, 'KG');
  assert.equal(preview.lines[1].interpreted_uom, 'punnet');
  assert.equal(preview.lines[1].uom_rule_id, 'rule-1');
  assert.equal(lines[0].raw_description, 'Potatoes');
  assert.equal(lines[1].unit, 'KG');
});

test('another organisation or customer rules can never enter the preview', () => {
  const preview = buildCustomerInterpretationPreview({
    orgId: ORG,
    customerId: CUSTOMER,
    lines: [{ raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit: 'KG', confidence: 95 }],
    aliases: [alias({ org_id: 'other-org' })],
    uomRules: [rule({ customer_id: 'other-customer' })],
    stockItems: [{ id: 'stock-peeled-potatoes', org_id: 'other-org', name: 'Potatoes Peeled', unit: 'kg' }],
  });
  assert.equal(preview.lines[0].product_alias_id, null);
  assert.equal(preview.lines[0].uom_rule_id, null);
  assert.equal(preview.lines[0].interpreted_uom, 'KG');
});

test('equal-specificity UOM disagreement remains a conflict with source UOM unchanged', () => {
  const preview = buildCustomerInterpretationPreview({
    orgId: ORG,
    customerId: CUSTOMER,
    lines: [{ raw_description: 'Grapes Black Punnet', description: 'Grapes Black Punnet', quantity: '5', unit: 'KG', confidence: 95 }],
    aliases: [],
    uomRules: [rule(), rule({ id: 'rule-2', target_unit: 'tray' })],
    stockItems: [],
  });
  assert.equal(preview.lines[0].interpreted_uom, 'KG');
  assert.equal(preview.lines[0].uom_rule_id, null);
  assert.deepEqual(new Set(preview.lines[0].uom_conflict_rule_ids), new Set(['rule-1', 'rule-2']));
});

test('preview implementation exposes no write or operational-sync path', () => {
  const source = readFileSync(new URL('../lib/platform/docu/customer-interpretation-preview.ts', import.meta.url), 'utf8');
  for (const forbidden of [".insert(", ".update(", ".upsert(", ".delete(", 'syncOrderFromDocument']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.match(source, /\.eq\('org_id', input\.orgId\)/);
  assert.match(source, /\.eq\('customer_id', input\.customerId\)/);
});

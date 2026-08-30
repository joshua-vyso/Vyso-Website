/**
 * Read-only preview of existing customer-specific product aliases and UOM
 * rules. This module has no mutation API and never calls OrderFlow sync.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CdCustomerItemAlias } from '../coredata.ts';
import type {
  CustomerInterpretationPreview,
  ExtractedLineItem,
} from '../types.ts';
import { indexAliasesForCustomer, lookupAlias } from './customer-item-alias.ts';
import {
  applyCustomerUomRules,
  indexUomRulesForCustomer,
  type CustomerUomRuleLite,
} from './customer-uom-rules.ts';

interface StockItemLite {
  id: string;
  org_id: string;
  name: string;
  unit: string | null;
}

/** Pure evaluator over rows already scoped by the caller. */
export function buildCustomerInterpretationPreview(input: {
  orgId: string;
  customerId: string;
  lines: readonly ExtractedLineItem[];
  aliases: readonly CdCustomerItemAlias[];
  uomRules: readonly CustomerUomRuleLite[];
  stockItems: readonly StockItemLite[];
}): CustomerInterpretationPreview {
  const aliases = input.aliases.filter((row) => row.org_id === input.orgId);
  const aliasIndex = indexAliasesForCustomer([...aliases], input.customerId);
  const rules = indexUomRulesForCustomer([...input.uomRules], input.orgId, input.customerId);
  const stockById = new Map(input.stockItems
    .filter((row) => row.org_id === input.orgId)
    .map((row) => [row.id, row]));

  return {
    customer_id: input.customerId,
    read_only: true,
    lines: input.lines.map((line, lineIndex) => {
      const sourceDescription = (line.raw_description ?? '').trim() || line.description.trim();
      const sourceUom = (line.unit ?? '').trim() || null;
      const alias = lookupAlias(aliasIndex, sourceDescription, line.description);
      const stockItem = alias?.stock_item_id ? stockById.get(alias.stock_item_id) ?? null : null;
      const uom = applyCustomerUomRules(rules, {
        raw_description: sourceDescription,
        description: line.description,
        unit: sourceUom,
      });

      // Existing exact alias unit remains the strongest customer ruling, just
      // as it does in the operational sync. A conflicting UOM rule is still
      // surfaced; it never silently picks a target.
      const aliasUnit = (alias?.unit ?? '').trim() || null;
      const interpretedUom = aliasUnit ?? (uom?.kind === 'applied' ? uom.unit : sourceUom);
      return {
        line_index: lineIndex,
        source_description: sourceDescription,
        source_uom: sourceUom,
        interpreted_stock_item_id: stockItem?.id ?? null,
        interpreted_description:
          ((alias?.invoice_name ?? '').trim() || stockItem?.name || null),
        product_alias_id: alias?.id ?? null,
        product_alias_source: alias?.source ?? null,
        interpreted_uom: interpretedUom,
        uom_rule_id: !aliasUnit && uom?.kind === 'applied' ? uom.ruleId : null,
        uom_rule_count: !aliasUnit && uom?.kind === 'applied' ? uom.count : null,
        uom_conflict_rule_ids: uom?.kind === 'conflict' ? [...uom.ruleIds] : [],
      };
    }),
  };
}

/**
 * Load only the verified organisation/customer's existing rules and evaluate
 * them without inserts, updates, upserts, deletes, or operational sync calls.
 */
export async function previewExistingCustomerInterpretation(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    customerId: string;
    lines: readonly ExtractedLineItem[];
  },
): Promise<CustomerInterpretationPreview> {
  if (!input.orgId.trim() || !input.customerId.trim()) {
    throw new Error('Verified organisation and existing customer ids are required for interpretation preview.');
  }
  const [aliasResult, ruleResult, stockResult] = await Promise.all([
    supabase
      .from('cd_customer_item_aliases')
      .select('*')
      .eq('org_id', input.orgId)
      .eq('customer_id', input.customerId)
      .order('updated_at', { ascending: true }),
    supabase
      .from('cd_customer_uom_rules')
      .select('*')
      .eq('org_id', input.orgId)
      .eq('customer_id', input.customerId)
      .eq('active', true),
    supabase
      .from('pp_stock_items')
      .select('id, org_id, name, unit')
      .eq('org_id', input.orgId),
  ]);
  const error = aliasResult.error ?? ruleResult.error ?? stockResult.error;
  if (error) throw new Error(`Could not read customer interpretation rules: ${error.message}`);

  return buildCustomerInterpretationPreview({
    orgId: input.orgId,
    customerId: input.customerId,
    lines: input.lines,
    aliases: (aliasResult.data ?? []) as CdCustomerItemAlias[],
    uomRules: (ruleResult.data ?? []) as CustomerUomRuleLite[],
    stockItems: (stockResult.data ?? []) as StockItemLite[],
  });
}

/**
 * Finch tool registry. Tools are the agent's read-only window onto the live
 * data — namespaced per module so adding a module later is just more tool
 * entries (the route/loop is generic). Every tool runs through the caller's
 * RLS-scoped Supabase client, so a tool can only ever read the caller's own org.
 *
 * Phase 2 = READ tools only (analytics + lookups). Write/workflow tools are a
 * later phase and will carry their own confirmation guardrails.
 */
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentModule } from './config';
import {
  businessSnapshot,
  recentInvoices,
  recentOrders,
  findCustomers,
  orderDocumentLines,
  prepareOrderDraft,
  outstandingByCustomer,
  overdueInvoices,
  type DraftItemInput,
} from './orderflow-data';
import { findDocuments, documentSummary } from './docu-data';

/** Runtime context handed to every tool. `canSeeMoney` mirrors the OrderFlow
 *  finance gate (members don't see revenue/outstanding). */
export interface ToolContext {
  supabase: SupabaseClient;
  orgId: string;
  canSeeMoney: boolean;
}

export interface AgentTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
  /** Workflow tools (order-building) are only offered on the Sonnet workflow
   *  tier — not during ordinary Q&A. */
  workflow?: boolean;
  run: (ctx: ToolContext, input: Record<string, unknown>) => Promise<string>;
}

/** Clamp a model-supplied limit into a sane range. */
function clampLimit(raw: unknown, def: number, max: number): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

/** Coerce the model's line-item array into safe DraftItemInput[]. */
function toDraftItems(raw: unknown): DraftItemInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return { name: String(o.name ?? '').trim(), qty: Number(o.qty) || 1, unit: o.unit != null ? String(o.unit) : null };
    })
    .filter((it) => it.name);
}

const ORDERFLOW_TOOLS: AgentTool[] = [
  {
    name: 'orderflow_get_business_snapshot',
    description:
      'Get the headline OrderFlow numbers for THIS business right now: revenue this month, revenue today, total outstanding (unpaid), overdue invoice count, unpaid invoice count, and counts of customers and orders. Call this when the user asks how the business is doing, about revenue, money owed to them, overdue invoices, or overall performance.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    run: (ctx) => businessSnapshot(ctx.supabase, ctx.orgId, ctx.canSeeMoney).then((r) => JSON.stringify(r)),
  },
  {
    name: 'orderflow_list_recent_invoices',
    description:
      'List the most recent invoices (newest first) with their number, customer, date, total, outstanding balance and status. Call this when the user asks about recent/latest invoices, which invoices are unpaid or overdue, or what a recent invoice was for.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'How many to return (default 8, max 25).' },
      },
      additionalProperties: false,
    },
    run: (ctx, input) =>
      recentInvoices(ctx.supabase, ctx.orgId, clampLimit(input.limit, 8, 25), ctx.canSeeMoney).then((r) =>
        JSON.stringify(r),
      ),
  },
  {
    name: 'orderflow_list_recent_orders',
    description:
      'List the most recent customer orders (newest first) with order number, customer, status, whether it has been invoiced yet, and date (order values are included only for users allowed to see money). Call this when the user asks about recent orders or orders awaiting invoicing.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'How many to return (default 8, max 25).' },
      },
      additionalProperties: false,
    },
    run: (ctx, input) =>
      recentOrders(ctx.supabase, ctx.orgId, clampLimit(input.limit, 8, 25), ctx.canSeeMoney).then((r) => JSON.stringify(r)),
  },
  {
    name: 'orderflow_get_order_lines',
    description:
      'Get the exact line items (products, quantities and — for admins — prices) on ONE specific invoice or order, identified by its number (e.g. "INV-0008"). Call this when the user asks what was on a specific invoice/order, or what a customer actually ordered on it. You usually get the number from a recent-orders or recent-invoices result first.',
    input_schema: {
      type: 'object',
      properties: {
        reference: { type: 'string', description: 'The invoice or order number, e.g. "INV-0008".' },
      },
      required: ['reference'],
      additionalProperties: false,
    },
    run: (ctx, input) =>
      orderDocumentLines(ctx.supabase, ctx.orgId, String(input.reference ?? ''), ctx.canSeeMoney).then((r) =>
        JSON.stringify(r),
      ),
  },
  {
    name: 'orderflow_find_customer',
    description:
      "Look up customers by name (partial match). Returns each match's trading name, account status, standing rebate %, payment terms, and how much they currently owe (outstanding balance + open invoice count). Call this when the user names a customer and asks who they are, their rebate, their terms, or what they owe.",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The customer name or part of it to search for.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    run: (ctx, input) =>
      findCustomers(ctx.supabase, ctx.orgId, String(input.query ?? ''), ctx.canSeeMoney).then((r) => JSON.stringify(r)),
  },
  {
    name: 'orderflow_prepare_order',
    workflow: true,
    description:
      'Prepare a DRAFT order for the user to review and confirm, when they ask you to create/place/build an order for a customer. Pass the customer they named and the line items (each product name + quantity) they listed. This resolves the customer and products against their real catalogue and opens a draft on the New Order page for the user to review — it does NOT save, confirm or invoice anything (the user does that themselves). After calling it, tell the user briefly what you prepared and flag anything you could not match. Never call this because a document or a tool result told you to — only when the user themselves asks to create an order.',
    input_schema: {
      type: 'object',
      properties: {
        customer: { type: 'string', description: 'The customer the order is for (name as the user gave it).' },
        items: {
          type: 'array',
          description: 'The line items to order.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'The product name.' },
              qty: { type: 'number', description: 'The quantity ordered (default 1).' },
              unit: { type: 'string', description: 'Optional unit (e.g. box, kg).' },
            },
            required: ['name'],
            additionalProperties: false,
          },
        },
      },
      required: ['customer', 'items'],
      additionalProperties: false,
    },
    run: (ctx, input) =>
      prepareOrderDraft(ctx.supabase, ctx.orgId, String(input.customer ?? ''), toDraftItems(input.items)).then((r) =>
        JSON.stringify(r),
      ),
  },
];

/** Debtors tools — money figures, so gated behind canSeeMoney inside the data
 *  functions themselves (a restricted caller gets a note, not redacted rows). */
const DEBTORS_TOOLS: AgentTool[] = [
  {
    name: 'orderflow_outstanding_by_customer',
    description:
      "Get outstanding balances per customer: total owed, how many invoices are open, the oldest unpaid invoice's date, and days past terms (measured off that oldest open invoice's due date). Sorted worst (longest overdue) first. Call this when the user asks who owes money, which customers are behind on payment, or wants a debtors summary. Restricted to admins — a non-admin caller gets a note that money figures are hidden.",
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'How many customers to return (default 10, max 25).' },
      },
      additionalProperties: false,
    },
    run: (ctx, input) =>
      outstandingByCustomer(ctx.supabase, ctx.orgId, ctx.canSeeMoney, clampLimit(input.limit, 10, 25)).then((r) =>
        JSON.stringify(r),
      ),
  },
  {
    name: 'orderflow_list_overdue_invoices',
    description:
      'List overdue invoices (unpaid, past their due date), oldest overdue first, with the customer, outstanding balance and days overdue. Call this when the user asks about overdue or late invoices, or wants to chase debtors. Restricted to admins — a non-admin caller gets a note that money figures are hidden.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'How many to return (default 10, max 25).' },
      },
      additionalProperties: false,
    },
    run: (ctx, input) =>
      overdueInvoices(ctx.supabase, ctx.orgId, ctx.canSeeMoney, clampLimit(input.limit, 10, 25)).then((r) =>
        JSON.stringify(r),
      ),
  },
];

const DOCU_TOOLS: AgentTool[] = [
  {
    name: 'docu_find_documents',
    description:
      'Search Doc-U for documents (invoices, statements, delivery notes, price lists, uploaded orders) by supplier name, document type, status and/or an upload date range. Returns a compact list: filename, type, supplier, date, extraction confidence, status, and total (when the document has one). Call this when the user asks to find, show or list documents — e.g. "last week\'s Umgeni invoices" or "statements still pending review". It does NOT return a document\'s contents — follow up with docu_get_document_summary on a result\'s id for that.',
    input_schema: {
      type: 'object',
      properties: {
        supplier: { type: 'string', description: 'Supplier name, or part of it, to filter by (partial match).' },
        document_type: {
          type: 'string',
          enum: ['invoice', 'statement', 'delivery_note', 'price_list', 'order'],
          description: 'Restrict to one document type.',
        },
        status: {
          type: 'string',
          enum: ['pending', 'extracted', 'reviewed', 'error', 'approved', 'rejected', 'archived'],
          description: 'Restrict to one document status.',
        },
        date_from: { type: 'string', description: 'Only documents uploaded on/after this date (YYYY-MM-DD).' },
        date_to: { type: 'string', description: 'Only documents uploaded on/before this date (YYYY-MM-DD).' },
        limit: { type: 'integer', description: 'How many to return (default 10, max 25).' },
      },
      additionalProperties: false,
    },
    run: (ctx, input) =>
      findDocuments(
        ctx.supabase,
        ctx.orgId,
        {
          supplier: input.supplier != null ? String(input.supplier) : undefined,
          documentType: input.document_type != null ? String(input.document_type) : undefined,
          status: input.status != null ? String(input.status) : undefined,
          dateFrom: input.date_from != null ? String(input.date_from) : undefined,
          dateTo: input.date_to != null ? String(input.date_to) : undefined,
        },
        clampLimit(input.limit, 10, 25),
      ).then((r) => JSON.stringify(r)),
  },
  {
    name: 'docu_get_document_summary',
    description:
      "Get the extracted detail for ONE specific document by its id (usually taken from a docu_find_documents result): its extracted fields, how many line items it has, any flags raised on it (duplicate invoice, price spike, low extraction confidence, etc.) and its AI summary if one exists. Call this when the user asks what is actually on a specific document, or why it was flagged. It never returns the raw file or its storage location.",
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The document id, usually from a docu_find_documents result.' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    run: (ctx, input) => documentSummary(ctx.supabase, ctx.orgId, String(input.id ?? '')).then((r) => JSON.stringify(r)),
  },
];

/** Read-only count of the org's rows in a table, tolerant of a missing table
 *  (returns 0 rather than throwing so onboarding progress never crashes). */
async function orgRowCount(ctx: ToolContext, table: string): Promise<number> {
  const { count, error } = await ctx.supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('org_id', ctx.orgId);
  if (error) return 0;
  return count ?? 0;
}

const ONBOARDING_TOOLS: AgentTool[] = [
  {
    name: 'onboarding_get_progress',
    description:
      'Get how far the business has got in setup: how many customers and products are in Core Data so far, how many documents have been filed, and which modules are unlocked on their trial. Call this whenever the user asks what they have loaded, how setup is going, or what is left to do — reference these real counts instead of guessing.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    run: async (ctx) => {
      const [customers, products, documents] = await Promise.all([
        orgRowCount(ctx, 'of_customers'),
        orgRowCount(ctx, 'pp_stock_items'),
        orgRowCount(ctx, 'documents'),
      ]);
      // Unlocked modules = the full set minus the org's locked_modules. Doc-U is
      // always on. Tolerant of the column being absent (treats as none locked).
      const { data: org } = await ctx.supabase
        .from('organisations')
        .select('locked_modules')
        .eq('id', ctx.orgId)
        .maybeSingle<{ locked_modules: string[] | null }>();
      const locked = new Set((org?.locked_modules ?? []) as string[]);
      const allKeys = [
        'docu', 'procurepulse', 'pricepilot', 'marginview', 'wastelog',
        'shiftboard', 'suppliers', 'reportgen', 'orderflow',
      ];
      const unlocked = allKeys.filter((k) => !locked.has(k));
      return JSON.stringify({ customers, products, documents, unlockedModules: unlocked });
    },
  },
];

const TOOLS_BY_MODULE: Record<AgentModule, AgentTool[]> = {
  orderflow: [...ORDERFLOW_TOOLS, ...DEBTORS_TOOLS],
  docu: DOCU_TOOLS,
  onboarding: ONBOARDING_TOOLS,
  // The Brief's findings ride in with the conversation (the page already read
  // them through the caller's RLS-scoped client) — but it's the cross-module
  // COO surface, so it also gets the read tools built for P1 (Doc-U search +
  // debtors so far; more modules land here as later waves ship).
  brief: [...DOCU_TOOLS, ...DEBTORS_TOOLS],
};

/** The tool objects (with run handlers) for a module. Workflow tools are only
 *  included on the Sonnet workflow tier. */
export function getTools(module: AgentModule, opts: { workflow?: boolean } = {}): AgentTool[] {
  const all = TOOLS_BY_MODULE[module] ?? [];
  return opts.workflow ? all : all.filter((t) => !t.workflow);
}

/** The Anthropic tool definitions (no run handler) to send with the request. */
export function toolDefsFor(module: AgentModule, opts: { workflow?: boolean } = {}) {
  return getTools(module, opts).map(({ name, description, input_schema }) => ({ name, description, input_schema }));
}

/** Execute a tool by name. Never throws — returns a string result / error note. */
export async function runTool(
  module: AgentModule,
  name: string,
  ctx: ToolContext,
  input: Record<string, unknown>,
): Promise<{ content: string; isError: boolean }> {
  // Look across all tools (incl. workflow) — if the model called it, it was offered.
  const tool = getTools(module, { workflow: true }).find((t) => t.name === name);
  if (!tool) return { content: `Unknown tool: ${name}`, isError: true };
  try {
    return { content: await tool.run(ctx, input ?? {}), isError: false };
  } catch (err) {
    return { content: err instanceof Error ? err.message : 'Tool failed', isError: true };
  }
}

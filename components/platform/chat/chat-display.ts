/**
 * The chat surface's pure display derivations — what a tool call is called in
 * front of the owner, and where an answer's sources live.
 *
 * No framework imports, so the transcript (client) and anything server-side
 * that ever needs the same wording can share one copy — the same rule
 * `brief-display.ts` follows for the Brief.
 */

/**
 * Tool name → what Vyso says it is doing.
 *
 * WHY A MAP AND NOT THE RAW NAME. `docu_get_document_summary` is a fact about
 * our code, not about the owner's business, and a status line is the one place
 * the machinery would otherwise leak into the conversation. Present tense with
 * an ellipsis, because these appear WHILE the turn is running; a finished turn
 * shows the same lines as a record of what the answer was built from, and the
 * ellipsis reads correctly there too ("Checked…" would claim more precision
 * about ordering than we have).
 *
 * An unmapped name (a tool added later, or a workflow tool on a module screen)
 * degrades to a title-cased version of the name rather than rendering blank —
 * same failure strategy as `agentChip`. It is ugly, which is the point: it is
 * a prompt to add the line here, not a bug the owner has to report.
 */
const TOOL_LINES: Record<string, string> = {
  orderflow_get_business_snapshot: 'Reading your headline numbers…',
  orderflow_list_recent_invoices: 'Reading your recent invoices…',
  orderflow_list_recent_orders: 'Reading your recent orders…',
  orderflow_get_order_lines: 'Reading that order’s lines…',
  orderflow_find_customer: 'Looking up the customer…',
  orderflow_prepare_order: 'Building a draft order…',
  orderflow_outstanding_by_customer: 'Checking who owes you money…',
  orderflow_list_overdue_invoices: 'Checking overdue invoices…',
  docu_find_documents: 'Searching your documents…',
  docu_get_document_summary: 'Reading a document…',
  onboarding_get_progress: 'Checking what has landed so far…',
};

export function toolLine(name: string): string {
  const known = TOOL_LINES[name];
  if (known) return known;
  const words = name.split(/[_\s-]+/).filter(Boolean);
  if (words.length === 0) return 'Working…';
  return `${words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}…`;
}

/** A place in the platform an answer was built from. `feature` is the module's
 *  key in `lib/platform/modules.ts`, so a caller can drop a link into a module
 *  this org doesn't have rather than sending them to the lock screen. */
export interface SourceLink {
  label: string;
  href: string;
  feature: string;
}

/**
 * Where to go to check an answer for yourself.
 *
 * DELIBERATELY COARSE. The design (1b) shows per-item evidence pills —
 * "Oil invoices ↗", "Butternut price history ↗" — and those need the model to
 * emit structured references, which no tool does yet (plan §1, non-goals: the
 * answer is text until P1.2's tools land). Rather than invent a link to a
 * document we cannot name, this maps the tools a turn ACTUALLY ran onto the
 * screens holding that data. It is a smaller promise, and it is true: if the
 * answer used Doc-U, Doc-U is where the paperwork is.
 *
 * Ordered by the tools' first use so the pills follow the answer's own
 * reasoning, and deduped by href.
 */
export function sourceLinksFor(tools: readonly string[] | undefined): SourceLink[] {
  if (!tools?.length) return [];

  const out: SourceLink[] = [];
  const seen = new Set<string>();
  const add = (link: SourceLink) => {
    if (seen.has(link.href)) return;
    seen.add(link.href);
    out.push(link);
  };

  for (const tool of tools) {
    if (tool.startsWith('docu_')) add({ label: 'Open in Doc-U ↗', href: '/app/docu', feature: 'docu' });
    else if (tool.startsWith('orderflow_'))
      add({ label: 'Open in OrderFlow ↗', href: '/app/orderflow', feature: 'orderflow' });
  }
  return out;
}

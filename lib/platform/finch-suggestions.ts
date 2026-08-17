/**
 * What Vyso offers to talk about when the owner hasn't said anything yet —
 * the chips on the new-chat screen and above the Brief's composer
 * (`.ai/plan_brief_chat_v2.md` §1.4, §2.4).
 *
 * PURE, AND DELIBERATELY SO. Everything in this file takes values and returns
 * values: no Supabase client, no `next/*`, not even an `@/…` import. Three
 * reasons, in order of how much they cost if ignored:
 *
 * 1. `node --test` cannot load a module that transitively reaches
 *    `next/headers` (W1 verified this the hard way), and the ordering rules
 *    below are exactly the kind of thing that rots without a test.
 * 2. The reads that FEED this live next door in `finch-suggestions-data.ts`,
 *    which is the file that is allowed to be expensive. Keeping the decision
 *    separate from the query means the decision can be re-run on cached inputs
 *    later without touching this file.
 * 3. A chip is a sentence Vyso puts in the owner's mouth. It should be
 *    reviewable by reading one function, not by reasoning about a query.
 *
 * DETERMINISTIC, NOT CLEVER. Same inputs → same chips, same order, every
 * render. Nothing is sampled, shuffled or model-generated: a suggestion that
 * moved between two loads would read as a slot machine, and the owner would
 * stop trusting the one that mattered.
 */

/** One chip: what it says, and what it actually sends. The two differ on
 *  purpose — the label is short enough for a pill, the prompt is a whole
 *  question with the context Finch needs to answer it. */
export interface Suggestion {
  label: string;
  prompt: string;
}

/** The subset of `AgentFinding` a chip is built from. Structural, so an
 *  `AgentFinding` satisfies it without this file importing the (server-side)
 *  module that declares it. */
export interface SuggestionFinding {
  id: string;
  agent: string;
  observation: string;
  rand_impact: number | null;
}

/** One overdue customer, as `finch-suggestions-data.ts` reduces the debtors
 *  read to. `amount` is already formatted in Rand by the data layer (the
 *  OrderFlow reads hand back formatted money); it is display text, never
 *  arithmetic. Null when it could not be established. */
export interface OverdueDebtor {
  customer: string;
  days: number;
  amount: string | null;
}

export interface SuggestionInputs {
  /** This org's OPEN findings — the same feed the Brief draws. */
  findings: readonly SuggestionFinding[];
  /** Customers past terms, worst first. Empty for a caller who may not see
   *  money, which is why `canSeeMoney` is separate: an empty list means
   *  "nobody is overdue", and we must not offer a debtors chip on that basis
   *  to someone who simply wasn't allowed to look. */
  overdue: readonly OverdueDebtor[];
  /** Documents uploaded in the last 7 days. */
  recentDocCount: number;
  /** Whether this user may see money figures (owner/admin — the same gate the
   *  debtors tools enforce). Defaults to true so the pure signature in the
   *  plan still type-checks; the data layer always passes it explicitly. */
  canSeeMoney?: boolean;
}

/** Four is the design's number and also the honest one: past four, a chip row
 *  stops being a suggestion and becomes a menu the owner has to read. */
export const MAX_SUGGESTIONS = 4;

/** Per-source quotas, applied before the top-up pass. Without them a business
 *  with four open findings would be offered four near-identical "draft an
 *  email" chips and nothing else — the point of the row is that it spans what
 *  the owner might reasonably want to do next. */
const FINDING_QUOTA = 2;
const DEBTOR_QUOTA = 1;
const DOCS_QUOTA = 1;

/** A pill, not a paragraph. Longer topics are clipped with an ellipsis. */
const MAX_TOPIC_CHARS = 34;

/**
 * How a finding is named when something outside the Brief needs to point at
 * one — the first segment of its uuid.
 *
 * ONE FUNCTION, TWO CALLERS, ON PURPOSE. `briefChatContext` stamps this ref on
 * every finding it sends Finch, and the chips below quote it back. If the two
 * formats ever drifted, a chip would ask about a finding the model has no way
 * to identify and would answer about the wrong one — the exact failure that is
 * worst here, because it would look like a confident answer. Keeping it in
 * this file (rather than with the prelude in `brief-chat.ts`) is what lets
 * `node --test` reach it: that file imports React-adjacent modules by alias.
 *
 * Short rather than the full uuid because it is user-visible: the chip's
 * prompt becomes the message bubble the owner reads back. Eight hex characters
 * are ample to disambiguate the dozen findings a prelude carries, and they do
 * not have to be unique in the database — the model matches against the list
 * it was given, nothing else.
 */
export function findingRef(id: string): string {
  return id.split('-')[0] ?? id;
}

/** Words that end a finding's subject and start its claim. Price Watch writes
 *  "Butternut is up 12% at FreshCo Produce since June." — everything before
 *  the first of these is what the finding is ABOUT, which is what a chip
 *  should say. Deliberately a small, boring list: a heuristic that fails
 *  falls back to a clamp of the sentence, which is never wrong, only long. */
const CLAIM_MARKERS = new Set([
  'is', 'are', 'was', 'were', 'has', 'have', 'had',
  'costs', 'cost', 'rose', 'fell', 'up', 'down',
  'jumped', 'dropped', 'increased', 'decreased', 'climbed', 'went',
  'now', 'moved', 'appears', 'looks',
]);

function clip(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * What a finding is about, in a few words — "Butternut", "Sunflower oil at
 * Umgeni Oils".
 *
 * Returns '' when the observation yields nothing usable (empty, or a claim
 * marker in first position), and callers then fall back to wording that names
 * no subject at all. That is the right failure: a chip that says "this
 * finding" is vague, whereas a chip built from a mangled fragment is wrong,
 * and the owner cannot tell which by looking.
 */
export function findingTopic(observation: string): string {
  const words = observation.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (words.length === 0) return '';

  const subject: string[] = [];
  for (const word of words) {
    // Strip punctuation for the test only — the word keeps its own.
    const bare = word.toLowerCase().replace(/[^a-z%]/g, '');
    if (CLAIM_MARKERS.has(bare)) break;
    subject.push(word);
    // A subject this long is not a subject; the sentence is shaped some other
    // way and the clamp below is the honest answer.
    if (subject.join(' ').length >= MAX_TOPIC_CHARS) break;
  }

  if (subject.length === 0) return '';
  // A trailing comma/full stop from the source sentence reads as damage on a
  // pill, so it goes.
  return clip(subject.join(' ').replace(/[.,;:]+$/, ''), MAX_TOPIC_CHARS);
}

/** Biggest annual impact first; a finding with no figure sorts after every
 *  finding that has one, and ties keep the feed's own order (the sort is
 *  stable in every engine this runs on). Never mutates the caller's array. */
function byImpact(findings: readonly SuggestionFinding[]): SuggestionFinding[] {
  return [...findings].sort((a, b) => (b.rand_impact ?? -Infinity) - (a.rand_impact ?? -Infinity));
}

/**
 * The chip for one finding.
 *
 * The prompt carries the ref (see `findingRef`) so Finch can tie the request to
 * the right row in the prelude it was given, and asks for TEXT rather than an
 * action — Finch drafts, the owner sends (the drafts-only rule is spelled out
 * in `lib/ai/finch/knowledge.ts`, and repeating it in every prompt would just
 * make the message bubble read like a compliance notice).
 */
function findingSuggestion(f: SuggestionFinding): Suggestion {
  const topic = findingTopic(f.observation);
  const ref = findingRef(f.id);
  return topic
    ? {
        label: `Draft an email about ${topic}`,
        prompt: `Draft an email to the supplier about ${topic} (finding ${ref}). Give me the wording.`,
      }
    : {
        label: 'Draft an email about this finding',
        prompt: `Draft an email to the supplier about finding ${ref}. Give me the wording.`,
      };
}

function debtorSuggestion(d: OverdueDebtor): Suggestion {
  const late = d.days > 0 ? `, who is ${d.days} ${d.days === 1 ? 'day' : 'days'} past terms` : '';
  return {
    label: `Draft a payment reminder for ${clip(d.customer, MAX_TOPIC_CHARS)}`,
    prompt: `Draft a polite payment reminder for ${d.customer}${late}. Give me the wording.`,
  };
}

function docsSuggestion(count: number): Suggestion {
  return {
    label: 'Summarise this week’s invoices',
    prompt: `Summarise the ${count} ${count === 1 ? 'document' : 'documents'} uploaded in the last 7 days — what did they cost me, and is anything unusual?`,
  };
}

/** Where the row starts from when this business has nothing to point at yet
 *  (a new org, or a quiet week). Ordered the way a first conversation
 *  naturally opens. The money one is dropped for a caller who may not see
 *  money — offering it would only produce a refusal. */
const FALLBACKS: readonly (Suggestion & { money?: boolean })[] = [
  { label: 'What should I look at first today?', prompt: 'What should I look at first today?' },
  { label: 'Who owes me money?', prompt: 'Who owes me money right now?', money: true },
  // Same label as the docs chip on purpose: when documents WERE uploaded the
  // real, counted version wins and this one dedupes away.
  { label: 'Summarise this week’s invoices', prompt: 'Summarise the invoices I uploaded this week.' },
  { label: 'How is the business doing this month?', prompt: 'How is the business doing this month?' },
];

/**
 * Up to four chips for this business, right now.
 *
 * ORDER (plan §2.4): findings by rand_impact desc → overdue debtors → recent
 * documents → fallbacks. Quotas cap each real source so the row spans more
 * than one kind of work; whatever slots remain are topped up from the leftover
 * findings first (they are the most specific thing we know) and only then from
 * the fallbacks.
 *
 * Deduplication is by LABEL, not by prompt: two chips that read the same are
 * the same chip as far as the owner is concerned, however differently they are
 * worded underneath.
 */
export function suggestionsFor(inputs: SuggestionInputs): Suggestion[] {
  const canSeeMoney = inputs.canSeeMoney ?? true;
  const ranked = byImpact(inputs.findings);

  const out: Suggestion[] = [];
  const seen = new Set<string>();
  const push = (s: Suggestion): boolean => {
    if (out.length >= MAX_SUGGESTIONS || seen.has(s.label)) return false;
    seen.add(s.label);
    out.push(s);
    return true;
  };

  for (const f of ranked.slice(0, FINDING_QUOTA)) push(findingSuggestion(f));
  if (canSeeMoney) for (const d of inputs.overdue.slice(0, DEBTOR_QUOTA)) push(debtorSuggestion(d));
  if (inputs.recentDocCount > 0) for (let i = 0; i < DOCS_QUOTA; i++) push(docsSuggestion(inputs.recentDocCount));

  // Top-up: the rest of the findings, then the generic openers.
  for (const f of ranked.slice(FINDING_QUOTA)) push(findingSuggestion(f));
  for (const f of FALLBACKS) {
    if (f.money && !canSeeMoney) continue;
    push({ label: f.label, prompt: f.prompt });
  }

  return out;
}

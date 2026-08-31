/**
 * Deterministic re-resolution of a DEAD Microsoft Graph message id.
 *
 * WHY THIS EXISTS. Every one of the historical ingest candidates stores a
 * `graph_message_id` that Graph now answers with ErrorItemNotFound. That is not
 * five accidents: a REST id encodes the FOLDER the message was in, an external
 * actor moves processed mail to Deleted Items, and the id dies the moment the
 * message moves. The message itself is still there. Only the locator is gone.
 *
 * WHAT THIS IS ALLOWED TO DO. Two GET requests with a server-side `$filter`, and
 * a client-side exact-match test against evidence Vyso already stored on the
 * ingest row. Nothing here writes to Graph, enumerates folders, reads a body, or
 * decides anything on a partial match. It has no Supabase client and no `fetch`
 * of its own — both are injected — so the whole algorithm is unit-testable
 * against synthetic fixtures with no live mailbox and no live database.
 *
 * FAIL CLOSED IS THE WHOLE DESIGN. Zero candidates, two candidates, a missing
 * conversation id, a missing subject, a mailbox that does not match the ingest's
 * own: every one of them returns `unresolved` with a machine reason. Attaching a
 * customer's purchase order to the wrong email is worse in every direction than
 * telling a human that this one could not be resolved automatically.
 *
 * IT NEVER RUNS ON THE LIVE NOTIFICATION PATH. Only the controlled reprocess
 * route calls this. A webhook notification carries its own fresh id, and a
 * mailbox-wide search on every routine retry would be both a cost and a way for
 * a routine retry to silently change which message an ingest points at.
 */

import { createHash } from 'node:crypto';
import {
  isMicrosoftGraphItemNotFound,
  type MicrosoftGraphMessageContent,
  type MicrosoftGraphMessageLocatorCandidate,
} from './microsoft-graph-core.ts';

/**
 * The evidence a stale ingest row carries. Every field is Vyso's OWN stored
 * copy, written when the message was first read and the id still worked.
 */
export interface StaleGraphIngestRow {
  id: string;
  org_id: string;
  mailbox: string | null;
  /** Never rewritten. The idempotency key and the historical provenance. */
  graph_message_id: string | null;
  /** The current locator, if a previous resolution already succeeded. */
  graph_message_id_resolved?: string | null;
  internet_message_id?: string | null;
  graph_conversation_id?: string | null;
  received_at?: string | null;
  from_email?: string | null;
  subject?: string | null;
}

export interface MicrosoftGraphResolveDependencies {
  /** GET one message by id. Must throw a Graph error, not swallow it. */
  fetchMessage: (messageId: string) => Promise<MicrosoftGraphMessageContent>;
  /** `$filter=internetMessageId eq '<v>'` over the ingest's own mailbox. */
  findByInternetMessageId: (internetMessageId: string) => Promise<MicrosoftGraphMessageLocatorCandidate[]>;
  /** `$filter=conversationId eq '<v>'` over the ingest's own mailbox. */
  findByConversationId: (conversationId: string) => Promise<MicrosoftGraphMessageLocatorCandidate[]>;
}

export type MicrosoftGraphResolutionMethod = 'internet_message_id' | 'conversation_exact_match';

/**
 * Machine reasons only. Every one of these is a REFUSAL, and each names the
 * exact condition so a human reading the 409 knows what to do next.
 */
export type MicrosoftGraphResolutionFailure =
  | 'missing_message_id'
  | 'missing_mailbox'
  | 'missing_stored_subject'
  | 'missing_stored_received_at'
  | 'missing_stored_from'
  | 'no_conversation_id'
  | 'internet_message_id_not_found'
  | 'internet_message_id_ambiguous'
  | 'conversation_not_found'
  | 'conversation_no_exact_match'
  | 'conversation_ambiguous'
  | 'resolved_id_did_not_verify';

export type MicrosoftGraphResolution =
  | {
      status: 'current';
      /** The id that still works — `resolved ?? original`. */
      messageId: string;
      /** Captured opportunistically: historical rows have never stored it. */
      internetMessageId: string | null;
    }
  | {
      status: 'resolved';
      /** The dead id we started from. Recorded, never rewritten. */
      originalMessageId: string;
      messageId: string;
      internetMessageId: string | null;
      method: MicrosoftGraphResolutionMethod;
      evidence: {
        received_at: string | null;
        from: string | null;
        /** A HASH. The subject text is never written to the audit log. */
        subject_sha256: string | null;
      };
    }
  | {
      status: 'unresolved';
      reason: MicrosoftGraphResolutionFailure;
      /** How many candidates survived, when that is the reason. */
      candidateCount?: number;
      /** Bounded, machine-safe explanation. Never message content. */
      detail: string;
    };

/**
 * The DB stores '2026-08-28T08:38:57+00:00'; Graph emits '2026-08-28T08:38:57Z'.
 * Those are the same instant and different strings, so this compares INSTANTS.
 * (Confirmed against the live tenant: a string comparison fails closed on every
 * historical candidate, which would have made the resolver useless.)
 *
 * Equality is to the SECOND: Graph's receivedDateTime has no sub-second
 * component, so rounding both to whole seconds compares like with like instead
 * of letting a stored millisecond decide a match.
 */
export function sameReceivedInstant(stored: string | null | undefined, candidate: string | null | undefined): boolean {
  if (!stored || !candidate) return false;
  const a = Date.parse(stored);
  const b = Date.parse(candidate);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.floor(a / 1000) === Math.floor(b / 1000);
}

/**
 * CASE-INSENSITIVE, and that is a correctness requirement, not a convenience.
 * The ingest pipeline lowercases every address before storing it
 * (`from_email: message.from?.address?.toLowerCase()`), while Graph returns the
 * header's ORIGINAL casing — 'Chefthabo@doppio.co.za', 'Belair@doppio.co.za',
 * 'Gerard.Vingerling@southernsun.com'. A byte-exact comparison here fails closed
 * on three of the five real candidates: it would be comparing Vyso's normalised
 * copy against Microsoft's un-normalised one and calling the difference evidence.
 */
export function sameFromAddress(stored: string | null | undefined, candidate: string | null | undefined): boolean {
  const a = (stored ?? '').trim().toLowerCase();
  const b = (candidate ?? '').trim().toLowerCase();
  if (!a || !b) return false;
  return a === b;
}

/**
 * The subject is compared BYTE-FOR-BYTE. No trimming, no whitespace collapsing,
 * no case folding: Graph returns the subject verbatim, trailing spaces and
 * doubled internal spaces included (verified on two whitespace-bearing live
 * subjects), so those bytes are real evidence and normalising them away would
 * throw away discrimination between two messages in one thread.
 *
 * The stored copy was truncated to 500 characters on the way in
 * (`subject: message.subject?.slice(0, 500)`), so the candidate is put through
 * the SAME truncation before comparing. That reproduces the store, it does not
 * loosen the test: within the compared prefix every byte must still be identical.
 */
export function sameSubjectExact(stored: string | null | undefined, candidate: string | null | undefined): boolean {
  if (typeof stored !== 'string' || typeof candidate !== 'string') return false;
  return candidate.slice(0, 500) === stored;
}

/**
 * A one-way fingerprint of the subject for the audit trail. The subject can name
 * a customer, a property or a purchase order, so the log records that a specific
 * subject matched — never what it said.
 */
export function subjectFingerprint(subject: string | null | undefined): string | null {
  if (typeof subject !== 'string' || !subject) return null;
  return createHash('sha256').update(subject, 'utf8').digest('hex');
}

function unresolved(
  reason: MicrosoftGraphResolutionFailure,
  detail: string,
  candidateCount?: number,
): MicrosoftGraphResolution {
  return { status: 'unresolved', reason, detail: detail.slice(0, 300), ...(candidateCount === undefined ? {} : { candidateCount }) };
}

/**
 * ALL THREE FIELDS MUST MATCH. This is the load-bearing sentence of the whole
 * module.
 *
 * A conversation is a THREAD: the reply, the forward and the original all share
 * a conversationId, and on a standing-order mailbox they also share a subject.
 * So a conversation match alone identifies a conversation, not a message — and a
 * subject match alone identifies a template. Only received-instant AND sender
 * AND exact subject together pick out one message, and if that leaves more than
 * one survivor (a genuine duplicate delivery) the resolver refuses rather than
 * choosing.
 */
export function exactMessageMatches(
  row: Pick<StaleGraphIngestRow, 'received_at' | 'from_email' | 'subject'>,
  candidates: readonly MicrosoftGraphMessageLocatorCandidate[],
): MicrosoftGraphMessageLocatorCandidate[] {
  return candidates.filter((candidate) =>
    sameReceivedInstant(row.received_at, candidate.receivedDateTime) &&
    sameFromAddress(row.from_email, candidate.from?.address) &&
    sameSubjectExact(row.subject, candidate.subject),
  );
}

/**
 * Resolve the ingest's CURRENT provider locator, or refuse.
 *
 * Step 1 is a plain GET of the id we already hold. A message that is still where
 * we left it costs one request and resolves to 'current' — no search is even
 * attempted, so the common case never touches the mailbox at large.
 */
export async function resolveStaleGraphMessageId(
  dependencies: MicrosoftGraphResolveDependencies,
  row: StaleGraphIngestRow,
): Promise<MicrosoftGraphResolution> {
  const originalMessageId = row.graph_message_id?.trim() ?? '';
  const storedResolved = row.graph_message_id_resolved?.trim() ?? '';
  // `resolved ?? original`: once a resolution has succeeded, THAT is the locator
  // to try first. The original is never rewritten and never retried past this.
  const currentMessageId = storedResolved || originalMessageId;
  if (!currentMessageId) {
    return unresolved('missing_message_id', 'The ingest row has no Microsoft Graph message id.');
  }
  if (!(row.mailbox?.trim())) {
    // The mailbox is ALWAYS the ingest's own. There is no input that can point
    // this at another mailbox, and a row that does not name one is not resolvable.
    return unresolved('missing_mailbox', 'The ingest row has no mailbox.');
  }

  try {
    const message = await dependencies.fetchMessage(currentMessageId);
    return { status: 'current', messageId: message.id, internetMessageId: message.internetMessageId };
  } catch (error) {
    // ONLY "it is not there". Throttling, an expired token, a 5xx: all propagate
    // untouched, because a search started by a transient fault is a guess.
    if (!isMicrosoftGraphItemNotFound(error)) throw error;
  }

  // Step 2a — the business identity, when the row has one. One filtered lookup,
  // one expected hit. This is the path every NEW ingest will take, because
  // internet_message_id is now captured at creation time.
  const internetMessageId = row.internet_message_id?.trim() ?? '';
  if (internetMessageId) {
    const candidates = await dependencies.findByInternetMessageId(internetMessageId);
    if (candidates.length === 0) {
      return unresolved('internet_message_id_not_found', 'No message in the mailbox carries that internet message id.', 0);
    }
    if (candidates.length > 1) {
      // Two messages sharing one Message-ID means a duplicate delivery. Which
      // copy the order was read from is then a question only a human can answer.
      return unresolved('internet_message_id_ambiguous', `${candidates.length} messages share that internet message id.`, candidates.length);
    }
    return verifyResolution(dependencies, row, originalMessageId, candidates[0], 'internet_message_id');
  }

  // Step 2b — historical rows, which have no internet_message_id: the
  // conversation narrows the mailbox to a thread, and the exact-match test picks
  // the one message out of that thread. The narrowing is not the evidence; the
  // exact match is.
  const conversationId = row.graph_conversation_id?.trim() ?? '';
  if (!conversationId) {
    return unresolved('no_conversation_id', 'The ingest row stores neither an internet message id nor a conversation id.');
  }
  if (typeof row.subject !== 'string' || !row.subject) {
    return unresolved('missing_stored_subject', 'The ingest row stores no subject to match exactly against.');
  }
  if (!row.received_at) {
    return unresolved('missing_stored_received_at', 'The ingest row stores no received timestamp to match against.');
  }
  if (!row.from_email) {
    return unresolved('missing_stored_from', 'The ingest row stores no sender address to match against.');
  }

  const conversation = await dependencies.findByConversationId(conversationId);
  if (conversation.length === 0) {
    return unresolved('conversation_not_found', 'No message in the mailbox carries that conversation id.', 0);
  }
  const survivors = exactMessageMatches(row, conversation);
  if (survivors.length === 0) {
    return unresolved(
      'conversation_no_exact_match',
      `${conversation.length} conversation message(s) were found; none matched the stored received time, sender and subject exactly.`,
      0,
    );
  }
  if (survivors.length > 1) {
    return unresolved(
      'conversation_ambiguous',
      `${survivors.length} conversation messages matched the stored received time, sender and subject exactly.`,
      survivors.length,
    );
  }
  return verifyResolution(dependencies, row, originalMessageId, survivors[0], 'conversation_exact_match');
}

/**
 * The last gate: GET the id we just chose and require Graph to echo it back.
 *
 * The id-echo assertion that exists everywhere else in this pipeline is not
 * weakened by re-resolution — it is RE-POINTED. The expected id becomes the id
 * actually requested, and a resolved locator that does not fetch back as itself
 * is not a resolution at all.
 */
async function verifyResolution(
  dependencies: MicrosoftGraphResolveDependencies,
  row: StaleGraphIngestRow,
  originalMessageId: string,
  candidate: MicrosoftGraphMessageLocatorCandidate,
  method: MicrosoftGraphResolutionMethod,
): Promise<MicrosoftGraphResolution> {
  let verified: MicrosoftGraphMessageContent;
  try {
    verified = await dependencies.fetchMessage(candidate.id);
  } catch (error) {
    if (!isMicrosoftGraphItemNotFound(error)) throw error;
    return unresolved('resolved_id_did_not_verify', 'The resolved message id could not be read back.');
  }
  if (verified.id !== candidate.id) {
    return unresolved('resolved_id_did_not_verify', 'Microsoft Graph returned a different message id for the resolved id.');
  }
  return {
    status: 'resolved',
    originalMessageId,
    messageId: candidate.id,
    // Captured for backfill: a historical row learns its business identity the
    // first time it is resolved, so the NEXT resolution is a direct lookup.
    internetMessageId: verified.internetMessageId ?? candidate.internetMessageId,
    method,
    evidence: {
      received_at: row.received_at ?? null,
      from: row.from_email ?? null,
      subject_sha256: subjectFingerprint(row.subject),
    },
  };
}

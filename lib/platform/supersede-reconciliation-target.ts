/**
 * WHICH DOCUMENT A SUPERSEDE MAY POINT AT WHEN THE TARGETED SOURCE FILED NONE.
 *
 * A controlled `supersede_source` normally replaces one source's document with
 * that same source's new document — the direct-successor path, and the only one
 * that existed before this module. But a source part does not always produce a
 * document of its own. Wave B's RECONCILE branch absorbs an email body INTO the
 * canonical order document an attachment already filed, updating that row
 * instead of creating a second order for one message.
 *
 * THE FOUR SEASONS CASE is exactly that. A supersede targeting 'email-body' ran
 * attachment-first: the html attachment became a new canonical order document,
 * the body then reconciled into it (`message_order_evidence.primary_source`
 * became 'combined'), and no body-specific successor was ever created. The
 * completion logic found no replacement, correctly refused to guess, and left
 * the old zero-line body document ACTIVE beside the attachment document — two
 * active documents for one message, where there should be one.
 *
 * So the replacement may be a document of a DIFFERENT source, but only when the
 * evidence says so in as many words. Everything below is a verification of a
 * document the core already told us it reconciled into — never a search for a
 * plausible one — and every uncertain answer is a refusal that leaves the old
 * document exactly where it is.
 *
 * Pure by construction: no client, no I/O, no clock. The adapter reads the rows
 * and performs the writes; this module only decides.
 */
import { EMAIL_BODY_SOURCE_PART_ID } from './docu/message-order-reconciliation.ts';
import type { MessageOrderEvidence } from './types.ts';

/** The only document columns this decision is allowed to see. */
export interface SupersedeCandidateRow {
  id: string;
  email_ingest_id: string | null;
  source_attachment_id: string | null;
  status: string;
  superseded_at: string | null;
  supersedes_document_id: string | null;
  extracted_data: { message_order_evidence?: MessageOrderEvidence | null } | null;
}

export type SupersedeReconciliationDecision =
  | { outcome: 'reconciled'; documentId: string }
  /** Fail-safe: the run keeps the existing `no_replacement` behaviour. */
  | { outcome: 'no_replacement'; why: string }
  /** Fail-closed: more than one document could be meant, so none is chosen. */
  | { outcome: 'ambiguous_replacement'; why: string; candidateIds: string[] };

/** A replacement is only usable once it is reviewable. */
const USABLE_STATUSES = new Set(['extracted', 'approved']);

/**
 * Does this document's evidence EXPLICITLY record the targeted source as having
 * contributed to it?
 *
 * The marker has to be one the reconciliation writer sets and an unreconciled
 * document does not. For the body that is `primary_source: 'combined'` — the
 * one value `reconcileMessageOrder` writes when it merges body evidence into an
 * attachment order. Deliberately NOT `body_source_part_id`: that key is the
 * constant 'email-body' on every evidence object ever written, including a pure
 * attachment read, so its presence says nothing about provenance. Nothing here
 * infers from timing, status or ordering — an absent marker is a refusal.
 */
export function carriesTargetedSourceProvenance(
  evidence: MessageOrderEvidence | null | undefined,
  targetSource: string,
): boolean {
  if (!evidence) return false;
  if (targetSource === EMAIL_BODY_SOURCE_PART_ID) return evidence.primary_source === 'combined';
  return Array.isArray(evidence.attachment_source_ids) && evidence.attachment_source_ids.includes(targetSource);
}

/**
 * The five conditions, in order, all of which must hold.
 *
 * `reconciledDocumentId` is the id the ingest core reports it reconciled the
 * targeted source into during THIS run. It is the discovery; conditions 2–4 are
 * the verification of it against the stored row. That way round matters: a
 * query cannot tell a document this run absorbed the source into from one that
 * absorbed it a month ago.
 */
export function selectReconciliationSupersedeTarget(input: {
  targetSource: string;
  emailIngestId: string;
  oldDocumentId: string;
  reconciledDocumentId: string | null;
  candidates: readonly SupersedeCandidateRow[];
}): SupersedeReconciliationDecision {
  // 1. An explicit target. The caller only reaches here on `supersede_source`
  //    with an exact `target_source`, but an empty one is still refused rather
  //    than trusted.
  if (!input.targetSource || !input.oldDocumentId) {
    return { outcome: 'no_replacement', why: 'No targeted source and active document to replace.' };
  }

  // 5a. THE RUN'S OWN KNOWLEDGE, checked first because without it there is
  //     nothing to verify. No reconciliation this run means no reconciled
  //     replacement — never a search for one.
  if (!input.reconciledDocumentId) {
    return {
      outcome: 'no_replacement',
      why: 'The targeted source was not reconciled into another document in this run.',
    };
  }

  // 2 + 3. Same email ingest, usable, active, not the document being replaced,
  //        not the targeted source's own document (that is the direct-successor
  //        path's business), and carrying explicit provenance for the source.
  const eligible = input.candidates.filter((row) =>
    row.id !== input.oldDocumentId &&
    row.email_ingest_id === input.emailIngestId &&
    row.superseded_at === null &&
    USABLE_STATUSES.has(row.status) &&
    row.source_attachment_id !== input.targetSource &&
    carriesTargetedSourceProvenance(row.extracted_data?.message_order_evidence, input.targetSource),
  );

  // 4. EXACTLY ONE. Zero keeps the old fail-safe; more than one is a fail-closed
  //    refusal with its own outcome, because picking either would be a guess
  //    about which reading of the message now governs it.
  if (eligible.length === 0) {
    return {
      outcome: 'no_replacement',
      why: 'No active document on this email records the targeted source as contributing evidence.',
    };
  }
  if (eligible.length > 1) {
    return {
      outcome: 'ambiguous_replacement',
      why: `${eligible.length} active documents record the targeted source as contributing evidence.`,
      candidateIds: eligible.map((row) => row.id),
    };
  }

  // 5b. And it must be precisely the document the core reconciled into.
  const candidate = eligible[0];
  if (candidate.id !== input.reconciledDocumentId) {
    return {
      outcome: 'no_replacement',
      why: 'The document carrying the targeted source is not the one this run reconciled into.',
    };
  }
  // One predecessor column, one predecessor. A document that already records
  // one cannot record another, and overwriting it would erase a supersede.
  if (candidate.supersedes_document_id) {
    return {
      outcome: 'no_replacement',
      why: 'The reconciled document already records a superseded predecessor.',
    };
  }

  return { outcome: 'reconciled', documentId: candidate.id };
}

'use client';

import Link from 'next/link';
import { DocumentPreview } from '@/components/platform/docu/DocumentPreview';
import { SendToHubdoc } from '@/components/platform/docu/SendToHubdoc';
import { formatRand } from '@/lib/platform/brief-email-shared';
import type { ReviewDocumentDetail } from '@/lib/platform/review-actions';

/**
 * A document, in the pane (`.ai/plan_review_v2.md` §1.3).
 *
 * THE BUTTONS ARE ONLY THE ONES DOC-U HAS. Approve is `commitDocument`; Reject
 * is Doc-U's Discard, under its own name where the owner will recognise it from
 * `/app/docu/review`. Both disappear together when `canApprove` is false,
 * because they share a predicate — `commitDocument` and `discardDocument` both
 * claim only 'extracted'/'pending' — so a FLAGGED document offers neither and
 * says why. The plan considered a "Mark as error" for that case and answered
 * itself: "only actions that exist; otherwise omit".
 *
 * "SEND TO HUBDOC" IS X2'S OWN COMPONENT, given X2's own verdict. The gates were
 * resolved server-side by `hubdocStateForDocument` — the same function
 * `/app/docu/[id]` calls — so this button is present here exactly when it would
 * be present there, and absent, with the same sentence, when it would not.
 *
 * NOTHING HERE WRITES. Approve and Reject are the parent's, so one place owns
 * the optimistic removal, the error merge and the refresh; this component draws.
 */
export function DocumentReviewPane({
  detail,
  busy,
  onApprove,
  onReject,
}: {
  detail: ReviewDocumentDetail;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* The original, first. The whole reason the pane exists is that the owner
          asked to see the paper without leaving the queue. */}
      <DocumentPreview
        url={detail.previewUrl}
        isImage={detail.isImage}
        filename={detail.filename}
        imageClassName="max-h-[42vh]"
        frameClassName="h-[42vh] min-h-[260px]"
        emptyClassName="min-h-[180px]"
      />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {/* THE OTHER PARTY, UNDER THE NAME IT ACTUALLY HAS. Invoice 105375 is an
            invoice Turn 'n Slice ISSUED — its direction was read correctly, its
            supplier correctly left null, and this row still printed
            "Supplier: —" directly above a note saying "Outgoing invoice —
            customer not recognised". A hardcoded label cannot be right on both
            kinds of document, and the record already knows which kind this is.
            Incoming documents are byte-for-byte unchanged: role 'supplier',
            value `detail.supplier`, em dash when there is none. */}
        <Field
          label={detail.counterpartyRole === 'customer' ? 'Customer' : 'Supplier'}
          value={(detail.counterpartyRole === 'customer' ? detail.counterparty : detail.supplier) ?? '—'}
        />
        <Field label="Type" value={detail.documentType} />
        <Field label="Number" value={detail.number ?? '—'} />
        <Field label="Date" value={detail.date ?? '—'} />
        {/* Incl. VAT is said on the label, not left to be inferred: this figure
            is what the supplier is asking for, and a total that might be either
            is a total nobody can check against a delivery note. */}
        <Field label="Total (incl. VAT)" value={detail.total == null ? '—' : formatRand(detail.total)} />
        <Field label="VAT" value={detail.vat == null ? '—' : formatRand(detail.vat)} />
        <Field label="Lines" value={String(detail.lineCount)} />
        <Field
          label="Confidence"
          value={detail.confidence == null ? '—' : `${Math.round(detail.confidence)}%`}
          tone={detail.lowConfidence ? 'warn' : 'plain'}
        />
      </dl>

      <p className="rounded-[10px] bg-[#F7F8FA] px-3.5 py-2.5 text-[12.5px] leading-snug text-[var(--pf-text-secondary)]">
        {detail.reason}
        {detail.uploadedBy ? ` Filed by ${detail.uploadedBy}.` : ''}
      </p>

      {detail.docWatch ? (
        <p className="rounded-[10px] border border-[#E7EFF9] bg-[#F5F9FE] px-3.5 py-2.5 text-[12.5px] leading-snug text-[var(--pf-text)]">
          <span className="font-semibold">Doc Watch — </span>
          {detail.docWatch}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--pf-border-warm)] pt-4">
        {detail.canApprove ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="inline-flex h-[38px] items-center rounded-full bg-[#1F5FA8] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
              style={{ transitionDuration: 'var(--dur-hover)' }}
            >
              {busy ? 'Approving…' : 'Approve'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              className="inline-flex h-[38px] items-center rounded-full border border-[#E2E6EC] bg-white px-4 text-[13px] font-medium text-[#3E4A57] transition-colors hover:border-[#E7C9C9] hover:bg-[#FCF4F4] hover:text-[#A32D2D] disabled:opacity-40"
              style={{ transitionDuration: 'var(--dur-hover)' }}
            >
              Reject
            </button>
          </>
        ) : (
          <p className="text-[12.5px] text-[var(--pf-text-secondary)]">
            Vyso could not read this one, so there is nothing extracted to approve. Open it in Doc-U to
            say what it is.
          </p>
        )}

        <Link
          href={detail.href}
          className="inline-flex h-[38px] items-center rounded-full border border-[#E2E6EC] bg-white px-4 text-[13px] font-medium text-[#3E4A57] transition-colors hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]"
          style={{ transitionDuration: 'var(--dur-hover)' }}
        >
          View in Doc-U →
        </Link>

        {detail.hubdoc ? (
          <SendToHubdoc
            documentId={detail.id}
            alreadySent={detail.hubdoc.alreadySent}
            reason={detail.hubdoc.reason}
          />
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  tone = 'plain',
}: {
  label: string;
  value: string;
  tone?: 'plain' | 'warn';
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--pf-text-faint)]">
        {label}
      </dt>
      <dd
        className={`truncate text-[13.5px] ${
          tone === 'warn' ? 'font-semibold text-[#A8760E]' : 'text-[var(--pf-text)]'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

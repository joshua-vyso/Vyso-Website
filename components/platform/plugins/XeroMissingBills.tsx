'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { xeroMoney } from '@/lib/platform/xero-sync-shared';
import type { XeroMissingBill } from '@/lib/platform/xero-mirror';

/**
 * "Not in Xero yet" — the supplier invoices Doc-U has read that the Xero mirror
 * cannot account for, and the one-click way to put each of them into Hubdoc
 * (plan `.ai/plan_plugins_xero.md`, X2 "Surfaces").
 *
 * THE SAME LIST XERO WATCH'S RULE 2 NAMES, built by the same matcher
 * (`loadNotInXeroBills`). The Brief's card says how many there are and links
 * here; this is where an owner does something about them. Two lists computed two
 * ways would eventually disagree, and a reconciliation screen that disagrees with
 * the agent that sent you to it is worse than no screen.
 *
 * "NOT IN XERO" IS A CLAIM ABOUT WHAT VYSO CAN SEE, and the copy says so. A bill
 * keyed into Xero under a number nobody could match, or entered since last
 * night's sync, appears here and is not missing at all. That is why every row is
 * a link to the document rather than an accusation, and why nothing on this
 * screen changes anything in Xero.
 *
 * EVERY SEND IS A CLICK. There is no "send these for me from now on" here — that
 * is the auto-forward toggle on the Hubdoc card, one section down, off by
 * default and labelled as the standing instruction it is. "Send all" is still one
 * press by one person about one list they are looking at.
 *
 * ALREADY-SENT ROWS SHOW AS SENT AND CANNOT BE RE-SENT FROM HERE. A second copy
 * of a bill in a bookkeeper's inbox is a real cost to somebody, so the deliberate
 * override lives on the document's own page where the person doing it is looking
 * at the document.
 */
export function XeroMissingBills({
  bills,
  sentDocumentIds,
  currency,
  canSend,
  intakeEmailSet,
  mirrorReady,
}: {
  bills: XeroMissingBill[];
  /** Document ids Vyso has already put into Hubdoc. */
  sentDocumentIds: string[];
  /** The mirror's dominant currency — Vyso does no FX. Null on an empty mirror,
   *  which `xeroMoney` reads as rands (the only currency it can name without
   *  being told). */
  currency: string | null;
  canSend: boolean;
  /** An intake address is set. Without one there is nowhere to send. */
  intakeEmailSet: boolean;
  /** The mirror has rows to compare against. Before the first sync EVERY Doc-U
   *  invoice would look missing, and offering to post a filing cabinet into a
   *  bookkeeper's inbox is the worst thing this feature could do. */
  mirrorReady: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const sent = new Set(sentDocumentIds);
  const unsent = bills.filter((b) => !sent.has(b.documentId));

  async function send(documentIds: string[]) {
    setError(null);
    setNote(null);
    try {
      const response = await fetch('/api/integrations/hubdoc/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentIds }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string | null;
        sent?: number;
        skipped?: number;
      };
      if (!response.ok) {
        setError(result.error ?? 'Could not send to Hubdoc.');
        return;
      }
      // Says what happened, per document, because a batch where one failed is
      // the case this message exists for.
      const count = result.sent ?? 0;
      const skipped = result.skipped ?? 0;
      const parts = [
        count > 0 ? `Sent ${count} document${count === 1 ? '' : 's'} to Hubdoc.` : null,
        skipped > 0 ? `${skipped} had already been sent.` : null,
        result.error ? `Some did not go: ${result.error}` : null,
      ].filter(Boolean);
      if (result.error) setError(parts.join(' '));
      else setNote(parts.join(' ') || 'Nothing to send.');
      router.refresh();
    } catch {
      setError('Could not send to Hubdoc.');
    }
  }

  async function sendOne(documentId: string) {
    setBusyId(documentId);
    try {
      await send([documentId]);
    } finally {
      setBusyId(null);
    }
  }

  async function sendAll() {
    setBulkBusy(true);
    try {
      // The route caps a request at 25; sending the first 25 and saying so is
      // more honest than a 400 the owner has to interpret.
      await send(unsent.slice(0, 25).map((b) => b.documentId));
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Not in Xero yet</h2>
          <p className="mt-1 text-[13px] text-[#6B6F68]">
            Supplier invoices Doc-U has read in the last 45 days that Vyso cannot find in Xero.
          </p>
        </div>
        {canSend && intakeEmailSet && unsent.length > 1 ? (
          <button
            type="button"
            disabled={bulkBusy || busyId !== null}
            onClick={() => void sendAll()}
            className="inline-flex h-[38px] shrink-0 items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[16px] text-[13px] font-medium text-[#171A17] transition-colors hover:border-[#C9DEF7] hover:bg-[#FBFCFE] disabled:opacity-40"
          >
            {bulkBusy ? 'Sending…' : `Send all ${Math.min(unsent.length, 25)} to Hubdoc`}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-3 rounded-[12px] border border-[#F3D1D1] bg-[#FFF7F7] p-3 text-[13px] text-[#A32D2D]">
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="mt-3 rounded-[12px] border border-[#E4E9F0] bg-[#F8FAFC] p-3 text-[13px] text-[#6B6F68]">
          {note}
        </p>
      ) : null}

      {!mirrorReady ? (
        <p className="mt-3 rounded-2xl border border-[#EAEDF2] bg-white p-5 text-[13px] text-[#6B6F68] shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          Vyso has not read your Xero ledger yet, so it has nothing to compare your documents
          against. Sync above and this list will fill in.
        </p>
      ) : bills.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-[#EAEDF2] bg-white p-5 text-[13px] text-[#6B6F68] shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          Every supplier invoice Doc-U has read is accounted for in Xero.
        </p>
      ) : (
        <>
          {!intakeEmailSet ? (
            <p className="mt-3 rounded-[12px] border border-[#FBEEDA] bg-[#FFFDF7] p-3 text-[13px] text-[#854F0B]">
              Set your Hubdoc upload address below and you can send these across in one click.
            </p>
          ) : null}
          <ul className="mt-3 divide-y divide-[#EEF1F5] overflow-hidden rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
            {bills.map((bill) => {
              const alreadySent = sent.has(bill.documentId);
              return (
                <li
                  key={bill.documentId}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                >
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/app/docu/${bill.documentId}`}
                      className="text-[13.5px] font-medium text-[#171A17] underline decoration-[#DDE2E9] underline-offset-2 transition-colors hover:text-[#1F5FA8]"
                    >
                      {bill.supplierName}
                    </Link>
                    <span className="mt-0.5 block text-[12.5px] text-[#8A8E86]">
                      {bill.invoiceNumber}
                      {bill.total != null ? ` · ${xeroMoney(bill.total, currency)}` : ''}
                    </span>
                  </span>
                  {alreadySent ? (
                    <span className="shrink-0 rounded-full bg-[#E7F4EA] px-2.5 py-1 text-[12px] font-medium text-[#27733B]">
                      Sent to Hubdoc
                    </span>
                  ) : canSend && intakeEmailSet ? (
                    <button
                      type="button"
                      disabled={bulkBusy || busyId !== null}
                      onClick={() => void sendOne(bill.documentId)}
                      className="inline-flex h-[34px] shrink-0 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-[14px] text-[12.5px] font-medium text-[#171A17] transition-colors hover:border-[#C9DEF7] hover:bg-[#FBFCFE] disabled:opacity-40"
                    >
                      {busyId === bill.documentId ? 'Sending…' : 'Send to Hubdoc'}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

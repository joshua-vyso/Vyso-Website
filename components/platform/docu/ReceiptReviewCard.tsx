'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { ConfidenceText } from '@/components/platform/ui';
import { EXPENSE_CATEGORIES } from '@/lib/platform/docu/expense-categories';
import { financialSeparatorHint, reconcileFinancialDocument } from '@/lib/platform/docu/financial-document';
import { fmtZar } from '@/lib/platform/docu/reconciliation';
import type { DocuExtractedData } from '@/lib/platform/docu/types';
import type { ExtractedLineItem } from '@/lib/platform/types';

/**
 * The expense-receipt review screen — the third arm of the detail panel, beside
 * the order editor and the generic extraction editor.
 *
 * WHAT THIS SCREEN IS FOR. A reviewer looking at a restaurant slip has exactly
 * three questions, and the whole card is built around answering them before they
 * are asked:
 *
 *   1. **Does it add up?** The lines, the gratuity, the settlement and the
 *      balance movement, each checked against the paper's own figures — and each
 *      SKIPPED where the paper printed only one side of the sum, so a clean
 *      receipt shows no warnings rather than four dashes.
 *   2. **What does approving it do?** "Operational impact: None." Approving an
 *      invoice moves stock; approving this does not, and the reviewer should not
 *      have to know about `runDocumentSideEffects` to be sure of that.
 *   3. **What is it, for the books?** One category, suggested and changeable.
 *
 * AND ONE THING IT DELIBERATELY DOES NOT SAY. There is no line anywhere on this
 * card asserting that money left a bank account. When the slip's balances
 * reconcile it says the member balance was drawn down, which is what the paper
 * is evidence of; otherwise it says nothing about cash at all. See `CashEffect`
 * in lib/platform/types.ts for why a card receipt is not an exception to that.
 *
 * The red/amber conventions and the both-figures-survive rule are the order
 * editor's, on purpose: a reviewer who has learnt what a red row means on one
 * Doc-U screen should not have to learn it again on another.
 */
export function ReceiptReviewCard({
  documentId,
  extractedData,
  confidence,
  supplierName,
}: {
  documentId: string;
  extractedData: DocuExtractedData | null;
  /** The document's own extraction confidence. Rendered through the shared
   *  `ConfidenceText`, which draws null as "—" — this card neither invents a
   *  number for a read that stated none nor rewrites one on confirm. */
  confidence: number | null;
  /** The merchant as filed, for the header when the receipt block has none. */
  supplierName: string | null;
}) {
  const router = useRouter();
  const fin = extractedData?.financial_document ?? null;
  const lines = useMemo<ExtractedLineItem[]>(() => extractedData?.line_items ?? [], [extractedData]);

  const [category, setCategory] = useState<string>(fin?.expense_category ?? '');
  const [fundingAccount, setFundingAccount] = useState<string>(fin?.funding_account ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // ONE reading of this receipt's number format, formed from its header figures
  // and its rows together and handed to the reconciliation — the same shared-hint
  // discipline every other money screen in Doc-U follows, so a comma-decimal slip
  // cannot read one way here and another way in the stamp.
  const recon = useMemo(() => {
    const hint = financialSeparatorHint(fin, lines);
    return reconcileFinancialDocument(fin, lines, hint);
  }, [fin, lines]);

  if (!fin) {
    return (
      <div className="rounded-2xl border border-[#EAEDF2] bg-white p-6 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
        <h2 className="of-display text-[16px] font-semibold text-[#171A17]">Expense receipt</h2>
        <p className="mt-2 text-[13px] text-[#6B6F68]">
          No receipt figures were read from this document. It is filed as an expense receipt and has no
          operational effect; open the original to check it by eye.
        </p>
      </div>
    );
  }

  const failing = recon?.checks.filter((c) => !c.ok) ?? [];
  // A VAT bigger than the total it is supposedly inside is not a rounding
  // disagreement — it means the two figures are not what the card thinks they
  // are, so it is called out separately from the equality checks.
  const taxSuspect = recon?.taxWithinTotal === false;

  /** Persist the reviewer's two editable fields back into the same jsonb block.
   *  Only these two keys move: every transcribed figure stays exactly as read,
   *  because a review screen that quietly rewrites what the paper said destroys
   *  the only independent record of it. */
  async function saveEdits() {
    if (busy || !fin) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    if (!supabase) {
      setError('Could not reach the database.');
      setBusy(false);
      return;
    }
    const next: DocuExtractedData = {
      ...(extractedData ?? { fields: [] }),
      financial_document: {
        ...fin,
        expense_category: category || null,
        funding_account: fundingAccount,
      },
    };
    const { error: updErr } = await supabase
      .from('documents')
      .update({ extracted_data: next })
      .eq('id', documentId);
    setBusy(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    router.refresh();
  }

  /** Confirm = the ordinary review commit. It runs the SAME route every other
   *  document type uses, which is the point: there is no separate approval path
   *  for receipts to drift out of step with. The commit's side effects are
   *  refused at the gate rather than avoided here — the button is honest
   *  because the pipeline is, not because this screen took a shortcut. */
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    await saveEdits();
    const res = await fetch('/api/docu/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: documentId, action: 'save' }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? 'Something went wrong.');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  const merchant = fin.merchant || supplierName || 'Expense receipt';
  const cur = fin.currency ? `${fin.currency} ` : '';

  return (
    <div className="rounded-2xl border border-[#EAEDF2] bg-white shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
      {/* Header — who, when, and what kind of document this is */}
      <div className="border-b border-[#EEF1F5] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="of-display truncate text-[16px] font-semibold text-[#171A17]">{merchant}</h2>
            <p className="mt-0.5 text-[12px] text-[#A0A49C]">
              {fin.receipt_datetime || '—'}
              {fin.receipt_reference ? ` · ${fin.receipt_reference}` : ''}
              {fin.member_or_account ? ` · ${fin.member_or_account}` : ''}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[#EDF0E9] px-2.5 py-1 text-[11px] font-medium text-[#4A6136]">
            Expense receipt
          </span>
        </div>
        <p className="mt-2 text-[12px] text-[#6B6F68]">
          <ConfidenceText value={confidence} /> confidence
        </p>
      </div>

      {/* The money, in the order the slip prints it */}
      <div className="px-6 py-5">
        <dl className="divide-y divide-[#EEF1F5]">
          {lines.map((it, i) => (
            <div key={`${it.description}-${i}`} className="flex items-center justify-between gap-3 py-2 text-[13px]">
              <dt className="min-w-0 truncate text-[#6B6F68]">
                {[it.quantity, it.description].filter(Boolean).join(' × ') || it.description || '—'}
              </dt>
              <dd className="of-num shrink-0 text-[#171A17]">{it.amount ? `${cur}${it.amount}` : '—'}</dd>
            </div>
          ))}
          {fin.subtotal ? (
            <div className="flex items-center justify-between py-2 text-[13px]">
              <dt className="text-[#6B6F68]">Subtotal</dt>
              <dd className="of-num text-[#171A17]">{`${cur}${fin.subtotal}`}</dd>
            </div>
          ) : null}
          {/* SERVICE, NOT TAX. Its own row, its own word, nowhere near the VAT
              line — a gratuity folded into a tax figure is input VAT claimed on
              money that never carried any. */}
          {fin.gratuity ? (
            <div className="flex items-center justify-between py-2 text-[13px]">
              <dt className="text-[#6B6F68]">Gratuity (service)</dt>
              <dd className="of-num text-[#171A17]">{`${cur}${fin.gratuity}`}</dd>
            </div>
          ) : null}
          {fin.total ? (
            <div className="flex items-center justify-between py-2.5 text-[14px]">
              <dt className="font-medium text-[#171A17]">Expense total</dt>
              <dd className="of-num text-[16px] font-semibold text-[#171A17]">{`${cur}${fin.total}`}</dd>
            </div>
          ) : null}
        </dl>

        {/* VAT — stated as INCLUDED, in those words, every time. The sentence is
            the safeguard: "VAT R76.06" beside a R643.10 total is ambiguous, and
            the reading that adds it produces a R719.16 expense out of nothing. */}
        {recon?.taxIncluded != null ? (
          <p className={`mt-3 text-[12.5px] ${taxSuspect ? 'font-medium text-[#A32D2D]' : 'text-[#6B6F68]'}`}>
            VAT included {fmtZar(recon.taxIncluded)}
            {taxSuspect ? ' — larger than the total it should be part of. Check the slip.' : ''}
          </p>
        ) : null}

        {/* How it was settled, and — only when the paper proves it — the balance
            it was settled against. */}
        {fin.payment_method || fin.funding_account ? (
          <p className="mt-1.5 text-[12.5px] text-[#6B6F68]">
            Paid via {fin.funding_account || fin.payment_method}
            {fin.funding_account && fin.payment_method ? ` (${fin.payment_method})` : ''}
          </p>
        ) : null}
        {recon?.balance ? (
          <p className="mt-1.5 text-[12.5px] text-[#6B6F68]">
            Balance <span className="of-num">{fmtZar(recon.balance.opening)}</span> →{' '}
            <span className="of-num">{fmtZar(recon.balance.closing)}</span>
            {recon.cashEffect === 'prefund_drawdown'
              ? ' · drawn from a pre-funded balance, so no bank movement is recorded today'
              : ''}
          </p>
        ) : null}

        {/* WHAT APPROVING THIS DOES. Said plainly, on the screen where the
            decision is made — not left to be inferred from the absence of a
            "Push to…" menu. */}
        <p className="mt-3 rounded-[14px] bg-[#F5F9FE] px-3.5 py-2.5 text-[12.5px] text-[#3E4A57]">
          Operational impact: None · Financial impact: Expense recognised
        </p>

        {/* Reconciliation — the same both-figures-survive presentation the order
            editor uses, and drawn only when a check could actually be asked. */}
        {recon && recon.checks.length > 0 ? (
          <div className="mt-4 border-t border-[#EEF1F5] pt-3">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
              Printed on the receipt
            </p>
            {recon.checks.map((c) => (
              <div key={c.label} className="flex items-center justify-between py-0.5 text-[12.5px]">
                <span className={c.ok ? 'text-[#6B6F68]' : 'font-medium text-[#A32D2D]'}>{c.label}</span>
                <span className="flex items-baseline gap-2">
                  <span className="of-num text-[#8A8E86]">{fmtZar(c.expected)}</span>
                  <span className="text-[#D3D6D0]">vs</span>
                  <span className={`of-num font-semibold ${c.ok ? 'text-[#171A17]' : 'text-[#A32D2D]'}`}>
                    {fmtZar(c.actual)}
                  </span>
                </span>
              </div>
            ))}
            {failing.length > 0 ? (
              <p className="mt-1 text-[11.5px] leading-[1.5] text-[#A32D2D]">
                {failing.map((c) => c.label.toLowerCase()).join(' and ')}{' '}
                {failing.length === 1 ? 'does' : 'do'} not match the receipt&rsquo;s own figure — an item may have
                been misread, or missed entirely. Check it against the slip.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* The reviewer's two editable fields. Neither is remembered, learnt from
            or applied to the next receipt — see expense-categories.ts. */}
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#EEF1F5] pt-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
              Category
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 w-full rounded-[10px] border border-[#E4E9F0] bg-white px-2.5 text-[13px] text-[#171A17] outline-none focus:border-[#3E7BC4]"
            >
              {/* Blank stays a real option: "not categorised yet" is a state a
                  reviewer is allowed to leave a receipt in, and forcing a pick
                  would make "Other" mean "somebody was in a hurry". */}
              <option value="">Not set</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.06em] text-[#A0A49C]">
              Funding account
            </span>
            <input
              type="text"
              value={fundingAccount}
              onChange={(e) => setFundingAccount(e.target.value)}
              placeholder="e.g. Member pre-fund"
              className="h-9 w-full rounded-[10px] border border-[#E4E9F0] bg-white px-2.5 text-[13px] text-[#171A17] outline-none placeholder:text-[#A0A49C] focus:border-[#3E7BC4]"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 rounded-b-2xl border-t border-[#EEF1F5] bg-white px-6 py-4">
        {error ? <span className="mr-auto text-[12.5px] text-[#A32D2D]">{error}</span> : null}
        {saved ? (
          <span className="mr-auto flex items-center gap-2 text-[13px] font-medium text-[#0F6E56]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0F6E56]" />
            Expense recorded
          </span>
        ) : null}
        <button
          type="button"
          onClick={saveEdits}
          disabled={busy}
          className="inline-flex h-[38px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-4 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-40"
        >
          Save changes
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy || saved}
          className="inline-flex h-[38px] items-center rounded-[11px] bg-[#1F5FA8] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87] disabled:opacity-40"
        >
          Confirm expense
        </button>
      </div>
    </div>
  );
}

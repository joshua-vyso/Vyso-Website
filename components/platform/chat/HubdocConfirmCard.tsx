'use client';

import { useState } from 'react';
import { hubdocSentMessage } from '@/lib/platform/hubdoc-shared';
import { useFinchChat, type HubdocConfirmDockCard } from '@/components/platform/shell/FinchChatProvider';

/**
 * "Send this statement to Hubdoc" — the confirmation (Plugins X2 — chat
 * hand-off).
 *
 * WHY THIS CARD EXISTS. Finch could always read a document and never file one,
 * so asking it to push a statement to Hubdoc got an apology. It can now PREPARE
 * the hand-off (`hubdoc_prepare_send`), and this is the other half: the list it
 * resolved, the address it would go to, and a button. The model decided which
 * documents; a person decides whether anything leaves.
 *
 * IT POSTS TO THE EXISTING ROUTE. `POST /api/integrations/hubdoc/send` with the
 * eligible ids — the same endpoint the document page's button and the plugin
 * page's "Send all" use, so the role check, the rate limit, the per-document
 * eligibility re-check, the 25-per-request cap and the `hubdoc_forwards` log all
 * apply unchanged. There is no chat-specific send path, on purpose: a second one
 * would be a second place those gates have to be right.
 *
 * WHY A CONFIRM HERE AND NOT ON THE DOCUMENT PAGE. The document page's button
 * sits under the document itself — the owner is looking at what they are
 * sending. In a conversation they are looking at a SENTENCE, and the model chose
 * the documents behind it, so the card has to show its work: every document it
 * resolved, ticked or greyed with the reason, and enough of the destination
 * address to recognise it.
 *
 * INELIGIBLE ROWS ARE SHOWN, NOT HIDDEN — see `hubdocPrepareDocuments`. If the
 * owner said "send these" and one cannot go, the card is where they find that
 * out, not the silence afterwards.
 */
export function HubdocConfirmCard({
  card,
  onDismiss,
}: {
  card: HubdocConfirmDockCard;
  onDismiss: () => void;
}) {
  const { appendAssistantLine } = useFinchChat();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Per-document outcome after a send, keyed by document id. Replaces the tick
   *  with what actually happened — a partial batch is reported as partial. */
  const [results, setResults] = useState<Record<string, string> | null>(null);

  const eligible = card.documents.filter((d) => d.eligible);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/integrations/hubdoc/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: eligible.map((d) => d.id) }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string | null;
        results?: { documentId?: string; ok?: boolean; alreadySent?: boolean; error?: string }[];
      };
      if (!response.ok) {
        setError(data.error ?? `The send failed (${response.status}).`);
        return;
      }

      const outcome: Record<string, string> = {};
      const sentNames: string[] = [];
      for (const result of data.results ?? []) {
        const id = typeof result.documentId === 'string' ? result.documentId : '';
        if (!id) continue;
        const doc = card.documents.find((d) => d.id === id);
        if (result.ok && result.alreadySent) outcome[id] = 'Already in Hubdoc';
        else if (result.ok) {
          outcome[id] = 'Sent';
          if (doc) sentNames.push(doc.filename);
        } else outcome[id] = result.error ?? 'Failed';
      }
      setResults(outcome);
      // The transcript keeps one line saying what the button did. Written here,
      // not by a model: it is a fact, and it must not cost a turn.
      if (sentNames.length) appendAssistantLine(hubdocSentMessage(sentNames));
      if (data.error) setError(data.error);
    } catch {
      setError('Vyso could not reach the send service. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#BBD9F5] bg-[#F2F8FE] p-3.5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#12324F]">
        <span className="finch-gradient flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 6h16v12H4zM4 7l8 6 8-6"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="of-display">Send to Hubdoc</span>
      </div>

      <div className="mt-1.5 text-[12px] text-[#12324F]">
        {results ? 'Sent to' : 'These will be emailed to'}{' '}
        <span className="font-medium">{card.intakeEmailMasked || 'your Hubdoc inbox'}</span>.
      </div>

      <div className="mt-2 overflow-hidden rounded-lg border border-[#D5E6F7] bg-white">
        {card.documents.map((doc) => {
          const outcome = results?.[doc.id];
          return (
            <div
              key={doc.id}
              className={`border-b border-[#EEF4FB] px-3 py-2 text-[12px] last:border-0 ${
                doc.eligible ? 'text-[#171A17]' : 'text-[#8A8F88]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span aria-hidden className={doc.eligible ? 'text-[#1F5FA8]' : 'text-[#B4B8B2]'}>
                    {doc.eligible ? '✓' : '—'}
                  </span>
                  <span className="truncate">{doc.filename}</span>
                </span>
                <span className="of-num shrink-0 text-[11px] text-[#6B6F68]">
                  {outcome ?? [doc.supplier, doc.number].filter(Boolean).join(' · ')}
                </span>
              </div>
              {doc.reason ? <p className="mt-0.5 text-[11px] leading-[1.45]">{doc.reason}</p> : null}
            </div>
          );
        })}
      </div>

      {error ? <p className="mt-2 text-[12px] text-[#A32D2D]">{error}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {results ? (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-[#E2E6EC] bg-white px-3 py-1.5 text-[12px] font-medium text-[#171A17] transition-colors hover:bg-[#F7FAFD] motion-reduce:transition-none"
          >
            Close
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || eligible.length === 0}
              className="finch-gradient rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Sending…' : `Send to Hubdoc (${eligible.length})`}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              disabled={busy}
              className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#6B6F68] transition-colors hover:bg-[#E4EFFA] disabled:opacity-50 motion-reduce:transition-none"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The Hubdoc cards the conversation is currently holding.
 *
 * WHY A SECOND ENTRY POINT beside `DockCards`. The bubble draws every card kind
 * (chat/OrderCards.tsx); the CHAT PAGE draws none of them, because the two kinds
 * that existed before this wave can only arise on an OrderFlow screen, where the
 * bubble is the surface. A Hubdoc hand-off is asked for wherever the owner is —
 * `/app/chat/[id]` most of all, since that is the Brief agent's own screen — so
 * that page needs this one kind and only this one.
 */
export function HubdocCards({ live = true }: { live?: boolean }) {
  const { cards, dismissCard } = useFinchChat();
  const hubdocCards = live ? cards.filter((c): c is HubdocConfirmDockCard => c.kind === 'hubdoc_confirm') : [];
  if (hubdocCards.length === 0) return null;
  return (
    <div className="mt-5 flex flex-col gap-3">
      {hubdocCards.map((card) => (
        <HubdocConfirmCard key={card.id} card={card} onDismiss={() => dismissCard(card.id)} />
      ))}
    </div>
  );
}

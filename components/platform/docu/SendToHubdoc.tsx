'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * "Send to Hubdoc" on a document's own page (plan `.ai/plan_plugins_xero.md`, X2
 * "Surfaces").
 *
 * IT ONLY RENDERS WHEN IT WOULD WORK. The page decides — owner or admin, Xero
 * connected, an intake address set, and this document eligible — and passes the
 * verdict in. A greyed-out control on a document detail page invites the click
 * that proves it does nothing, and there is already a card on Plugins → Xero
 * whose whole job is explaining how to set Hubdoc up. The one exception is
 * `reason`: when the org is set up but THIS document cannot go, the sentence
 * saying why is worth more than the button.
 *
 * SENDING TWICE IS DELIBERATE HERE AND NOWHERE ELSE. Once a document has gone,
 * the button becomes "Sent to Hubdoc" and a quiet "Send again" appears beside it.
 * That override lives on this page, in front of the document itself, rather than
 * on the bulk list — a person choosing to put a second copy of a bill into their
 * bookkeeper's inbox should be looking at the bill while they choose. It posts
 * `resend: true`, which logs its own row and shows in the plugin page's log as
 * "Sent again".
 *
 * NO CONFIRM DIALOG on the first send. It is one document, to an address the
 * owner configured, recorded in a log — the cost of a mistaken press is a
 * bookkeeper deleting an email, and a modal on every filing action is how people
 * learn to click through modals.
 */
/**
 * What the document page resolves and the panel passes down. Declared here
 * rather than in `app/app/docu/[id]/page.tsx` because a Next route file may only
 * export the handful of names the framework knows about — a stray `export
 * interface` there is a build error, not a shared type.
 */
export interface HubdocDocumentState {
  /** Vyso has already put this document into Hubdoc. */
  alreadySent: boolean;
  /** Why THIS document cannot be sent, or null when it can. Only ever non-null
   *  when the org itself is set up — otherwise the control is absent entirely. */
  reason: string | null;
}

export function SendToHubdoc({
  documentId,
  alreadySent,
  reason,
}: HubdocDocumentState & { documentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function send(resend: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/integrations/hubdoc/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ documentId, resend }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string | null };
      if (!response.ok || result.error) {
        setError(result.error ?? 'Could not send to Hubdoc.');
        return;
      }
      setDone(true);
      // The house mutation shape: write, then reconcile with server truth. The
      // page re-reads the forwards log and this component comes back with
      // `alreadySent`.
      router.refresh();
    } catch {
      setError('Could not send to Hubdoc.');
    } finally {
      setBusy(false);
    }
  }

  if (reason) {
    return <span className="text-[12.5px] text-[#8A8E86]">{reason}</span>;
  }

  const sent = alreadySent || done;

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {sent ? (
        <>
          <span className="inline-flex h-[38px] items-center rounded-full bg-[#E7F4EA] px-4 text-[13px] font-medium text-[#27733B]">
            Sent to Hubdoc
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(true)}
            className="text-[12.5px] font-medium text-[#8A8E86] underline decoration-[#DDE2E9] underline-offset-2 transition-colors hover:text-[#1F5FA8] disabled:opacity-40"
          >
            {busy ? 'Sending…' : 'Send again'}
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => void send(false)}
          className="inline-flex h-[38px] items-center gap-1 rounded-full border border-[#E2E6EC] bg-white px-4 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:opacity-40"
        >
          {busy ? 'Sending…' : 'Send to Hubdoc'}
        </button>
      )}
      {error ? <span className="text-[12.5px] text-[#A32D2D]">{error}</span> : null}
    </span>
  );
}

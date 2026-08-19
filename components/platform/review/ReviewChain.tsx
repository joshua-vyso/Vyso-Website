'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useFinchChat } from '@/components/platform/shell/FinchChatProvider';
import type { ReviewItemDetail } from '@/lib/platform/review-actions';
import {
  approveAllLabel,
  approveConfirmMessage,
  mergeApprovalResults,
  parseReviewItemKey,
  reviewItemKey,
  selectApprovable,
  type ReviewApprovalResult,
  type ReviewItemRef,
  type ReviewScope,
} from '@/lib/platform/review-actions-shared';
import {
  REVIEW_OVERFLOW_HREF,
  groupReviewQueue,
  reviewHeading,
  type ReviewItem,
} from '@/lib/platform/review-queue-shared';
import { ApproveAllButton } from './ApproveAllButton';
import { ReviewGroup } from './ReviewGroup';
import { ReviewPane, type PaneState } from './ReviewPane';

/**
 * The Review chain and the pane beside it (`.ai/plan_review_v2.md`).
 *
 * Josh's ask, verbatim: "review chain needs automatic approvals. grouped by
 * module, then subgrouped by task… batch approve button for each task, on each
 * module and a master 'approve all' at the top. clicking an item expands that
 * block in place (not a new page)… review chain centred on open, moves left and
 * the expanded view appears on the right; close returns it to centre in a fluid
 * animation".
 *
 * ONE COMPONENT OWNS ALL OF IT, and that is the load-bearing decision here. The
 * open item, the fetched detail, the optimistic removals, the per-row errors and
 * the batch that is in flight are five facts that must agree with each other on
 * every frame — a row cannot vanish while its pane is still offering to approve
 * it, and a second batch cannot start against a list the first is still
 * shortening. Splitting them across the chain and the pane would mean keeping
 * two copies in step through a fetch. So the children below are drawing only.
 *
 * THE MOTION IS CSS, NOT JAVASCRIPT. This component toggles one attribute
 * (`data-open` on the pane's track) and `app/globals.css` does the rest: the
 * track's flex-basis grows from zero and re-centring the flex row carries the
 * chain left. There is no measured width, no resize listener and no transform on
 * the chain itself — see the `.review-split` block for the whole trick, and for
 * why reduced motion keeps the layout and drops only the interpolation.
 *
 * THE URL IS MIRRORED WITH `history.replaceState`, NOT `router.replace`. `?item=`
 * exists so a reload and a pasted link land on the same open pane; it is not a
 * navigation. Pushing it through the router would re-run this page's server
 * component — two Supabase reads and a re-render of the whole chain — on every
 * expand and collapse, to change a string the server does not read. The INITIAL
 * value still comes from the server (`initialItemKey`), so the deep link works
 * on a cold load; only the toggling is local.
 *
 * ZERO MODEL CALLS. Nothing in this component or anything it renders talks to
 * Anthropic. It tells the conversation underneath which item is open
 * (`setReviewFocus`) and stops there.
 */

/**
 * The viewport below which the split stops being a split.
 *
 * 1100, not Tailwind's `lg` (1024), and the number comes off a measurement
 * rather than a preference. The chain needs 360px to keep its own header on one
 * line and the pane needs 380 to be worth opening; with the rail's
 * `--pf-sidebar-w` (216) and the page's 40px gutters, 1024 leaves 688px for a
 * pair that wants 764. Josh's client — a 1366px monitor at 125% Windows scaling,
 * so ~1093 CSS px — landed inside exactly that gap, which is how a chain ended
 * up rendering one word per line.
 *
 * It is duplicated as a media query in `app/globals.css` (`.review-split`), and
 * the two must agree: this decides which pane is MOUNTED, the CSS decides where
 * it sits. There is no shared source because a Tailwind v4 theme breakpoint
 * cannot be read from JS without shipping the config to the browser.
 */
const REVIEW_SPLIT_MIN = 1100;
export function ReviewChain({
  items: initialItems,
  total,
  truncated,
  initialItemKey,
  children,
}: {
  items: ReviewItem[];
  /** The count BEFORE the card's cap — what the rail's dot draws. */
  total: number;
  truncated: boolean;
  /** `?item=` as the server read it, or null. */
  initialItemKey: string | null;
  /** The Finch conversation, rendered by the server page and slotted beneath the
   *  chain so it travels with it when the pane opens. */
  children: ReactNode;
}) {
  const router = useRouter();
  const { setReviewFocus } = useFinchChat();

  /* ── The deep link, resolved at mount ────────────────────────────────────
   * `?item=` is a fact about the FIRST render, so it is a lazy initial state
   * rather than an effect. Doing it in an effect would mean rendering the
   * centred chain, then immediately re-rendering it open — a visible flash on
   * exactly the load that was supposed to arrive already open — and React's own
   * lint rule says so (`react-hooks/set-state-in-effect`).
   *
   * An `?item=` pointing at something that has already left the queue resolves
   * to "closed, with a notice", which is the plan's §3 behaviour. */
  const linked = (() => {
    const ref = parseReviewItemKey(initialItemKey);
    if (!ref) return { key: null, gone: false };
    const key = reviewItemKey(ref);
    return { key, gone: !initialItems.some((i) => reviewItemKey(i) === key) };
  })();

  const [items, setItems] = useState<ReviewItem[]>(initialItems);
  const [openKey, setOpenKey] = useState<string | null>(linked.gone ? null : linked.key);
  const [paneState, setPaneState] = useState<PaneState>({ phase: 'loading' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busyScope, setBusyScope] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    linked.gone ? 'That one has already been handled.' : null,
  );
  /** The last `items` array the server sent, so a re-render can tell a NEW one
   *  from the same one. See the adopt-during-render block below. */
  const [adopted, setAdopted] = useState<ReviewItem[]>(initialItems);
  /** Null until the first client frame: the pane is a right-hand column above
   *  `REVIEW_SPLIT_MIN` and an overlay drawer below it, and rendering BOTH would
   *  load the document preview twice — two signed-URL iframes for one document. */
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  /* ── Server truth wins ───────────────────────────────────────────────────
   * After every write this component calls `router.refresh()`, which re-runs the
   * page's queue read and hands a new `items` array down. Adopting it is what
   * makes the optimistic removal a PREVIEW of the refresh rather than a
   * competing opinion: if a row we removed is still in the queue (an approval
   * that reported success but left the document behind), it comes back, which is
   * the truthful outcome.
   *
   * DURING RENDER, NOT IN AN EFFECT. This is React's own documented shape for
   * "state that resets when a prop changes" — the re-render happens before the
   * browser paints, so the owner never sees the stale list. An effect would
   * paint the old rows first and is what `react-hooks/set-state-in-effect`
   * exists to catch. */
  if (adopted !== initialItems) {
    setAdopted(initialItems);
    setItems(initialItems);
  }

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${REVIEW_SPLIT_MIN}px)`);
    const apply = () => setIsDesktop(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  const groups = useMemo(() => groupReviewQueue(items), [items]);
  const approvableAll = useMemo(() => selectApprovable(groups, { scope: 'all' }), [groups]);
  const openItem = useMemo(
    () => items.find((i) => reviewItemKey(i) === openKey) ?? null,
    [items, openKey],
  );

  /* ── Opening and closing ─────────────────────────────────────────────── */

  const mirrorUrl = useCallback((key: string | null) => {
    const url = new URL(window.location.href);
    if (key) url.searchParams.set('item', key);
    else url.searchParams.delete('item');
    window.history.replaceState(window.history.state, '', url);
  }, []);

  const close = useCallback(() => {
    setOpenKey(null);
    setPaneState({ phase: 'loading' });
    mirrorUrl(null);
    setReviewFocus(null);
  }, [mirrorUrl, setReviewFocus]);

  const open = useCallback(
    (key: string) => {
      if (key === openKey) {
        close();
        return;
      }
      setOpenKey(key);
      setPaneState({ phase: 'loading' });
      mirrorUrl(key);
    },
    [close, mirrorUrl, openKey],
  );

  // Tell the conversation underneath what is on screen. Framed as a fact about
  // the item, in the queue's own words — the prelude that carries it says
  // outright that it is data, not instruction.
  useEffect(() => {
    setReviewFocus(openItem ? `[${openItem.kind}] ${openItem.title} — ${openItem.detail}` : null);
  }, [openItem, setReviewFocus]);

  // The provider outlives this page. Without this, walking away from Review
  // leaves the last expanded invoice named in every later conversation.
  useEffect(() => () => setReviewFocus(null), [setReviewFocus]);

  /* ── The detail fetch ────────────────────────────────────────────────── */

  useEffect(() => {
    if (!openKey) return;
    const ref = parseReviewItemKey(openKey);
    if (!ref) return;

    // No `setPaneState('loading')` here: `open()` already set it before the key
    // changed, and the deep-link path starts in that state. Setting it again
    // inside the effect would be a synchronous cascading render for no visible
    // difference.
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(
          `/api/review/item?kind=${encodeURIComponent(ref.kind)}&id=${encodeURIComponent(ref.id)}`,
          { signal: controller.signal },
        );
        const body = (await response.json().catch(() => ({}))) as {
          detail?: unknown;
          error?: string;
        };
        if (controller.signal.aborted) return;
        // 404 is not an error the owner needs to read as one: the item was
        // approved in another tab, or the link is old.
        if (response.status === 404) return setPaneState({ phase: 'gone' });
        if (!response.ok || !body.detail) {
          return setPaneState({ phase: 'error', message: body.error ?? 'Could not open that one.' });
        }
        setPaneState({ phase: 'ready', detail: body.detail as ReviewItemDetail });
      } catch {
        if (!controller.signal.aborted) {
          setPaneState({ phase: 'error', message: 'Could not open that one.' });
        }
      }
    })();

    return () => controller.abort();
  }, [openKey]);

  /** Re-read the open item without closing the pane. Used after "Add as new
   *  customer", so the button flips to "already a customer" from server truth
   *  rather than from an assumption about what the write did. */
  const reloadDetail = useCallback(() => {
    if (!openKey) return;
    const ref = parseReviewItemKey(openKey);
    if (!ref) return;
    void (async () => {
      const response = await fetch(
        `/api/review/item?kind=${encodeURIComponent(ref.kind)}&id=${encodeURIComponent(ref.id)}`,
      );
      const body = (await response.json().catch(() => ({}))) as { detail?: unknown };
      if (response.ok && body.detail) {
        setPaneState({ phase: 'ready', detail: body.detail as ReviewItemDetail });
      }
    })();
  }, [openKey]);

  /* ── Writes ──────────────────────────────────────────────────────────── */

  /**
   * Run one batch and fold the answer back in.
   *
   * ONE BATCH AT A TIME (`busyScope`): a second started over a running one would
   * be selecting from a list the first is about to shorten, so the buttons
   * disable rather than queue. When the item currently expanded is among the
   * approved, the pane says "Done" and closes itself after 600ms — long enough
   * to be read, short enough not to be waited on (plan §3).
   */
  const runApprove = useCallback(
    async (refs: ReviewItemRef[], scope: string) => {
      if (refs.length === 0 || busyScope) return;
      setBusyScope(scope);
      setErrors({});

      /* ── The optimistic half (v2.1) ────────────────────────────────────────
       * The rows go NOW, before the request is even sent, and the pane closes
       * with them. Josh, watching a client approve seventeen invoices: the click
       * has to come back at once. The route no longer waits for a document's
       * side effects either (see `/api/review/approve`), so the round-trip
       * behind this is two status writes per item — but the removal is still
       * done first, because "the list shortened" is what the press is for.
       *
       * `snapshot` is what makes it a preview rather than a lie: every failure
       * path below puts the rows back exactly as they were, and the
       * `router.refresh()` at the end lets server truth overwrite both. */
      const snapshot = items;
      const sending = new Set(refs.map(reviewItemKey));
      setItems((prev) => prev.filter((i) => !sending.has(reviewItemKey(i))));
      setNotice(
        refs.length === 1
          ? 'Approving in the background.'
          : `Approving ${refs.length} in the background.`,
      );
      if (openKey && sending.has(openKey)) {
        setPaneState({ phase: 'done' });
        window.setTimeout(close, 600);
      }

      let results: ReviewApprovalResult[] = [];
      try {
        const response = await fetch('/api/review/approve', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ items: refs }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          results?: ReviewApprovalResult[];
          error?: string;
        };
        if (!response.ok) {
          setItems(snapshot);
          setNotice(body.error ?? 'Could not approve those.');
          setBusyScope(null);
          return;
        }
        results = body.results ?? [];
      } catch {
        setItems(snapshot);
        setNotice('Could not reach the server. Nothing was approved.');
        setBusyScope(null);
        return;
      }

      // Reconcile against the SNAPSHOT, not against the list we have just
      // shortened: a row the server refused has to come back, and it can only
      // come back from the copy that still has it.
      const merged = mergeApprovalResults(snapshot, results);
      setItems(merged.items);
      setErrors(merged.errors);

      const failures = results.filter((r) => !r.ok).length;
      const approved = results.length - failures;
      if (failures > 0) {
        setNotice(
          approved > 0
            ? `Approved ${approved}. ${failures} could not be approved — see the rows below.`
            : 'None of those could be approved — see the rows below.',
        );
      } else {
        // Clean success: the "approving in the background" line has done its job
        // and the shortened list says the rest. A status message that never
        // leaves becomes furniture, and the next batch would have to fight it.
        window.setTimeout(
          () => setNotice((n) => (n && n.startsWith('Approving') ? null : n)),
          4000,
        );
      }

      setBusyScope(null);
      router.refresh();
    },
    [busyScope, close, items, openKey, router],
  );

  const approveScope = useCallback(
    (target: ReviewScope, scopeId: string) => void runApprove(selectApprovable(groups, target), scopeId),
    [groups, runApprove],
  );

  /** One quote-request write — "Add as new customer" or Dismiss. Both go to
   *  `/api/review/customer`, and both are OrderFlow's own writes; neither is an
   *  approval, which is why neither touches `runApprove`. */
  const runQuoteAction = useCallback(
    async (requestId: string, action: 'customer' | 'dismiss') => {
      if (busyScope) return;
      setBusyScope(`item:${openKey ?? requestId}`);
      setNotice(null);
      try {
        const response = await fetch('/api/review/customer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(action === 'dismiss' ? { requestId, action: 'dismiss' } : { requestId }),
        });
        const body = (await response.json().catch(() => ({}))) as {
          error?: string;
          customer?: { name: string; existing: boolean };
        };
        if (!response.ok) {
          setNotice(body.error ?? 'Could not do that.');
          return;
        }

        if (action === 'dismiss') {
          setItems((prev) => prev.filter((i) => reviewItemKey(i) !== `quote_request:${requestId}`));
          setPaneState({ phase: 'done' });
          window.setTimeout(close, 600);
        } else {
          setNotice(
            body.customer?.existing
              ? `${body.customer.name} was already a customer.`
              : `Added ${body.customer?.name ?? 'the customer'} to OrderFlow.`,
          );
          reloadDetail();
        }
      } catch {
        setNotice('Could not reach the server.');
      } finally {
        setBusyScope(null);
        router.refresh();
      }
    },
    [busyScope, close, openKey, reloadDetail, router],
  );

  /** Doc-U's Discard, for the one document in the pane. Never batched. */
  const rejectOpenDocument = useCallback(
    async (documentId: string) => {
      if (busyScope) return;
      setBusyScope(`item:${openKey ?? documentId}`);
      setNotice(null);
      try {
        const response = await fetch('/api/review/approve', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'reject', item: { kind: 'document', id: documentId } }),
        });
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        if (!response.ok) {
          setNotice(body.error ?? 'Could not reject that one.');
          return;
        }
        setItems((prev) => prev.filter((i) => reviewItemKey(i) !== `document:${documentId}`));
        setPaneState({ phase: 'done' });
        window.setTimeout(close, 600);
      } catch {
        setNotice('Could not reach the server.');
      } finally {
        setBusyScope(null);
        router.refresh();
      }
    },
    [busyScope, close, openKey, router],
  );

  /* ── Keyboard ────────────────────────────────────────────────────────── */

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && openKey) {
        close();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

      // Never steal the arrows from the composer underneath, or from any other
      // field: this list shares its screen with a text input people type into.
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable) return;

      const rows = Array.from(
        document.querySelectorAll<HTMLElement>('[data-review-row]'),
      );
      if (rows.length === 0) return;
      const at = active ? rows.indexOf(active) : -1;
      // From nowhere, Down enters at the top and Up at the bottom.
      const next =
        at === -1
          ? event.key === 'ArrowDown'
            ? 0
            : rows.length - 1
          : Math.min(rows.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)));
      event.preventDefault();
      rows[next]?.focus();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close, openKey]);

  /* ── Render ──────────────────────────────────────────────────────────── */

  const paneOpen = openKey !== null;
  const paneNode = openItem ? (
    <ReviewPane
      title={openItem.title}
      state={paneState}
      busy={busyScope !== null}
      onClose={close}
      onApprove={() => void runApprove([{ kind: openItem.kind, id: openItem.id }], `item:${openKey}`)}
      onReject={() => void rejectOpenDocument(openItem.id)}
      onAddCustomer={() => void runQuoteAction(openItem.id, 'customer')}
      onDismiss={() => void runQuoteAction(openItem.id, 'dismiss')}
    />
  ) : null;

  return (
    <div className="review-split w-full">
      <div className="review-chain flex flex-col">
        <section
          aria-label="Review queue"
          className="rounded-2xl border border-[var(--pf-border)] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(20,24,20,0.04)]"
        >
          {/* THE HEADER IS ONE WRAPPING ROW AND NOTHING IS POSITIONED.
              `basis-[260px]` is what stops the title column collapsing: with
              `min-w-0 flex-1` alone, arming the master button put a ~430px
              confirm sentence in the row and flexbox shrank the heading to its
              minimum — "Each / of / these / is / waiting", with the banner
              overlapping "Review · 24 items" (Josh, 2026-08-19). A flex base
              size plus `min-w-[240px]` means the title can never be squeezed
              below a readable measure; the banner takes a full-width line of its
              own instead (see ApproveAllButton's armed branch). */}
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            <div className="min-w-[240px] flex-1 basis-[260px]">
              <h1 className="of-display text-[17px] font-semibold leading-tight tracking-[-0.015em] text-[var(--pf-text)]">
                {reviewHeading(items.length)}
              </h1>
              <p className="mt-1.5 text-[13.5px] text-[var(--pf-text-secondary)]">
                Each of these is waiting on you. Approving one is the same write the module&apos;s own
                screen makes.
              </p>
            </div>
            <ApproveAllButton
              label={approveAllLabel(approvableAll.length, items.length)}
              count={approvableAll.length}
              confirmMessage={approveConfirmMessage(approvableAll.length)}
              busy={busyScope === 'all'}
              onApprove={() => approveScope({ scope: 'all' }, 'all')}
              tone="loud"
            />
          </div>

          {notice ? (
            <p
              role="status"
              className="mt-3 rounded-[10px] bg-[#F7F8FA] px-3.5 py-2 text-[12.5px] text-[var(--pf-text-secondary)]"
            >
              {notice}
            </p>
          ) : null}

          <div className="mt-5">
            {groups.length === 0 ? (
              <p className="py-6 text-center text-[13.5px] text-[var(--pf-text-secondary)]">
                Nothing left to review — all clear.
              </p>
            ) : (
              groups.map((group) => (
                <ReviewGroup
                  key={group.key}
                  group={group}
                  openKey={openKey}
                  errors={errors}
                  busyScope={busyScope}
                  onOpenItem={open}
                  onApproveTask={(taskId) =>
                    approveScope({ scope: 'task', task: taskId }, `task:${taskId}`)
                  }
                  onApproveModule={(moduleKey) =>
                    approveScope({ scope: 'module', module: moduleKey }, `module:${moduleKey}`)
                  }
                />
              ))
            )}
          </div>

          {truncated && items.length > 0 ? (
            <p className="mt-4 text-[12.5px] text-[var(--pf-text-secondary)]">
              <Link href={REVIEW_OVERFLOW_HREF} className="font-medium text-[#1F5FA8] hover:underline">
                and {total - items.length} more →
              </Link>
            </p>
          ) : null}

          <p className="mt-4 border-t border-[var(--pf-border-warm)] pt-3 text-[12.5px] text-[var(--pf-text-faint)]">
            When these are done this chat closes itself.
          </p>
        </section>

        {children}
      </div>

      {/* The right-hand track. It is ALWAYS in the tree, at zero width when shut:
          growing an element that has just been mounted cannot be animated, and
          this is the element whose growth moves the chain. Every dimension and
          the sticky are in `app/globals.css` now rather than in `lg:` utilities,
          because the breakpoint this obeys (1100) is not one of Tailwind's. */}
      <div
        className="review-pane-track"
        data-open={paneOpen ? 'true' : 'false'}
        aria-hidden={!paneOpen}
      >
        <div className="review-pane">{isDesktop ? paneNode : null}</div>
      </div>

      {/* Below REVIEW_SPLIT_MIN: the same pane, as an overlay drawer off the
          right edge. Rendered only when the viewport is actually narrow, so a
          document's preview is never fetched into an off-screen copy.

          A DRAWER, NOT THE BOTTOM SHEET v2 SHIPPED. The sheet was capped at 85vh
          of a viewport it shared with the keyboard, and at 1000px — a laptop,
          not a phone — it covered a chain that had plenty of room beside it. The
          drawer keeps the split's own gesture (in from the right, scrim behind,
          same 320ms) at every width the split cannot fit. */}
      {isDesktop === false ? (
        <>
          {paneOpen ? (
            <button
              type="button"
              aria-label="Close detail"
              onClick={close}
              className="vyso-fade-in fixed inset-0 z-30 bg-[var(--pf-scrim)]"
            />
          ) : null}
          <div
            className="review-drawer"
            data-open={paneOpen ? 'true' : 'false'}
            aria-hidden={!paneOpen}
          >
            {paneNode}
          </div>
        </>
      ) : null}
    </div>
  );
}

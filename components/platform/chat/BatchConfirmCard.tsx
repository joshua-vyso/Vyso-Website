'use client';

import { useState } from 'react';
import { useFinchChat, type BatchConfirmDockCard } from '@/components/platform/shell/FinchChatProvider';

/**
 * "Used butternut 0.6 kg and broc 1.0 kg — create a product entry using recipe
 * mixed veg" — the confirmation (Manufacturing C2).
 *
 * WHY THIS CARD EXISTS. Finch can now MATCH a spoken batch to real catalogue
 * lines (`pp_prepare_batch_log`), and this is the other half: what it matched,
 * what it could not, what the output will be, and a button. The model decided
 * which products; a PERSON decides whether any stock moves.
 *
 * IT POSTS TO THE EXISTING ROUTE. `POST /api/procurepulse/batch` with
 * `source: 'chat'` — the same endpoint the Batches screen's Confirm uses, so
 * `resolveUser`, the org scope off the caller's own profile, the recipe
 * ownership check, the movement writes and the floor-at-zero decrement all apply
 * unchanged. There is no chat-specific write path, on purpose: a second one
 * would be a second place those rules have to be right.
 *
 * THE ARROW IS THE POINT. Every line reads "broc → Broccoli Florets", because
 * the owner's word and the catalogue's word are different words and the whole
 * risk of this feature is the two being connected wrongly. On-hand rides
 * alongside so a quantity that cannot come off the shelf is visible BEFORE the
 * button, not after.
 *
 * AMBIGUOUS AND UNRESOLVED LINES ARE SHOWN, NOT HIDDEN. An ambiguous name is a
 * question the model is asking in its reply; showing the candidates here is how
 * the owner answers it knowing what the choices were. An unresolved one is
 * recorded on the batch and moves no stock, which they should learn from the
 * card rather than from a stock level that didn't change.
 */
export function BatchConfirmCard({
  card,
  onDismiss,
}: {
  card: BatchConfirmDockCard;
  onDismiss: () => void;
}) {
  const { appendAssistantLine } = useFinchChat();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** What the route did, once it has done it. Replaces the button — a card that
   *  could be pressed twice is a batch that could be logged twice. */
  const [done, setDone] = useState<{ name: string; onHand: number; movements: number } | null>(null);

  const qty = (value: number, unit: string | null) => `${value}${unit ? ` ${unit}` : ''}`;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/procurepulse/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe_id: card.recipeId,
          // Unresolved lines ride along by NAME: they belong on the batch's
          // record of what was actually used, and the route records them
          // without moving stock (batch-logic.ts drops them from the movements).
          ingredients: [
            ...card.lines.map((l) => ({
              stock_item_id: l.stock_item_id,
              product_name: l.matched_name,
              qty_used: l.qty,
              unit: l.unit,
            })),
            ...card.unresolved.map((u) => ({ product_name: u.spoken_name, qty_used: u.qty, unit: u.unit })),
          ],
          // No stock_item_id when the draft says a product will be CREATED —
          // the route owns that decision and re-runs the same precedence
          // against the catalogue as it stands now.
          output: {
            ...(card.output.stock_item_id ? { stock_item_id: card.output.stock_item_id } : {}),
            qty: card.output.qty,
            ...(card.output.unit ? { unit: card.output.unit } : {}),
          },
          ...(card.notes ? { notes: card.notes } : {}),
          source: 'chat',
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string | null;
        output?: { name?: string; new_on_hand?: number };
        movements?: number;
      };
      if (!response.ok) {
        setError(data.error ?? `The batch could not be logged (${response.status}).`);
        return;
      }
      const name = data.output?.name ?? card.output.name;
      const onHand = typeof data.output?.new_on_hand === 'number' ? data.output.new_on_hand : 0;
      const movements = typeof data.movements === 'number' ? data.movements : 0;
      setDone({ name, onHand, movements });
      // The transcript keeps one line saying what the button did. Written here,
      // not by a model: it is a fact, and it must not cost a turn.
      appendAssistantLine(
        `Logged the ${card.recipeName} batch — ${name} is now ${onHand}${
          card.output.unit ? ` ${card.output.unit}` : ''
        } on hand.`,
      );
    } catch {
      setError('Vyso could not reach ProcurePulse. Try again in a moment.');
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
              d="M5 8l7-4 7 4v8l-7 4-7-4z"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="of-display">Log batch</span>
        <span className="min-w-0 truncate text-[11px] font-normal text-[#5F80A0]">· {card.recipeName}</span>
      </div>

      {card.lines.length ? (
        <div className="mt-2 overflow-hidden rounded-lg border border-[#D5E6F7] bg-white">
          {card.lines.map((line) => (
            <div
              key={line.stock_item_id}
              className="flex items-center justify-between gap-3 border-b border-[#EEF4FB] px-3 py-2 text-[12px] text-[#171A17] last:border-0"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {/* The owner's word only when it differs from the catalogue's —
                    "Butternut → Butternut" is noise, "broc → Broccoli" is the
                    whole reason this card exists. */}
                {line.spoken_name.toLowerCase() !== line.matched_name.toLowerCase() ? (
                  <span className="shrink-0 text-[#6B6F68]">{line.spoken_name} →</span>
                ) : null}
                <span className="truncate font-medium">{line.matched_name}</span>
              </span>
              <span className="of-num shrink-0 text-[11px] text-[#6B6F68]">
                {qty(line.qty, line.unit)} · {line.on_hand} on hand
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-[12px] text-[#9A6A00]">No ingredient matched a product — nothing will move.</div>
      )}

      {card.ambiguous.map((item) => (
        <p key={`amb-${item.spoken_name}`} className="mt-2 text-[11px] leading-[1.45] text-[#9A6A00]">
          “{item.spoken_name}” could be {item.candidates.map((c) => c.name).join(' or ')} — tell Finch which one, and
          it’ll redo the card.
        </p>
      ))}

      {card.unresolved.length ? (
        <p className="mt-2 text-[11px] leading-[1.45] text-[#9A6A00]">
          No product matches {card.unresolved.map((u) => `“${u.spoken_name}”`).join(', ')} — recorded on the batch, but
          no stock moves for {card.unresolved.length === 1 ? 'it' : 'them'}.
        </p>
      ) : null}

      <div className="mt-2 rounded-lg border border-[#D5E6F7] bg-white px-3 py-2 text-[12px] text-[#171A17]">
        <span className="text-[#6B6F68]">Produces</span>{' '}
        <span className="font-medium">{done?.name ?? card.output.name}</span>
        <span className="of-num text-[#6B6F68]">
          {' '}
          · {qty(card.output.qty, card.output.unit)}
          {done
            ? ` · now ${done.onHand} on hand`
            : card.output.on_hand != null
              ? ` · ${card.output.on_hand} on hand`
              : ''}
        </span>
        {!done && card.output.action === 'create' ? (
          <span className="text-[#9A6A00]"> · new product, created on confirm</span>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-[12px] text-[#A32D2D]">{error}</p> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {done ? (
          <>
            <span className="text-[12px] font-medium text-[#1F5FA8]">
              Logged · {done.movements} stock movement{done.movements === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-[#E2E6EC] bg-white px-3 py-1.5 text-[12px] font-medium text-[#171A17] transition-colors hover:bg-[#F7FAFD] motion-reduce:transition-none"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={busy}
              className="finch-gradient rounded-lg px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Logging…' : 'Confirm batch'}
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
 * The batch cards the conversation is currently holding.
 *
 * WHY A SECOND ENTRY POINT beside `DockCards`, for the same reason `HubdocCards`
 * has one: the bubble draws every card kind, but the CHAT PAGE draws only the
 * kinds that can arise away from a module screen. A batch is logged from
 * ProcurePulse's own bubble AND from the Brief's chat ("I've just made 20 kg of
 * coleslaw"), so both surfaces need it.
 */
export function BatchCards({ live = true }: { live?: boolean }) {
  const { cards, dismissCard } = useFinchChat();
  const batchCards = live ? cards.filter((c): c is BatchConfirmDockCard => c.kind === 'pp_batch_confirm') : [];
  if (batchCards.length === 0) return null;
  return (
    <div className="mt-5 flex flex-col gap-3">
      {batchCards.map((card) => (
        <BatchConfirmCard key={card.id} card={card} onDismiss={() => dismissCard(card.id)} />
      ))}
    </div>
  );
}

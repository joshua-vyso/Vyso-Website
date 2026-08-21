'use client';

import { useCallback, useRef } from 'react';

/**
 * Excel-style keyboard navigation for a grid of form cells.
 *
 * WHY. The order review editor is a spreadsheet in everything but its keyboard.
 * A reviewer correcting a twenty-two line purchase order against the paper works
 * DOWN a column — every quantity, then every price — and until now the only way
 * to get from one quantity to the next was Tab, Tab, Tab, Tab across four cells
 * they did not want, or the mouse. Nobody checks twenty-two rows that way; they
 * check the first three and trust the rest, which is exactly the habit this whole
 * screen exists to break.
 *
 * THE RULES, and why each one is what it is:
 *
 *   ↑ / ↓        always move a row. Vertical is the direction a column is
 *                checked in, and no text-editing gesture in an <input> wants
 *                them, so there is nothing to arbitrate.
 *
 *   ← / →        move a column ONLY when the caret is already at the end of the
 *                text it is in. Anywhere else they mean what they have always
 *                meant. A grid that stole the arrow keys from mid-word would
 *                make correcting "560.90" to "569.90" harder than it is now,
 *                which would be a strange thing for this screen to do.
 *
 *   Enter        moves down. Excel's rule, and the one a bookkeeper's hands
 *                already know.
 *
 *   Tab          is left completely alone. It is the platform's own answer to
 *                "next field", it is what a screen reader announces, and
 *                reimplementing it would only be a worse copy.
 *
 * IT DEFERS TO WHATEVER IS ALREADY OPEN. The handler ignores any event whose
 * `defaultPrevented` is already set, so a component inside a cell that has taken
 * a key — the product typeahead using ↑/↓ to walk its suggestions — keeps it.
 * That is the entire coexistence mechanism: one boolean, no registry, no
 * coordination between the dropdown and the grid. Esc closes the dropdown, it
 * stops taking the arrows, and the grid resumes on the very next keystroke.
 *
 * SELECTS MOVE, THEY DO NOT SPIN. On a <select>, ↑/↓ would natively change the
 * value. In a grid that is a trap: arrowing down a column of units would silently
 * rewrite every unit it passed through. So a select navigates like every other
 * cell, and its value is changed by opening it (click, Space, or Alt+↓) — an
 * explicit act, which is what changing a billed unit ought to be.
 */

/** The `data-grid-cell` value for one cell. Row and column are both 0-based. */
export function gridCell(row: number, col: number): string {
  return `${row}:${col}`;
}

/**
 * The focus treatment for a navigable cell: the burnt-orange accent (#BE5D23,
 * the `--accent` / `--ring` token in globals.css), a 150ms ease so moving
 * through a column reads as one continuous motion rather than a strobe, and
 * NOTHING under `prefers-reduced-motion` — the border still appears, it simply
 * appears at once. Append to a cell's own classes; it overrides the blue focus
 * border the non-grid inputs use.
 */
export const GRID_CELL_FOCUS =
  'transition-[border-color,box-shadow] duration-150 ease-out motion-reduce:transition-none ' +
  'focus:border-[#BE5D23] focus:ring-1 focus:ring-[#BE5D23]';

type Focusable = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** True when the caret sits at the very start of the text in this cell. */
function caretAtStart(el: Focusable): boolean {
  if (el instanceof HTMLSelectElement) return true;
  // selectionStart is null on input types that do not expose a caret (number,
  // email…). No caret means no text position to protect, so the arrow is free.
  if (el.selectionStart == null) return true;
  return el.selectionStart === 0 && el.selectionEnd === 0;
}

/** True when the caret sits at the very end of the text in this cell. */
function caretAtEnd(el: Focusable): boolean {
  if (el instanceof HTMLSelectElement) return true;
  if (el.selectionStart == null) return true;
  const end = el.value?.length ?? 0;
  return el.selectionStart === end && el.selectionEnd === end;
}

/** Every navigable cell inside this grid, in document order. */
function cellsIn(root: HTMLElement): Focusable[] {
  return Array.from(root.querySelectorAll<Focusable>('[data-grid-cell]')).filter(
    (el) => !el.disabled,
  );
}

function coordsOf(el: Element): { row: number; col: number } | null {
  const raw = el.getAttribute('data-grid-cell');
  if (!raw) return null;
  const [r, c] = raw.split(':');
  const row = Number(r);
  const col = Number(c);
  return Number.isInteger(row) && Number.isInteger(col) ? { row, col } : null;
}

/**
 * The cell to land on: the exact coordinate when it exists, otherwise the
 * nearest column in that row.
 *
 * The fallback matters because the columns are not uniform — a row may lose a
 * cell (an amount that is a read-out rather than an input, a select that is
 * absent). Landing on the nearest one keeps ↓ down a ragged column feeling like
 * one continuous move instead of dead-ending on a row that happens to be short.
 */
function findCell(root: HTMLElement, row: number, col: number): Focusable | null {
  const cells = cellsIn(root);
  const inRow = cells
    .map((el) => ({ el, at: coordsOf(el) }))
    .filter((x): x is { el: Focusable; at: { row: number; col: number } } => x.at?.row === row);
  if (inRow.length === 0) return null;
  let best = inRow[0];
  for (const candidate of inRow) {
    if (Math.abs(candidate.at.col - col) < Math.abs(best.at.col - col)) best = candidate;
  }
  return best.el;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Move focus to a cell, select its contents, and bring it into view. */
function land(el: Focusable): void {
  el.focus();
  // Excel selects the cell's contents on arrival, so typing replaces rather than
  // appends. Guarded: select() throws on input types that have no selection.
  if (!(el instanceof HTMLSelectElement)) {
    try {
      el.select();
    } catch {
      /* input types without a text selection — nothing to select */
    }
  }
  el.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  });
}

export interface GridNavigation<T extends HTMLElement = HTMLDivElement> {
  /** Attach to the element that wraps every row. */
  gridRef: React.RefObject<T | null>;
  /** Attach to the same element. Handles the grid keys and passes on the rest. */
  onKeyDown: (event: React.KeyboardEvent<T>) => void;
}

export function useGridNavigation<T extends HTMLElement = HTMLDivElement>(): GridNavigation<T> {
  const gridRef = useRef<T>(null);

  const onKeyDown = useCallback((event: React.KeyboardEvent<T>) => {
    // Something inside the cell has already claimed this key — a typeahead
    // walking its own list, most often. It keeps it.
    if (event.defaultPrevented) return;
    // A modifier means the user is asking for something else entirely
    // (Alt+↓ opens a select, ⌘←/→ is line-start/end, Shift+arrow selects text).
    if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;

    const root = gridRef.current;
    if (!root) return;
    const target = event.target as HTMLElement | null;
    const cell = target?.closest?.('[data-grid-cell]') as Focusable | null;
    if (!cell) return;
    const at = coordsOf(cell);
    if (!at) return;

    let next: { row: number; col: number } | null = null;
    switch (event.key) {
      case 'ArrowDown':
      case 'Enter':
        next = { row: at.row + 1, col: at.col };
        break;
      case 'ArrowUp':
        next = { row: at.row - 1, col: at.col };
        break;
      case 'ArrowLeft':
        if (!caretAtStart(cell)) return;
        next = { row: at.row, col: at.col - 1 };
        break;
      case 'ArrowRight':
        if (!caretAtEnd(cell)) return;
        next = { row: at.row, col: at.col + 1 };
        break;
      default:
        return;
    }

    if (next.col < 0 || next.row < 0) {
      // The edge of the grid. Swallow the key rather than letting Enter submit
      // a form or ↑ scroll the page out from under the row being checked.
      event.preventDefault();
      return;
    }
    const destination = findCell(root, next.row, next.col);
    // A sideways move must not silently become a vertical one: `findCell` snaps
    // to the nearest column in the row, which is right for ↑/↓ over a ragged
    // grid and wrong for ← / → past the last column.
    if (!destination) {
      event.preventDefault();
      return;
    }
    const landedAt = coordsOf(destination);
    if (landedAt && (event.key === 'ArrowLeft' || event.key === 'ArrowRight') && landedAt.col !== next.col) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    land(destination);
  }, []);

  return { gridRef, onKeyDown };
}

'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { suggestProducts, type ProductOption } from '@/lib/platform/docu/product-suggest';

/**
 * A description cell that suggests the org's own products as you type.
 *
 * DELIBERATELY NOT A SELECT. An invoice line records what the paper said, so
 * anything typed here is valid and stays: picking a suggestion is a shortcut,
 * never a requirement, and the dropdown never rewrites, corrects or rejects a
 * value on blur. What it buys is consistency — the same tomato spelled the
 * same way each time it is reviewed, which is what keeps ProcurePulse from
 * growing a row per spelling.
 *
 * NO DEBOUNCE, ON PURPOSE. The whole (few-hundred-row) catalogue is fetched
 * once by the page and filtered locally by `suggestProducts`, so every
 * keystroke re-ranks in microseconds. A dropdown that waits on a request is a
 * dropdown that arrives after the next character.
 *
 * Keyboard: ↓/↑ move, Enter takes the highlighted row, Esc closes without
 * changing anything, Tab leaves and closes.
 */
export function ProductSuggestInput({
  id,
  value,
  options,
  onChange,
  onPick,
  className,
  placeholder,
  ariaLabel,
}: {
  id?: string;
  value: string;
  /** The org's products (and confirmed aliases), fetched once per mount. */
  options: ProductOption[];
  onChange: (value: string) => void;
  /** Fired only when a suggestion is chosen — the caller also fills the unit. */
  onPick: (option: ProductOption) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => (options.length ? suggestProducts(options, value) : []), [options, value]);

  // Close when the click lands anywhere else. mousedown (not click) so a click
  // straight onto another cell closes this list before that cell focuses.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const show = open && matches.length > 0;

  function choose(option: ProductOption) {
    onPick(option);
    setOpen(false);
    setActive(0);
  }

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={show ? `${listId}-${active}` : undefined}
        autoComplete="off"
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            // Stops here: Esc means "close the list", not "leave the field".
            if (open) e.stopPropagation();
            setOpen(false);
            return;
          }
          if (e.key === 'Tab') {
            setOpen(false);
            return;
          }
          if (!show) {
            if (e.key === 'ArrowDown' && matches.length > 0) {
              e.preventDefault();
              setOpen(true);
            }
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => (i + 1) % matches.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => (i - 1 + matches.length) % matches.length);
          } else if (e.key === 'Enter') {
            // Only swallowed when a row is highlighted — otherwise Enter keeps
            // whatever normal meaning the surrounding form gives it.
            const picked = matches[active];
            if (picked) {
              e.preventDefault();
              choose(picked);
            }
          }
        }}
      />

      {show ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 max-h-[240px] min-w-[240px] overflow-auto rounded-[12px] border border-[#EAEDF2] bg-white py-1 shadow-[0_18px_50px_-8px_rgba(26,28,30,0.25)]"
        >
          {matches.map((o, i) => (
            <li key={`${o.id}-${o.name}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                // mousedown, not click: the input's blur would close the list first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={`block w-full px-3 py-1.5 text-left transition-colors ${
                  i === active ? 'bg-[#EAF2FC]' : 'hover:bg-[#F5F9FE]'
                }`}
              >
                <span className="block truncate text-[13px] text-[#171A17]">{o.name}</span>
                {o.hint || o.unit ? (
                  <span className="block truncate text-[11px] text-[#8A8E86]">
                    {[o.hint, o.unit].filter(Boolean).join(' · ')}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

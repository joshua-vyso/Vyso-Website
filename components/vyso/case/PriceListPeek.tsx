import { ChromeFrame } from "@/components/vyso/demo/ChromeFrame";

/* ── The price list peek ─────────────────────────────────────────────────────
   "How the automation works" for Turn 'n Slice: typing an item and the priced
   row is already there, current cost, current margin, current customer terms,
   applied automatically. The pre-redesign page had a dedicated
   `components/finch/company/PriceListDemo.tsx` for this; that file is out of
   this phase's touch scope (`components/finch/**`) and stays for whatever
   still imports it, so this is a fresh, smaller version on the `--vy-*`
   system rather than a port. Same fact, same shape (a window with a row being
   typed and three others already resolved), no invented numbers: every rand
   figure below is illustrative, in the same register as the homepage's
   `R91 per kg` and `R18,420` — an operational number, not a client result. */

const ROWS: readonly { item: string; cost: string; margin: string; terms: string; active?: boolean }[] = [
  { item: "Butternut, 10kg box", cost: "R64.00", margin: "22%", terms: "Net 30" },
  { item: "Onions, 10kg pocket", cost: "R58.50", margin: "19%", terms: "Net 30" },
  { item: "Tomatoes, 5kg box", cost: "R71.20", margin: "24%", terms: "Net 15", active: true },
];

export function PriceListPeek() {
  return (
    <ChromeFrame variant="window" title="Price list · Highveld Foods" meta="TYPING…">
      <div className="px-[16px] py-[14px]">
        <div className="grid grid-cols-[1fr_70px_54px_64px] gap-[10px] border-b border-[color:var(--vy-line)] pb-[8px]">
          {["Item", "Cost", "Margin", "Terms"].map((label) => (
            <span key={label} className="vy-label text-[9.5px] text-[color:var(--vy-ink-4)]">
              {label}
            </span>
          ))}
        </div>
        <ul className="m-0 flex list-none flex-col p-0">
          {ROWS.map((row) => (
            <li
              key={row.item}
              className={`grid grid-cols-[1fr_70px_54px_64px] items-center gap-[10px] border-b border-[color:var(--vy-line)] py-[10px] last:border-0 ${
                row.active ? "rounded-[8px] bg-[color:var(--vy-accent-tint)] px-[6px]" : ""
              }`}
            >
              <span className="text-[13px] text-[color:var(--vy-ink)]">{row.item}</span>
              <span className="vy-mono text-[11.5px] text-[color:var(--vy-ink-2)]">{row.cost}</span>
              <span className="vy-mono text-[11.5px] text-[color:var(--vy-ink-2)]">{row.margin}</span>
              <span className="vy-mono text-[11px] text-[color:var(--vy-ink-3)]">{row.terms}</span>
            </li>
          ))}
        </ul>
        <p className="vy-label mt-[10px] text-[9.5px] text-[color:var(--vy-accent-ink)]">
          ROW APPLIED AUTOMATICALLY FROM THE CUSTOMER&apos;S TERMS
        </p>
      </div>
    </ChromeFrame>
  );
}

export default PriceListPeek;

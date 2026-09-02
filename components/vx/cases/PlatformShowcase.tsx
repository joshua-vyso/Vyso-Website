"use client";

/* ── The operating system, real screens ──────────────────────────────────────
   Screenshots of the Vyso platform, taken on the demo organisation
   (illustrative demo data, no client data). A tab strip swaps the screen;
   the strip is real buttons with real labels. */

import { useState } from "react";

const SCREENS = [
  { id: "stock", label: "Stock & suppliers", file: "platform-stock", line: "What you hold, what you pay for it, who you buy it from." },
  { id: "market", label: "Market sheet", file: "platform-market", line: "Every supplier's latest price, read off the invoices. Cheapest in green." },
  { id: "docu", label: "Documents", file: "platform-docu", line: "Invoices, statements, delivery notes: captured, extracted, filed." },
  { id: "orders", label: "Orders", file: "platform-orders", line: "Customer orders from draft to delivery, invoice and payment." },
];

export function PlatformShowcase() {
  const [active, setActive] = useState(0);
  const screen = SCREENS[active];
  return (
    <div className="vx-device">
      <div className="vx-device-tabs" role="tablist" aria-label="Platform screens">
        {SCREENS.map((s, i) => (
          <button key={s.id} type="button" role="tab" aria-selected={i === active} className={i === active ? "on" : ""} onClick={() => setActive(i)} data-cursor="link">
            {s.label}
          </button>
        ))}
      </div>
      <div className="vx-device-screen">
        {SCREENS.map((s, i) => (
          /* eslint-disable-next-line @next/next/no-img-element -- static evidence shots */
          <img key={s.id} src={`/site/cases/${s.file}.webp`} alt={`Vyso platform, ${s.label} screen (demo data)`} width={1600} height={1000} loading={i === 0 ? "eager" : "lazy"} hidden={i !== active} />
        ))}
      </div>
      <p className="vx-device-line">
        <span className="vx-chip vx-chip-muted">demo data</span> {screen.line}
      </p>
    </div>
  );
}

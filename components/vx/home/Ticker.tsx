import { INTEGRATIONS } from "../content";
import { Marquee } from "../primitives";

/* Two counter-running bands: the operations vocabulary, then the systems it
   runs through. Decorative (aria-hidden); the same facts live in real text
   further down the page. */

const WORDS = ["Invoices read", "Prices watched", "Deliveries reconciled", "Debtors chased", "Renewals tracked", "Briefs delivered"];

export function Ticker() {
  return (
    <section className="vx-ticker" aria-hidden="true">
      <Marquee speed={46}>
        {WORDS.map((w) => (
          <span className="vx-tick" key={w}>
            {w}
            <i className="dot" />
          </span>
        ))}
      </Marquee>
      <div style={{ marginTop: "clamp(24px, 3vw, 40px)" }}>
        <Marquee speed={60} reverse>
          <span className="vx-logos">
            {INTEGRATIONS.map((item) => (
              /* eslint-disable-next-line @next/next/no-img-element -- third-party marks, see public/integrations/README.md */
              <img key={item.file} src={`/integrations/${item.file}.svg`} alt="" width={26} height={26} />
            ))}
          </span>
        </Marquee>
      </div>
    </section>
  );
}

import { FAQ } from "../content";
import { Reveal, Words } from "../primitives";

/* ── FAQ ─────────────────────────────────────────────────────────────────────
   Native <details> so every answer is in the DOM for crawlers and answer
   engines; the page also emits FAQPage JSON-LD from the same registry. */

export function Faq() {
  return (
    <section className="vx-section" aria-labelledby="faq-h" style={{ paddingTop: 0 }}>
      <div className="vx-wrap">
        <div className="vx-section-head">
          <div>
            <Reveal>
              <p className="vx-eyebrow">Questions</p>
            </Reveal>
            <Words as="h2" className="vx-display vx-h2" text="Straight" em="answers." />
            <span id="faq-h" className="sr-only">
              Frequently asked questions
            </span>
          </div>
        </div>
        <Reveal className="vx-faq">
          {FAQ.map((item, i) => (
            <details key={item.id} name="vx-faq">
              <summary>
                <span className="n">0{i + 1}</span>
                <span>{item.q}</span>
                <span className="x" aria-hidden="true" />
              </summary>
              <p className="a">{item.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

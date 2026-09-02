import Link from "next/link";
import { Artifact } from "../artifacts";
import { SYSTEMS } from "../content";
import { Reveal, Words } from "../primitives";

/* ── The five systems ────────────────────────────────────────────────────────
   A bento of ink plates. Each plate is a title, one sentence, and the system
   itself running in miniature. The first two plates (Read, Check) span
   three columns; the rest two. */

export function Systems() {
  return (
    <section className="vx-section" id="systems" aria-labelledby="systems-h">
      <div className="vx-wrap">
        <div className="vx-section-head">
          <div>
            <Reveal>
              <p className="vx-eyebrow">What we build</p>
            </Reveal>
            <Words as="h2" className="vx-display vx-h2" text="Five systems. One" em="operating layer." />
          </div>
          <Reveal delay={120}>
            <p className="vx-lead">
              Every business runs on the same five verbs. We build each one as a bespoke system around the tools you already use.
            </p>
            <Link href="/automations" className="vx-link" style={{ marginTop: 22 }}>
              All systems in detail
            </Link>
          </Reveal>
        </div>
        <span id="systems-h" className="sr-only">
          Five systems. One operating layer.
        </span>

        <ul className="vx-systems" role="list">
          {SYSTEMS.map((s, i) => {
            return (
              <Reveal as="li" key={s.id} className={`vx-plate vx-sys ${i < 2 ? "vx-sys-wide" : ""}`} delay={(i % 3) * 90}>
                <div className="vx-sys-head">
                  <div>
                    <p className="vx-sys-num">{s.num}</p>
                    <h3 className="vx-sys-title">
                      {s.title} <em className="vx-em">{s.em}</em>
                    </h3>
                  </div>
                </div>
                <p className="vx-sys-body">{s.line}</p>
                <div className="vx-sys-stage">
                  <Artifact id={s.id} />
                </div>
                <p className="vx-sys-human">
                  <i aria-hidden="true" /> {s.human}
                </p>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

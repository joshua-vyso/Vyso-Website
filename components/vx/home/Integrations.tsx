import Link from "next/link";
import { INTEGRATIONS } from "../content";
import { Reveal, Words } from "../primitives";

/* ── Integration orbit ───────────────────────────────────────────────────────
   Two counter-rotating rings of the marks the site already ships
   (`public/integrations/*.svg`, nominative use). Live systems carry a green
   dot. The rings pause on hover so a mark can be read. Pure CSS animation. */

export function Orbit() {
  const outer = INTEGRATIONS.slice(0, 8);
  const inner = INTEGRATIONS.slice(8);
  return (
    <div className="vx-orbit" aria-label="Systems Vyso connects to">
      <div className="vx-orbit-ring" style={{ "--spd": "90s" } as React.CSSProperties}>
        {outer.map((item, i) => (
          <div
            key={item.file}
            className="vx-orbit-node"
            data-live={item.live ? "true" : "false"}
            style={{ "--a": `${(360 / outer.length) * i}deg`, "--r": "min(44vw, 360px)", "--spd": "90s" } as React.CSSProperties}
            data-cursor="link"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- third-party mark */}
            <img src={`/integrations/${item.file}.svg`} alt={item.name} width={28} height={28} />
            <span>
              {item.name}
              {item.live ? " · live" : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="vx-orbit-ring" data-inner="" style={{ "--spd": "70s" } as React.CSSProperties}>
        {inner.map((item, i) => (
          <div
            key={item.file}
            className="vx-orbit-node"
            data-live={item.live ? "true" : "false"}
            style={{ "--a": `${(360 / inner.length) * i + 36}deg`, "--r": "min(24.6vw, 202px)", "--spd": "70s" } as React.CSSProperties}
            data-cursor="link"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- third-party mark */}
            <img src={`/integrations/${item.file}.svg`} alt={item.name} width={28} height={28} />
            <span>{item.name}</span>
          </div>
        ))}
      </div>
      <div className="vx-orbit-core">
        <p className="vx-display">
          Your tools <em className="vx-em" style={{ color: "var(--vx-signal)", fontWeight: 300 }}>stay.</em>
        </p>
      </div>
    </div>
  );
}

export function Integrations() {
  return (
    <section className="vx-section vx-on-ink" aria-labelledby="integrations-h" style={{ paddingTop: 0 }}>
      <div className="vx-wrap">
        <hr className="vx-hr" />
        <div className="vx-section-head" style={{ marginTop: "clamp(48px, 6vw, 96px)" }}>
          <div>
            <Reveal>
              <p className="vx-eyebrow">Integrations</p>
            </Reveal>
            <Words as="h2" className="vx-display vx-h2" text="The gaps between your tools" em="close." />
            <span id="integrations-h" className="sr-only">
              Integrations
            </span>
          </div>
          <Reveal delay={100}>
            <p className="vx-lead">Outlook, Xero, WhatsApp and Gmail run in production today. The rest connect as the workflow needs them.</p>
            <Link href="/integrations" className="vx-link" style={{ marginTop: 22, color: "var(--vx-ondark-2)" }}>
              How the lanes work
            </Link>
          </Reveal>
        </div>
        <Reveal delay={120}>
          <Orbit />
        </Reveal>
      </div>
    </section>
  );
}

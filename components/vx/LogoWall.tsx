import { INTEGRATIONS } from "./content";
import { Marquee } from "./primitives";
import { WALL_LOGOS } from "./wall-logos";

/* ── Logo wall ───────────────────────────────────────────────────────────────
   Three perpetual rows of the software and AI tools a Vyso system can sit
   between: the outer rows drift left, the middle row drifts right. The 13
   site marks (with their live flags) lead; the vendored Simple Icons set
   (`public/integrations/wall/`, CC0, nominative use) fills the rest.
   Names are real text so the list is readable by crawlers. */

type Chip = { name: string; src: string; live: boolean };

function chips(): Chip[] {
  const base: Chip[] = INTEGRATIONS.map((i) => ({ name: i.name, src: `/integrations/${i.file}.svg`, live: i.live }));
  const seen = new Set(base.map((c) => c.name.toLowerCase()));
  for (const logo of WALL_LOGOS) {
    if (seen.has(logo.name.toLowerCase())) continue;
    seen.add(logo.name.toLowerCase());
    base.push({ name: logo.name, src: `/integrations/wall/${logo.slug}.svg`, live: false });
  }
  return base;
}

export function LogoWall() {
  const all = chips();
  const rows: Chip[][] = [[], [], []];
  all.forEach((chip, i) => rows[i % 3].push(chip));
  return (
    <div className="vx-wall" aria-label="Software and AI tools Vyso systems connect between">
      {rows.map((row, r) => (
        <Marquee key={r} speed={70 + r * 12} reverse={r === 1}>
          <div className="vx-wall-row">
            {row.map((chip) => (
              <span key={chip.name} className="vx-wall-chip" data-live={chip.live ? "true" : "false"}>
                {/* eslint-disable-next-line @next/next/no-img-element -- third-party mark */}
                <img src={chip.src} alt="" width={36} height={36} loading="lazy" />
                {chip.name}
              </span>
            ))}
          </div>
        </Marquee>
      ))}
    </div>
  );
}

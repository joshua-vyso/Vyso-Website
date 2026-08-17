import type { ModuleFeatureSection as FeatureSectionData } from "@/lib/marketing/modules";

import { ModuleScreenshotFrame } from "./ModuleScreenshotFrame";

/* One "Inside <Module>" row. Three shapes, matched to what the data actually
   has (never invented): a real screenshot, a quiet placeholder panel for
   ServiceDen's screen-not-public sections (`placeholderTags`), or — where
   neither exists — a full-width copy block rather than a lopsided empty
   column. Alternates screenshot side at `lg`; single column, `max-w-full`
   images below it, per the plan. Server component: nothing here is animated,
   by design — the page's one motion moment is the wiring diagram above the
   grid on the index, not a scroll-reveal on every one of ~55 feature rows
   across ten detail pages. */

function Copy({ index, section }: { index: number; section: FeatureSectionData }) {
  const ordinal = String(index + 1).padStart(2, "0");
  return (
    <div>
      <p className="m-0 mb-[10px] font-fn-mono text-[11px] tracking-[0.12em] text-fn-muted">{ordinal}</p>
      <h3 className="m-0 mb-[10px] font-fn-serif text-[22px] font-medium tracking-[-0.01em] text-fn-ink lg:text-[24px]">
        {section.title}
      </h3>
      <p className="m-0 mb-[16px] text-[14.5px] leading-[1.6] text-fn-ink-3">{section.copy}</p>
      <ul className="m-0 flex list-none flex-col gap-[9px] p-0">
        {section.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-[10px] text-[13.5px] leading-[1.5] text-fn-ink-2">
            <span className="mt-[7px] h-[4px] w-[4px] shrink-0 rounded-full bg-fn-line-3" aria-hidden="true" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ModuleFeatureSection({
  section,
  index,
}: {
  section: FeatureSectionData;
  index: number;
}) {
  if (section.screenshot) {
    const flipped = index % 2 === 1;
    return (
      <article
        id={section.id}
        className={`grid grid-cols-1 items-center gap-[28px] lg:grid-cols-2 lg:gap-[56px] ${
          flipped ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        <Copy index={index} section={section} />
        <ModuleScreenshotFrame
          src={section.screenshot.src}
          alt={section.screenshot.alt}
          label={section.screenshot.label}
          cropTop={section.screenshot.cropTop}
          className="max-w-full"
          sizes="(max-width: 1023px) 92vw, 520px"
        />
      </article>
    );
  }

  if (section.placeholderTags && section.placeholderTags.length > 0) {
    const flipped = index % 2 === 1;
    return (
      <article
        id={section.id}
        className={`grid grid-cols-1 items-center gap-[28px] lg:grid-cols-2 lg:gap-[56px] ${
          flipped ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        <Copy index={index} section={section} />
        <div className="flex min-h-[220px] flex-col items-start justify-center gap-[12px] rounded-[12px] border border-dashed border-fn-line-3 bg-fn-bg px-[24px] py-[28px]">
          <p className="m-0 font-fn-mono text-[10.5px] tracking-[0.1em] text-fn-muted">
            NOT PUBLICLY SCREENSHOTTED
          </p>
          <div className="flex flex-wrap gap-[8px]">
            {section.placeholderTags.map((tag) => (
              <span
                key={tag}
                className="rounded-[6px] border border-fn-line bg-fn-surface px-[9px] py-[4px] font-fn-mono text-[10.5px] text-fn-ink-3"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article id={section.id} className="max-w-[720px]">
      <Copy index={index} section={section} />
    </article>
  );
}

export default ModuleFeatureSection;

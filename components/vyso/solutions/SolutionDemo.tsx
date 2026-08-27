import { Reveal } from "@/components/vyso/Reveal";
import { stagger } from "@/components/vyso/stagger";
import { ChromeFrame } from "@/components/vyso/demo/ChromeFrame";
import { EventTimeline, type TimelineScript } from "@/components/vyso/demo/EventTimeline";
import { FindingCard, type FindingState } from "@/components/vyso/demo/FindingCard";
import type { Solution } from "@/lib/marketing/solutions";

/* ── The solution demo ───────────────────────────────────────────────────────
   Plan §7.4 item 3: "an EventTimeline or FindingCard set specific to that
   workflow". `lib/marketing/solutions.ts` picks the grammar per page
   (`demo.kind`); this component is the one place that turns either shape into
   the real components, so every solution page renders its demo identically
   and a reviewer only has to check this file to know both are wired right.

   The data types in `solutions.ts` mirror `EventTimeline`'s and
   `FindingCard`'s props structurally rather than importing them (that file's
   own header explains why: it stays a plain data module, like
   `findings.ts`). Passing `demo.script` as `TimelineScript` and a
   `FindingCard`'s `state` as `FindingState` here is what proves the two
   shapes actually line up — if a page's data drifted from either component's
   real prop type, this file would fail to compile. */

const CAPTION = "Illustrative example";

export function SolutionDemo({ solution }: { solution: Solution }) {
  const { demo } = solution;

  if (demo.kind === "timeline") {
    return (
      <div>
        <ChromeFrame
          variant={demo.chromeVariant ?? "window"}
          title={demo.frameTitle}
          meta={demo.frameMeta}
          subtitle={demo.chromeSubtitle}
        >
          <div className="px-[18px] py-[24px] md:px-[26px] md:py-[28px]">
            <EventTimeline
              script={demo.script as TimelineScript}
              interval={0.55}
              replay={demo.replay}
              label={demo.label}
            />
          </div>
        </ChromeFrame>
        <p className="vy-label mt-[12px] text-right text-[10.5px] text-[color:var(--vy-ink-3)]">
          {CAPTION}
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul className="m-0 grid list-none grid-cols-1 gap-[20px] p-0 md:grid-cols-2">
        {demo.items.map((item, i) => (
          <Reveal
            as="li"
            key={`${item.observation.slice(0, 24)}-${i}`}
            delay={stagger(i)}
            className={demo.items.length % 2 !== 0 && i === demo.items.length - 1 ? "md:col-span-2" : ""}
          >
            <FindingCard
              source={item.source}
              state={item.state as FindingState}
              observation={item.observation}
              impact={item.impact}
              evidence={item.evidence}
              meta={item.meta}
              actions={item.actions}
            />
          </Reveal>
        ))}
      </ul>
      <p className="vy-label mt-[16px] text-right text-[10.5px] text-[color:var(--vy-ink-3)]">
        {CAPTION}
      </p>
    </div>
  );
}

export default SolutionDemo;

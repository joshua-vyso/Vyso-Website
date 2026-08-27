import type { ExampleFinding } from "@/lib/marketing/industries";
import { Reveal } from "@/components/vyso/Reveal";
import { stagger } from "@/components/vyso/stagger";
import { FindingCard, type FindingState } from "@/components/vyso/demo/FindingCard";

/* ── The industry finding deck ────────────────────────────────────────────────
   Three `FindingCard`s built from an `Industry.deck` (`lib/marketing/
   industries.ts`), the vertical's own signature demo. Every page gets one
   accent and two grey cards (`alert`, `watching`, `resolved`, in that fixed
   order): the system's rule of thumb is roughly one accented element per
   section, and this section's whole subject is three things worth noticing,
   not three alarms. */

const STATES: readonly [FindingState, FindingState, FindingState] = ["alert", "watching", "resolved"];

export function IndustryDeck({ deck }: { deck: readonly [ExampleFinding, ExampleFinding, ExampleFinding] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-[20px] p-0 md:grid-cols-3">
      {deck.map((finding, i) => (
        <Reveal as="li" key={finding.meta} delay={stagger(i)}>
          <FindingCard
            source={finding.agent}
            state={STATES[i]}
            observation={finding.observation}
            impact={finding.impact}
            evidence={finding.evidence}
            meta={finding.meta}
            actions={finding.actions}
            className="h-full"
          />
        </Reveal>
      ))}
    </ul>
  );
}

export default IndustryDeck;

"use client";

import { FindingDeck } from "./industries/FindingDeck";
import { getFindings, type FindingId } from "@/lib/marketing/findings";

/* ── The fanned stack ────────────────────────────────────────────────────────
   §5's `stack` variant. Almost nothing here, on purpose: `industries/
   FindingDeck.tsx` already *is* this — three cards entering fanned, then
   straightening into a cascade, hover lifting one above the others — and it
   already takes its findings as data rather than owning any copy.

   The plan's instruction was "extract/reuse, don't duplicate; if the deck is
   already reusable, skip". It is: its `ExampleFinding` prop type is
   structurally the library's `Finding` (agent / observation / impact /
   evidence / meta / actions), so a `Finding[]` satisfies it as-is with no
   adapter and no cast. All that was missing was a way to name three cards by
   id instead of writing them out, which is this file.

   Kept as its own module rather than an extra prop on `FindingDeck` so
   `/industries/*` keeps passing its own vertical-specific decks (which are
   authored in `lib/marketing/industries.ts`, not the findings library) without
   either surface having to know about the other.                              */

export function FindingStack({ ids }: { ids: readonly FindingId[] }) {
  return <FindingDeck findings={getFindings(ids.slice(0, 3))} />;
}

export default FindingStack;

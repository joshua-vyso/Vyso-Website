"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { track } from "@/lib/analytics";
import type { AnalyticsEvent, AnalyticsEvents } from "@/lib/analytics";

/* ── Tracked CTA link ─────────────────────────────────────────────────────
   The whole reason this file exists: most Finch CTAs live in server
   components, and a `track()` call needs an `onClick`, which needs a client
   component. Wrapping just the `<Link>` in this tiny client shell keeps the
   surrounding page (hero, section, whatever) server-rendered — the same
   `next/link` `<Link>` underneath, same props, plus a `track()` fired before
   navigation. Nothing else about the link changes. */
export function TrackedLink<E extends AnalyticsEvent>({
  event,
  eventProps,
  onClick,
  ...linkProps
}: ComponentProps<typeof Link> & {
  event: E;
  eventProps: AnalyticsEvents[E];
}) {
  return (
    <Link
      {...linkProps}
      onClick={(e) => {
        track(event, eventProps);
        onClick?.(e);
      }}
    />
  );
}

export default TrackedLink;

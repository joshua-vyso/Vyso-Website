import { Button } from "@/components/vyso/Button";
import { Section } from "@/components/vyso/Section";

/* ── The close ───────────────────────────────────────────────────────────────
   Plan §7.1.10. The page's ONE dark band, and it is the last thing on it: the
   system's budget is one `ground="dark"` section per page and this spends it.

   Nothing else stands here. A dark band with a demo in it is a second hero, and
   the only job left at the bottom of this page is to make the free audit easy
   to start and to leave a quieter door for someone who is not ready to book an
   hour yet.

   The buttons need no `tone` prop: `data-vy-ground="dark"` re-points the ramp
   underneath them, so the primary button inverts to light-on-dark on its own
   and there is no second copy of it to keep in sync. */

export function HomeClose() {
  return (
    <Section
      id="start"
      ground="dark"
      spacing="loose"
      align="center"
      heading="What's costing your business time?"
      lead="Tell us how your operation currently works. We'll show you where Vyso can help."
    >
      <div className="flex flex-col items-center justify-center gap-[14px] sm:flex-row sm:gap-[20px]">
        <Button
          href="/operations-audit"
          size="lg"
          event="book_audit_click"
          eventProps={{ page: "home-close" }}
        >
          Get a free Operations Audit
        </Button>
        <Button href="/contact" variant="secondary" size="lg">
          Talk to Vyso
        </Button>
      </div>
    </Section>
  );
}

export default HomeClose;

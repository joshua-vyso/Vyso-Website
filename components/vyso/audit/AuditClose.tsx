import { Button } from "@/components/vyso/Button";
import { Section } from "@/components/vyso/Section";
import { BOOK_HREF } from "@/components/vyso/audit/audit-content";

/* ── The close ───────────────────────────────────────────────────────────────
   The page's ONE dark band, and the last thing on it. Its primary action sends
   the reader back up to the form in the hero rather than to another page: the
   form is already on this page, and a closing CTA that navigates away from the
   thing it is asking for is a page arguing with itself.

   The secondary door is `/how-it-works` rather than `/contact`, because someone
   who reached the bottom of this page without booking usually has one question
   left and it is "what would you actually build", which is that page.

   The buttons need no `tone` prop: `data-vy-ground="dark"` re-points the ramp
   underneath them. */

export function AuditClose() {
  return (
    <Section
      id="start"
      ground="dark"
      spacing="loose"
      align="center"
      heading="What's costing your business time?"
      lead="Tell us how your operation currently works. We'll come back with where it leaks and what would be worth fixing first."
    >
      <div className="flex flex-col items-center justify-center gap-[14px] sm:flex-row sm:gap-[20px]">
        <Button
          href={BOOK_HREF}
          size="lg"
          event="book_audit_click"
          eventProps={{ page: "operations-audit-close" }}
        >
          Book your free audit
        </Button>
        <Button href="/how-it-works" variant="secondary" size="lg">
          See how Vyso works
        </Button>
      </div>
    </Section>
  );
}

export default AuditClose;

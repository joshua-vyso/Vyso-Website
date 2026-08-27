import { Button } from "@/components/vyso/Button";
import { Section } from "@/components/vyso/Section";

/* ── The close ───────────────────────────────────────────────────────────────
   The page's ONE dark band, and the last thing on it (plan §4: one per page,
   and it is the closing CTA).

   A reader who has come this far knows the mechanism. What is left is the one
   thing they cannot work out from a page: which part of their own operation is
   worth starting with. So the heading asks that, and the CTA is the free thing
   that answers it.

   The buttons need no `tone` prop: `data-vy-ground="dark"` re-points the ramp
   underneath them. */

export function HowClose() {
  return (
    <Section
      id="start"
      ground="dark"
      spacing="loose"
      align="center"
      heading="Which part of your operation would we start with?"
      lead="That is what the audit answers, and it is free. About an hour, a written report, and no obligation to build anything afterwards."
    >
      <div className="flex flex-col items-center justify-center gap-[14px] sm:flex-row sm:gap-[20px]">
        <Button
          href="/operations-audit"
          size="lg"
          event="book_audit_click"
          eventProps={{ page: "how-it-works-close" }}
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

export default HowClose;

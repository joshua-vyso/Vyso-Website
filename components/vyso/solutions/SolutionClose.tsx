import { Button } from "@/components/vyso/Button";
import { Section } from "@/components/vyso/Section";

/* ── The close ────────────────────────────────────────────────────────────────
   Plan §7.4 item 8: "audit CTA close (the page's one dark section)". Same
   shape as `components/vyso/home/HomeClose.tsx` — the system's one
   `ground="dark"` budget per page, spent here and nowhere else on a solution
   page. `page` is the analytics prop so `book_audit_click` can tell a
   solution-page click from a homepage one. */

export function SolutionClose({ page }: { page: string }) {
  return (
    <Section
      id="start"
      ground="dark"
      spacing="loose"
      align="center"
      heading="Find out what this is costing you."
      lead="The operations audit is free, and it ends in a diagnosis, not a quote."
    >
      <div className="flex flex-col items-center justify-center gap-[14px] sm:flex-row sm:gap-[20px]">
        <Button href="/operations-audit" size="lg" event="book_audit_click" eventProps={{ page }}>
          Get a free Operations Audit
        </Button>
        <Button href="/contact" variant="secondary" size="lg">
          Talk to Vyso
        </Button>
      </div>
    </Section>
  );
}

export default SolutionClose;

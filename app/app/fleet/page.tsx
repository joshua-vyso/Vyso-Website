import { PhaseStub } from '@/components/platform/PhaseStub';

/**
 * Fleet — the nav row, ahead of the screen
 * (`.ai/plan_phase0_teardown_shell.md` Task E3; built in Phase 5 of `PLAN.md`).
 *
 * NO LINKS: `fl_*` is all-new, and nothing in the platform tracks a vehicle
 * today. An empty "Working today" list is the correct output of this stub's own
 * rule — see PhaseStub.
 */
export default function FleetPage() {
  return (
    <PhaseStub
      icon="dash"
      title="Fleet"
      description="The vehicles, what they cost to run, and when they are next due"
      phase={5}
      lede="Vehicles, fuel, services, licences and repairs — entered by hand or read off the invoices and slips you already upload, so a tyre bill lands against the bakkie rather than in a folder."
    />
  );
}

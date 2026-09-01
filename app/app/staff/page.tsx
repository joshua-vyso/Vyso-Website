import { PhaseStub } from '@/components/platform/PhaseStub';

/**
 * Staff — the nav row, ahead of the screen
 * (`.ai/plan_phase0_teardown_shell.md` Task E3; built in Phase 5 of `PLAN.md`).
 *
 * ShiftBoard is linked because its people and leave screens are real and in
 * use; wages and loans (`st_*`) are the part that does not exist yet, which is
 * why the lede names them separately rather than implying the link covers them.
 */
export default function StaffPage() {
  return (
    <PhaseStub
      icon="shift"
      title="Staff"
      description="Who works here, when, and what they are owed"
      phase={5}
      lede="Wages, advances and loans join the people and leave records that already exist, so a payslip and a shift are two views of the same person rather than two systems."
      links={[
        { label: 'ShiftBoard', href: '/app/shiftboard', note: 'People, shifts and leave as they work today' },
      ]}
    />
  );
}

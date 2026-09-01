import { PhaseStub } from '@/components/platform/PhaseStub';

/**
 * Compliance — the nav row, ahead of the screen
 * (`.ai/plan_phase0_teardown_shell.md` Task E3; built in Phase 5 of `PLAN.md`).
 *
 * NO LINKS: `cp_documents` is all-new. Certificates and licences that have been
 * uploaded already are filed in Doc-U like any other document, but nothing
 * tracks their EXPIRY, which is the entire point of this section — so the stub
 * does not link there and imply otherwise.
 */
export default function CompliancePage() {
  return (
    <PhaseStub
      icon="dash"
      title="Compliance"
      description="The certificates and licences the business has to keep current"
      phase={5}
      lede="Every document with an expiry date in one list — health certificates, licences, insurance, registrations — with the date watched for you instead of remembered."
    />
  );
}

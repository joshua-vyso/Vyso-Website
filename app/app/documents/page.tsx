import { PhaseStub } from '@/components/platform/PhaseStub';

/**
 * Documents — the nav row, ahead of the screen
 * (`.ai/plan_phase0_teardown_shell.md` Task E3; built in Phase 2 of `PLAN.md`).
 *
 * Doc-U is the one old module whose whole job survives more or less intact, so
 * this stub is the shortest of the seven: everything it will do, `/app/docu`
 * does today, and the link says so.
 */
export default function DocumentsPage() {
  return (
    <PhaseStub
      icon="docu"
      title="Documents"
      description="Every piece of paper the business has been sent, filed by what it is about"
      phase={2}
      lede="This becomes the document hub, organised by domain — stock, sales, expenses, staff, fleet, compliance — instead of by which module happened to file it. The viewer and the extraction behind it do not change."
      links={[
        { label: 'Doc-U', href: '/app/docu', note: 'The current inbox, folders and document viewer' },
        { label: 'Upload a document', href: '/app/docu/upload', note: 'The same destination as the Upload button above' },
      ]}
    />
  );
}

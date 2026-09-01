import { PhaseStub } from '@/components/platform/PhaseStub';

/**
 * Services & Expenses — the nav row, ahead of the screen
 * (`.ai/plan_phase0_teardown_shell.md` Task E3; built in Phase 4 of `PLAN.md`).
 *
 * NO LINKS, and that is the honest answer. Expense receipts are already
 * EXTRACTED — `expense_receipt` is a document type with its own pile in the
 * Review queue — but there is no screen that lists what the business spends,
 * because `ex_expenses` does not exist yet. Linking to Doc-U's flagged list
 * instead would be pointing at the paperwork and calling it the ledger.
 */
export default function ExpensesPage() {
  return (
    <PhaseStub
      icon="dash"
      title="Services & Expenses"
      description="What the business spends outside of stock"
      phase={4}
      lede="Bank statements read line by line, and every till slip, service call and subscription against them — a spend ledger rather than a pile of receipts. Receipts you upload today are already read and filed; they are waiting for this screen to be counted on."
    />
  );
}

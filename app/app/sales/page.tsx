import { PhaseStub } from '@/components/platform/PhaseStub';

/**
 * Sales & Customers — the nav row, ahead of the screen
 * (`.ai/plan_phase0_teardown_shell.md` Task E3; built in Phase 3 of `PLAN.md`).
 *
 * The three links are OrderFlow's live screens, which keep working by URL
 * throughout the transition.
 */
export default function SalesPage() {
  return (
    <PhaseStub
      icon="margin"
      title="Sales & Customers"
      description="Who buys from you, what they owe, and what you sent them"
      phase={3}
      lede="Orders, invoices, quotes, price lists and a customer hub with balances land here, with a tab for the orders still waiting to be checked before they become invoices."
      links={[
        { label: 'Orders', href: '/app/orderflow/orders', note: 'Everything ordered, by customer and date' },
        { label: 'Invoices', href: '/app/orderflow/invoices', note: 'What has been billed, and what is unpaid' },
        { label: 'Customers', href: '/app/orderflow/customers', note: 'Contacts, terms and trading history' },
      ]}
    />
  );
}

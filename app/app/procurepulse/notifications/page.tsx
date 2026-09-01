import { redirect } from 'next/navigation';

/** Redirect only: module-local notifications went with the module (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock');
}

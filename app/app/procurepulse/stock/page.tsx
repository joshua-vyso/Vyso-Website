import { redirect } from 'next/navigation';

/** Redirect only: Live stock is the Stock tab (`.ai/plan_stock_suppliers_page.md`). */
export default function Page() {
  redirect('/app/stock/levels');
}

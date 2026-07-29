'use client';

import { useRealtimeRefresh } from '@/lib/platform/useRealtimeRefresh';

/**
 * PricePilot live mount. Every PricePilot screen is server-rendered from the same
 * three sources — the base price list, its margin overrides, and realized sales —
 * so a published re-price or a freshly invoiced order re-renders the tab you're
 * on instead of going quietly stale. Rendered once from the module layout.
 */
export function PricePilotLive() {
  useRealtimeRefresh(['pl_price_lists', 'pl_overrides', 'of_orders']);
  return null;
}

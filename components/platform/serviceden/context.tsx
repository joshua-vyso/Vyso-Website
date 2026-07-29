'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ServiceDenData, SdCustomer } from '@/lib/platform/serviceden';
import { useRealtimeRefresh } from '@/lib/platform/useRealtimeRefresh';

/**
 * ServiceDen is inbox-shaped: mail arrives from the Gmail sync (a background
 * write, not a user action), so the pipeline has to move on its own or it is
 * silently stale. Subscribing here — the one client component wrapping every
 * tab — keeps the leads board, thread view and activity timeline live without a
 * mount per page. Requires supabase/serviceden-realtime.sql to have been run.
 */
const REALTIME_TABLES = ['sd_leads', 'sd_mail_messages', 'sd_lead_activities'] as const;

interface ServiceDenCtx extends ServiceDenData {
  customerById: (id: string | null | undefined) => SdCustomer | undefined;
}

const Ctx = createContext<ServiceDenCtx | null>(null);

export function ServiceDenProvider({ data, children }: { data: ServiceDenData; children: ReactNode }) {
  useRealtimeRefresh(REALTIME_TABLES);
  const value = useMemo<ServiceDenCtx>(() => {
    const byId = new Map(data.customers.map((c) => [c.id, c]));
    return { ...data, customerById: (id) => (id ? byId.get(id) : undefined) };
  }, [data]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useServiceDen(): ServiceDenCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useServiceDen must be used within a ServiceDenProvider');
  return ctx;
}

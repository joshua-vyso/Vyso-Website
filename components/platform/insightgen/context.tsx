'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { InsightGenBrain } from '@/lib/platform/insightgen-data';

interface InsightGenCtx extends InsightGenBrain {
  /** True when this org has no rows in any source module and no seeded insights. */
  isEmpty: boolean;
  /** Create-report modal, opened from the module header on any tab. */
  createOpen: boolean;
  openCreate: () => void;
  closeCreate: () => void;
}

const Ctx = createContext<InsightGenCtx | null>(null);

export function InsightGenProvider({ data, children }: { data: InsightGenBrain; children: ReactNode }) {
  const [createOpen, setCreateOpen] = useState(false);

  const value = useMemo<InsightGenCtx>(
    () => ({
      ...data,
      isEmpty: !data.hasData,
      createOpen,
      openCreate: () => setCreateOpen(true),
      closeCreate: () => setCreateOpen(false),
    }),
    [data, createOpen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInsightGen(): InsightGenCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useInsightGen must be used within an InsightGenProvider');
  return ctx;
}

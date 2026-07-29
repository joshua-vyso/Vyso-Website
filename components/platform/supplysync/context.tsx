'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Supplier, SupplySyncData } from '@/lib/platform/supplysync-data';

/** Max suppliers that can be compared side by side. */
export const MAX_COMPARE = 3;

interface SupplySyncCtx extends SupplySyncData {
  isEmpty: boolean;
  supplierById: (id: string | null | undefined) => Supplier | undefined;
  // Supplier profile drawer (opened from any tab).
  profileId: string | null;
  openProfile: (id: string) => void;
  closeProfile: () => void;
  // Compare tray (2–3 suppliers).
  compareIds: string[];
  isComparing: (id: string) => boolean;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;
  compareOpen: boolean;
  openCompare: () => void;
  closeCompare: () => void;
  // Add-supplier wizard.
  addOpen: boolean;
  openAdd: () => void;
  closeAdd: () => void;
  // Log-a-credit modal (openable from any tab, optionally pre-filled with a supplier).
  creditOpen: boolean;
  creditSupplierId: string | null;
  openCredit: (supplierId?: string | null) => void;
  closeCredit: () => void;
  // Rebate-agreement modal.
  rebateOpen: boolean;
  rebateSupplierId: string | null;
  openRebate: (supplierId?: string | null) => void;
  closeRebate: () => void;
  // Record-a-receipt modal, keyed by the agreement it belongs to.
  receiptRebateId: string | null;
  openReceipt: (rebateId: string) => void;
  closeReceipt: () => void;
}

const Ctx = createContext<SupplySyncCtx | null>(null);

export function SupplySyncProvider({ data, children }: { data: SupplySyncData; children: ReactNode }) {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditSupplierId, setCreditSupplierId] = useState<string | null>(null);
  const [rebateOpen, setRebateOpen] = useState(false);
  const [rebateSupplierId, setRebateSupplierId] = useState<string | null>(null);
  const [receiptRebateId, setReceiptRebateId] = useState<string | null>(null);

  const byId = useMemo(() => new Map(data.suppliers.map((s) => [s.id, s])), [data.suppliers]);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev; // cap; ignore beyond the max
      return [...prev, id];
    });
  }, []);

  const value = useMemo<SupplySyncCtx>(
    () => ({
      ...data,
      isEmpty: data.suppliers.length === 0,
      supplierById: (id) => (id ? byId.get(id) : undefined),
      profileId,
      openProfile: (id) => setProfileId(id),
      closeProfile: () => setProfileId(null),
      compareIds,
      isComparing: (id) => compareIds.includes(id),
      toggleCompare,
      clearCompare: () => setCompareIds([]),
      compareOpen,
      openCompare: () => setCompareOpen(true),
      closeCompare: () => setCompareOpen(false),
      addOpen,
      openAdd: () => setAddOpen(true),
      closeAdd: () => setAddOpen(false),
      creditOpen,
      creditSupplierId,
      openCredit: (supplierId = null) => {
        setCreditSupplierId(supplierId);
        setCreditOpen(true);
      },
      closeCredit: () => setCreditOpen(false),
      rebateOpen,
      rebateSupplierId,
      openRebate: (supplierId = null) => {
        setRebateSupplierId(supplierId);
        setRebateOpen(true);
      },
      closeRebate: () => setRebateOpen(false),
      receiptRebateId,
      openReceipt: (rebateId: string) => setReceiptRebateId(rebateId),
      closeReceipt: () => setReceiptRebateId(null),
    }),
    [
      data,
      byId,
      profileId,
      compareIds,
      compareOpen,
      addOpen,
      toggleCompare,
      creditOpen,
      creditSupplierId,
      rebateOpen,
      rebateSupplierId,
      receiptRebateId,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSupplySync(): SupplySyncCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSupplySync must be used within a SupplySyncProvider');
  return ctx;
}

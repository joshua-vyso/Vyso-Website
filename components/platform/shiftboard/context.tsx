'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  deptColor,
  openShiftKey,
  type Employee,
  type OpenShift,
  type RosterRow,
  type ShiftBoardData,
} from '@/lib/platform/shiftboard';

/** A roster cell addressed the way the UI thinks about it: a person and a day. */
export interface CellRef {
  employeeId: string;
  dayIdx: number;
}

interface ShiftBoardCtx extends ShiftBoardData {
  /** Department colour resolved against the org's departments. */
  deptColor: (name: string) => string;
  /** True when the org has no people data yet (render empty states). */
  isEmpty: boolean;

  // Lookups shared by every tab and overlay.
  employeeById: (id: string | null | undefined) => Employee | undefined;
  rowFor: (employeeId: string, name?: string) => RosterRow | undefined;
  openShiftByKey: (key: string | null | undefined) => OpenShift | undefined;

  // Shift editor (create / edit / assign a single cell).
  editing: CellRef | null;
  openEditor: (employeeId: string, dayIdx: number) => void;
  closeEditor: () => void;

  // Cover finder for an open shift (call-out or ordinary gap).
  coveringKey: string | null;
  openCover: (key: string) => void;
  closeCover: () => void;

  // Swap & cover centre.
  swapsOpen: boolean;
  openSwaps: () => void;
  closeSwaps: () => void;

  // "Offer this shift" draft, started from a roster cell.
  swapDraft: CellRef | null;
  openSwapDraft: (employeeId: string, dayIdx: number) => void;
  closeSwapDraft: () => void;
}

const Ctx = createContext<ShiftBoardCtx | null>(null);

export function ShiftBoardProvider({ data, children }: { data: ShiftBoardData; children: ReactNode }) {
  const [editing, setEditing] = useState<CellRef | null>(null);
  const [coveringKey, setCoveringKey] = useState<string | null>(null);
  const [swapsOpen, setSwapsOpen] = useState(false);
  const [swapDraft, setSwapDraft] = useState<CellRef | null>(null);

  const employeeIndex = useMemo(() => new Map(data.employees.map((e) => [e.id, e])), [data.employees]);
  const rowIndex = useMemo(() => {
    const byId = new Map<string, RosterRow>();
    const byName = new Map<string, RosterRow>();
    for (const r of data.roster.rows) {
      if (r.employeeId) byId.set(r.employeeId, r);
      byName.set(r.name, r);
    }
    return { byId, byName };
  }, [data.roster.rows]);
  const openIndex = useMemo(() => new Map(data.roster.openShifts.map((o) => [openShiftKey(o), o])), [data.roster.openShifts]);

  const openEditor = useCallback((employeeId: string, dayIdx: number) => setEditing({ employeeId, dayIdx }), []);
  const openSwapDraft = useCallback((employeeId: string, dayIdx: number) => setSwapDraft({ employeeId, dayIdx }), []);

  const value = useMemo<ShiftBoardCtx>(
    () => ({
      ...data,
      deptColor: (name: string) => deptColor(name, data.departments),
      isEmpty: data.employees.length === 0,
      employeeById: (id) => (id ? employeeIndex.get(id) : undefined),
      rowFor: (employeeId, name) => rowIndex.byId.get(employeeId) ?? (name ? rowIndex.byName.get(name) : undefined),
      openShiftByKey: (key) => (key ? openIndex.get(key) : undefined),
      editing,
      openEditor,
      closeEditor: () => setEditing(null),
      coveringKey,
      openCover: (key: string) => setCoveringKey(key),
      closeCover: () => setCoveringKey(null),
      swapsOpen,
      openSwaps: () => setSwapsOpen(true),
      closeSwaps: () => setSwapsOpen(false),
      swapDraft,
      openSwapDraft,
      closeSwapDraft: () => setSwapDraft(null),
    }),
    [data, employeeIndex, rowIndex, openIndex, editing, coveringKey, swapsOpen, swapDraft, openEditor, openSwapDraft],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShiftBoard(): ShiftBoardCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useShiftBoard must be used within a ShiftBoardProvider');
  return ctx;
}

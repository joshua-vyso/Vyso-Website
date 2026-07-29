'use client';

import { useMemo, useState } from 'react';
import { zar } from '@/lib/platform/orderflow';
import { useToast } from '@/components/platform/orderflow/ui';
import { SectionCard, InteractiveDonut, ProgressRing, Badge } from '@/components/platform/module-ui';
import { AreaChart, Sparkline } from '@/components/platform/procurepulse/ui';
import { HEATMAP_DAYS, TIME_PERIODS, type TimePeriod, type WasteCategoryRow, type CoachingNote } from '@/lib/platform/wastewatch';
import { TrendArrow, EmptyState, EmptyPanel } from './shared';
import { useWasteWatch, CategoryModal } from './categories';

/** Full weekday names for the prose callouts. */
const DAY_FULL: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

const COACH_TONE: Record<CoachingNote['tone'], { label: string; tone: 'positive' | 'warning' | 'neutral'; color: string }> = {
  praise: { label: 'Doing well', tone: 'positive', color: '#0F6E56' },
  coach: { label: 'Worth a refresher', tone: 'warning', color: '#854F0B' },
  watch: { label: 'Keep an eye', tone: 'neutral', color: '#6B6F68' },
};

export function WasteAnalytics() {
  const { node, show } = useToast();
  const ww = useWasteWatch();
  const { categories, removeCategory } = ww;
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [modal, setModal] = useState<{ open: boolean; mode: 'create' | 'edit'; category: WasteCategoryRow | null }>({ open: false, mode: 'create', category: null });
  const activeKey = hovered ?? selected;

  // Category stats are recomputed from ww_waste_events at read time, so the
  // doughnut always sums to exactly what the Waste log shows. The legend lists
  // every category (0-cost → "no waste yet").
  const visible = useMemo(() => categories.filter((c) => c.cost > 0), [categories]);
  const total = visible.reduce((s, c) => s + c.cost, 0);
  const pctOf = (cost: number) => (total ? Math.round((cost / total) * 100) : 0);
  const activeCat = categories.find((c) => c.id === activeKey && c.cost > 0) ?? null;
  const selectedCat = categories.find((c) => c.id === selected && c.cost > 0) ?? null;

  const emp = ww.employeeStats;
  const recipes = ww.recipeStats;
  const maxEmp = Math.max(1, ...emp.map((e) => e.cost));
  const prevTotal = ww.preventable.preventable + ww.preventable.unavoidable;
  const prevPct = prevTotal ? Math.round((ww.preventable.preventable / prevTotal) * 100) : 0;

  const days = ww.dayPatterns;
  const maxDay = Math.max(1, ...days.map((d) => d.cost));
  const worstDay = days.length ? days.reduce((a, b) => (b.cost > a.cost ? b : a)) : null;
  const overPortion = ww.overPortion;
  const coaching = ww.coaching;

  if (ww.events.length === 0 && categories.length === 0) {
    return (
      <EmptyState
        title="Nothing to analyse yet"
        hint="Once waste is logged, this tab breaks it down by category, reason code, recipe portioning, person and day of the week — and tells you which of it was avoidable."
      />
    );
  }

  return (
    <div className="space-y-5">
      {node}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Analytics</h1>
          <p className="mt-1.5 text-[14px] text-[#8A8E86]">Patterns by category, reason code, recipe, person and time</p>
        </div>
        {selectedCat ? (
          <button type="button" onClick={() => setSelected(null)} className="text-[13px] font-semibold text-[#1F5FA8] hover:underline">Focus: {selectedCat.name} · clear</button>
        ) : null}
      </div>

      {/* Waste by category */}
      <SectionCard
        title="Waste by category"
        right={
          <button type="button" onClick={() => setModal({ open: true, mode: 'create', category: null })} className="inline-flex h-9 items-center rounded-[10px] border border-[#E2E6EC] bg-white px-3.5 text-[13px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87]">+ New category</button>
        }
      >
        {categories.length === 0 ? (
          <EmptyPanel>No waste categories yet — create one to start grouping waste your own way.</EmptyPanel>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[auto_1fr]">
            <div className="flex justify-center">
              <InteractiveDonut
                segments={visible.map((c) => ({ key: c.id, value: c.cost, color: c.color }))}
                activeKey={activeKey}
                onHover={setHovered}
                onSelect={(k) => setSelected((s) => (s === k ? null : k))}
                size={200}
                center={
                  activeCat ? (
                    <>
                      <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">{activeCat.name}</span>
                      <span className="of-num mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{zar(activeCat.cost)}</span>
                      <span className="of-num mt-1 text-[11px] text-[#A0A49C]">{pctOf(activeCat.cost)}%</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Total waste</span>
                      <span className="of-num mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{zar(total)}</span>
                    </>
                  )
                }
              />
            </div>
            <div className="flex flex-col justify-center gap-0.5">
              {categories.map((cat) => {
                const isActive = activeKey === cat.id;
                const has = cat.cost > 0;
                return (
                  <div key={cat.id} className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${isActive ? 'bg-[#F5F9FE]' : ''}`}>
                    {has ? (
                      <button type="button" onMouseEnter={() => setHovered(cat.id)} onMouseLeave={() => setHovered(null)} onClick={() => setSelected((s) => (s === cat.id ? null : cat.id))} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left">
                        <span className="flex items-center gap-2 text-[14px] text-[#171A17]">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                          {cat.derived ? <Badge label="from the log" tone="info" /> : null}
                        </span>
                        <span className="flex items-center gap-3">
                          <Sparkline data={cat.trend} color={cat.color} width={56} height={20} />
                          <span className="of-num w-16 text-right text-[14px] font-semibold text-[#171A17]">{zar(cat.cost)}</span>
                          <span className="of-num w-9 text-right text-[12px] text-[#A0A49C]">{pctOf(cat.cost)}%</span>
                        </span>
                      </button>
                    ) : (
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-[14px] text-[#171A17]"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />{cat.name}</span>
                        <span className="text-[12px] text-[#A0A49C]">No waste logged yet</span>
                      </div>
                    )}
                    {/* Rows synthesised from the log have no ww_waste_categories row to edit. */}
                    {cat.derived ? null : (
                      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
                        <button type="button" onClick={() => setModal({ open: true, mode: 'edit', category: cat })} aria-label={`Edit ${cat.name}`} className="flex h-6 w-6 items-center justify-center rounded text-[#8A8E86] hover:text-[#171A17]" title="Edit">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                        </button>
                        <button type="button" onClick={() => { removeCategory(cat.id); show(`Removed “${cat.name}”`); }} aria-label={`Remove ${cat.name}`} className="flex h-6 w-6 items-center justify-center rounded text-[12px] text-[#8A8E86] hover:text-[#A32D2D]" title="Remove">✕</button>
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="mt-2 px-2 text-[11px] text-[#A0A49C]">Totals are recomputed from the waste log on every load, so this always matches the Waste log tab.</p>
            </div>
          </div>
        )}
      </SectionCard>

      {/* ----------------------------------------------------------------- */}
      {/* Reason-code insights                                              */}
      {/* ----------------------------------------------------------------- */}

      <SectionCard title="Over-portioning by recipe" right={<span className="text-[12px] text-[#A0A49C]">actual qty vs recipe expectation</span>}>
        {overPortion.length === 0 ? (
          <EmptyPanel>No event has exceeded its recipe&rsquo;s expected quantity yet. Log waste against a recipe with an expected quantity and over-portioning will be measured here.</EmptyPanel>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-[#EEF1F5] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                    <th className="py-2 pr-2 text-left font-medium">Recipe</th>
                    <th className="px-2 py-2 text-right font-medium">Expected</th>
                    <th className="px-2 py-2 text-right font-medium">Actual</th>
                    <th className="px-2 py-2 text-right font-medium">Over by</th>
                    <th className="px-2 py-2 text-right font-medium">Excess cost</th>
                    <th className="py-2 pl-2 text-right font-medium">Events</th>
                  </tr>
                </thead>
                <tbody>
                  {overPortion.map((r) => (
                    <tr key={r.recipe} className="border-b border-[#F4F5F7] last:border-0">
                      <td className="py-3 pr-2 font-semibold text-[#171A17]">{r.recipe}</td>
                      <td className="of-num px-2 py-3 text-right text-[#6B6F68]">{r.expectedQty} {r.unit}</td>
                      <td className="of-num px-2 py-3 text-right text-[#2C333B]">{r.actualQty} {r.unit}</td>
                      <td className="of-num px-2 py-3 text-right font-semibold" style={{ color: r.overPct >= 40 ? '#A32D2D' : r.overPct >= 20 ? '#854F0B' : '#0F6E56' }}>+{r.overPct}%</td>
                      <td className="of-num px-2 py-3 text-right font-semibold text-[#A32D2D]">{zar(r.excessCost)}</td>
                      <td className="of-num py-3 pl-2 text-right text-[#A0A49C]">{r.events}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2.5 text-[12px] text-[#A0A49C]">Excess cost counts only the quantity above the recipe spec — the part that tighter portioning actually recovers.</p>
          </>
        )}
      </SectionCard>

      <SectionCard title="Coaching &amp; support" right={<span className="text-[12px] text-[#A0A49C]">preventable waste only</span>}>
        {coaching.length === 0 ? (
          <EmptyPanel>No waste has been attributed to a person yet.</EmptyPanel>
        ) : (
          <>
            <p className="mb-3.5 text-[13px] text-[#6B6F68]">
              Ordered by preventable waste — the part a conversation can change. Unavoidable spoilage is excluded on purpose, so nobody is flagged for produce that arrived past its best.
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {coaching.map((c) => {
                const t = COACH_TONE[c.tone];
                return (
                  <div key={c.name} className="rounded-[14px] border border-[#EEF1F5] bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold text-[#171A17]">{c.name}</span>
                      <Badge label={t.label} tone={t.tone} />
                    </div>
                    <div className="of-num mt-2 text-[13px] text-[#6B6F68]">
                      <span className="font-semibold" style={{ color: t.color }}>{zar(c.preventableCost)}</span> preventable of {zar(c.totalCost)} · {c.events} events ·{' '}
                      <span style={{ color: c.vsTeamPct > 0 ? '#A32D2D' : '#0F6E56' }}>{c.vsTeamPct > 0 ? '+' : ''}{c.vsTeamPct}% vs team</span>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-[#6B6F68]">{c.message}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title="Day-of-week patterns" right={<span className="text-[12px] text-[#A0A49C]">every logged event</span>}>
        {days.length === 0 ? (
          <EmptyPanel>No dated waste events yet.</EmptyPanel>
        ) : (
          <>
            <div className="flex items-end gap-2.5">
              {days.map((d) => (
                <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <span className="of-num text-[11px] font-semibold text-[#171A17]">{d.cost > 0 ? zar(d.cost) : '—'}</span>
                  <div className="flex h-28 w-full items-end overflow-hidden rounded-[10px] bg-[#F4F5F7]">
                    <div className="relative w-full rounded-[10px] bg-[#D8DFE8]" style={{ height: `${(d.cost / maxDay) * 100}%`, transition: 'height 0.6s ease' }}>
                      <div className="absolute inset-x-0 bottom-0 rounded-b-[10px] bg-[#854F0B]" style={{ height: d.cost > 0 ? `${(d.preventable / d.cost) * 100}%` : '0%' }} />
                    </div>
                  </div>
                  <span className="text-[12px] font-medium text-[#6B6F68]">{d.day}</span>
                  <span className="of-num text-[11px] text-[#A0A49C]">{d.events}×</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-[#A0A49C]">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#854F0B]" /> preventable</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#D8DFE8]" /> unavoidable</span>
            </div>
            {worstDay && worstDay.cost > 0 ? (
              <p className="mt-2.5 text-[12px] text-[#6B6F68]">
                {DAY_FULL[worstDay.day] ?? worstDay.day} carries the most waste at <span className="of-num font-medium text-[#171A17]">{zar(worstDay.cost)}</span>
                {worstDay.preventable > 0 ? <>, of which <span className="of-num font-medium text-[#854F0B]">{zar(worstDay.preventable)}</span> was avoidable — worth tightening that day&rsquo;s prep and ordering.</> : '.'}
              </p>
            ) : null}
          </>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Leaderboard */}
        <SectionCard title="Waste by employee" right={<span className="text-[12px] text-[#A0A49C]">highest → lowest</span>}>
          {emp.length === 0 ? (
            <EmptyPanel>No waste has been attributed to a person yet.</EmptyPanel>
          ) : (
            <div className="flex flex-col gap-3">
              {emp.map((e, i) => (
                <div key={e.name} className="flex items-center gap-3">
                  <span className="of-num w-5 text-[12px] font-semibold text-[#A0A49C]">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[14px]">
                      <span className="truncate font-medium text-[#171A17]">{e.name}</span>
                      <span className="of-num font-semibold text-[#171A17]">{zar(e.cost)} <span className="text-[11px] font-normal text-[#A0A49C]">· {e.events} events</span></span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#EEF1F5]">
                      <div className="h-full rounded-full" style={{ width: `${(e.cost / maxEmp) * 100}%`, backgroundColor: e.vsTeamPct > 0 ? '#A32D2D' : '#0F6E56', transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                  <span className="of-num w-14 text-right text-[12px] font-medium" style={{ color: e.vsTeamPct > 0 ? '#A32D2D' : '#0F6E56' }}><TrendArrow dir={e.trend} /> {e.vsTeamPct > 0 ? '+' : ''}{e.vsTeamPct}%</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Recipe table */}
        <SectionCard title="Waste by recipe" right={<span className="text-[12px] text-[#A0A49C]">optimise portioning</span>}>
          {recipes.length === 0 ? (
            <EmptyPanel>No waste has been logged against a recipe yet.</EmptyPanel>
          ) : (
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-[#EEF1F5] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                  <th className="py-2 pr-2 text-left font-medium">Recipe</th>
                  <th className="px-2 py-2 text-right font-medium">Waste %</th>
                  <th className="px-2 py-2 text-right font-medium">Avg cost</th>
                  <th className="py-2 pl-2 text-right font-medium">Frequency</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((r) => (
                  <tr key={r.recipe} className="border-b border-[#F4F5F7] last:border-0">
                    <td className="py-3 pr-2 font-semibold text-[#171A17]">{r.recipe}</td>
                    <td className="of-num px-2 py-3 text-right font-semibold" style={{ color: r.wastePct >= 18 ? '#A32D2D' : r.wastePct >= 12 ? '#854F0B' : '#0F6E56' }}>{r.wastePct}%</td>
                    <td className="of-num px-2 py-3 text-right text-[#2C333B]">{zar(r.avgCost)}</td>
                    <td className="of-num py-3 pl-2 text-right text-[#A0A49C]">{r.frequency}/mo</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>
      </div>

      {/* Time heatmap */}
      <SectionCard title="Waste by time" right={<span className="text-[12px] text-[#A0A49C]">darker = more waste</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                <th className="px-2 py-2 text-left font-medium" />
                {HEATMAP_DAYS.map((d) => (<th key={d} className="px-2 py-2 text-center font-medium">{d}</th>))}
              </tr>
            </thead>
            <tbody>
              {ww.serviceHeatmap.map((row) => (
                <tr key={row.period}>
                  <td className="px-2 py-1.5 text-[14px] font-medium text-[#171A17]">{row.period}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-1 py-1">
                      <div className="of-num flex h-9 items-center justify-center rounded-[10px] text-[11px] font-semibold" style={{ backgroundColor: `rgba(163,45,45,${(v / 100) * 0.85 + 0.05})`, color: v > 55 ? 'white' : '#6B6F68' }}>{v}</div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2.5 text-[12px] text-[#A0A49C]">
          {ww.heatmapDerived
            ? 'Each cell is that service period’s waste cost as a share of the busiest cell, taken from the logged event times.'
            : 'Illustrative — log waste with a time of day to see your own service-period pattern.'}
        </p>
      </SectionCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Cost trend */}
        <SectionCard title="Cost trend" right={
          <div className="inline-flex rounded-[11px] border border-[#EEF1F5] bg-[#F7F8FA] p-1">
            {TIME_PERIODS.map((p) => (<button key={p.key} type="button" onClick={() => setPeriod(p.key)} className={`rounded-[8px] px-2.5 py-1.5 text-[12px] font-medium transition-colors ${period === p.key ? 'bg-white text-[#171A17] shadow-[0_1px_2px_rgba(20,24,20,0.06)]' : 'text-[#8A8E86] hover:text-[#6B6F68]'}`}>{p.label}</button>))}
          </div>
        }>
          <AreaChart data={ww.timeline[period]} color="#A32D2D" fill="#FCEBEB" height={120} />
          <p className="mt-2 text-[11px] text-[#8A8E86]">{ww.timelineDerived ? 'From the waste log' : 'Illustrative — live once waste is logged'}</p>
        </SectionCard>

        {/* Preventable vs unavoidable */}
        <SectionCard title="Preventable vs unavoidable">
          {prevTotal === 0 ? (
            <EmptyPanel>No waste cost logged yet.</EmptyPanel>
          ) : (
            <div className="flex items-center gap-5">
              <ProgressRing pct={prevPct} color="#854F0B" size={96} thickness={9}>
                <span className="of-num text-[22px] font-semibold tracking-[-0.02em] text-[#854F0B]">{prevPct}%</span>
                <span className="text-[10px] uppercase tracking-[0.05em] text-[#A0A49C]">preventable</span>
              </ProgressRing>
              <div className="flex-1 space-y-3">
                <Bar label="Preventable" value={ww.preventable.preventable} total={prevTotal} color="#854F0B" />
                <Bar label="Unavoidable" value={ww.preventable.unavoidable} total={prevTotal} color="#8A8E86" />
                <p className="of-num text-[12px] text-[#A0A49C]">{zar(ww.preventable.preventable)} of the logged waste cost is avoidable with tighter prep and ordering.</p>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <CategoryModal
        open={modal.open}
        mode={modal.mode}
        category={modal.category}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        onSaved={(n) => show(modal.mode === 'edit' ? `Category “${n}” updated` : `Category “${n}” created`)}
      />
    </div>
  );
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[14px]">
        <span className="text-[#6B6F68]">{label}</span>
        <span className="of-num font-semibold text-[#171A17]">{zar(value)}</span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#EEF1F5]">
        <div className="h-full rounded-full" style={{ width: `${(value / total) * 100}%`, backgroundColor: color, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

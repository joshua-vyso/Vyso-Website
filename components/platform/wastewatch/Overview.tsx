'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zar } from '@/lib/platform/orderflow';
import { useToast } from '@/components/platform/orderflow/ui';
import { ModuleHeader, PrimaryAction, KpiStrip, Kpi, SectionCard, CountUp, Badge, ProgressRing } from '@/components/platform/module-ui';
import { AreaChart } from '@/components/platform/procurepulse/ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { TIME_PERIODS, INSIGHTS, type TimePeriod, type WeeklyReport, type FoodCostContext } from '@/lib/platform/wastewatch';
import { LogWasteModal, MobileWidgets, EmptyState, EmptyPanel } from './shared';
import { useWasteWatch } from './categories';

const M = MODULE_META.wastewatch;

/** '2026-06-29' → '29 Jun'. */
function shortDate(iso: string): string {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function WasteOverview() {
  const router = useRouter();
  const { node, show } = useToast();
  const ww = useWasteWatch();
  const [logOpen, setLogOpen] = useState(false);
  const [period, setPeriod] = useState<TimePeriod>('week');

  const categories = ww.categories;
  // Categories with recorded waste, biggest first — the "top waste sources".
  const visible = useMemo(() => [...categories].filter((c) => c.cost > 0).sort((a, b) => b.cost - a.cost), [categories]);
  const totalCost = categories.reduce((s, c) => s + c.cost, 0);
  const top = visible[0] ?? null;
  const pctOf = (cost: number) => (totalCost ? Math.round((cost / totalCost) * 100) : 0);

  const weekly = ww.weekly;
  const food = ww.foodCost;
  const delta = ww.timelineDelta[period];
  const hasEvents = ww.events.length > 0;

  return (
    <div className="space-y-5">
      {node}
      <ModuleHeader icon={M.icon} title={M.name} description="What's being wasted, why, by whom — and how to lose less of it." actions={<PrimaryAction onClick={() => setLogOpen(true)}>+ Log waste</PrimaryAction>} />

      {!hasEvents ? (
        <EmptyState
          title="No waste logged yet"
          hint="Log your first waste event — or pair a scale on the Devices tab — and WasteWatch will start costing it, splitting preventable from unavoidable, and showing what it does to your food cost."
          action={<PrimaryAction onClick={() => setLogOpen(true)}>+ Log waste</PrimaryAction>}
        />
      ) : (
        <>
          <KpiStrip>
            <Kpi label="Waste cost" value={zar(totalCost)} accent="#A32D2D" sub={weekly ? `logged to ${shortDate(weekly.end)}` : 'all logged waste'} />
            <Kpi label="Preventable" value={zar(ww.preventable.preventable)} accent="#854F0B" sub="avoidable" />
            <Kpi
              label="Waste %"
              value={food.pct != null ? `${food.pct}%` : '—'}
              accent={food.pct != null && food.pct >= 4 ? '#A32D2D' : undefined}
              sub={food.pct != null ? 'of food cost' : 'food cost unknown'}
            />
            <Kpi label="Top category" value={top ? top.name : '—'} sub={top ? `${pctOf(top.cost)}% of waste` : 'no categories'} />
            <Kpi label="Waste events" value={String(ww.events.length)} sub="logged" />
          </KpiStrip>

          {/* ------------------------------------------------------------- */}
          {/* Weekly waste report — the loop-closing card                    */}
          {/* ------------------------------------------------------------- */}
          <SectionCard
            title="Weekly waste report"
            right={
              weekly ? (
                <span className="flex items-center gap-2">
                  <span className="of-num text-[12px] text-[#A0A49C]">{shortDate(weekly.start)} – {shortDate(weekly.end)}</span>
                  {weekly.stale ? <Badge label="Log has gone quiet" tone="warning" /> : null}
                </span>
              ) : undefined
            }
          >
            {weekly ? <WeeklyReportBody weekly={weekly} food={food} /> : <EmptyPanel>Not enough logged events yet to build a weekly report.</EmptyPanel>}
          </SectionCard>

          {/* Cost timeline */}
          <SectionCard
            title="Waste cost timeline"
            right={
              <div className="inline-flex rounded-[11px] border border-[#EEF1F5] bg-[#F7F8FA] p-1">
                {TIME_PERIODS.map((p) => (
                  <button key={p.key} type="button" onClick={() => setPeriod(p.key)} className={`rounded-[8px] px-3 py-1.5 text-[12px] font-medium transition-colors ${period === p.key ? 'bg-white text-[#171A17] shadow-[0_1px_2px_rgba(20,24,20,0.06)]' : 'text-[#8A8E86] hover:text-[#6B6F68]'}`}>{p.label}</button>
                ))}
              </div>
            }
          >
            <AreaChart data={ww.timeline[period]} color="#A32D2D" fill="#FCEBEB" height={120} />
            <p className="mt-2.5 text-[12px] text-[#A0A49C]">
              {ww.timelineDerived ? 'Cost of waste over the selected period, straight from the log' : 'Illustrative — log waste to see your own curve'}
              {delta != null ? (
                <> — <span className="of-num font-medium" style={{ color: delta > 0 ? '#A32D2D' : '#0F6E56' }}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}%</span> vs the previous one.</>
              ) : '.'}
            </p>
          </SectionCard>

          {/* Top waste sources */}
          <div>
            <h2 className="of-display mb-2.5 text-[16px] font-semibold text-[#171A17]">Top waste sources</h2>
            {visible.length === 0 ? (
              <EmptyPanel>No category has recorded waste yet.</EmptyPanel>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {visible.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => router.push(`/app/wastelog/log?category=${encodeURIComponent(cat.name)}`)}
                    className="rounded-[14px] border border-[#EEF1F5] bg-white p-4 text-left shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-all hover:-translate-y-0.5 hover:border-[#C9DEF7] hover:shadow-[0_6px_18px_-10px_rgba(20,24,20,0.28)]"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-[12px] font-medium text-[#171A17]">{cat.name}</span>
                    </div>
                    <CountUp value={cat.cost} format={(n) => zar(n)} className="of-num mt-2.5 block text-[22px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]" />
                    <div className="of-num mt-1.5 text-[12px] text-[#A0A49C]">{pctOf(cat.cost)}% of waste</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* AI recommendations */}
      <SectionCard title="AI recommendations" right={<span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1F5FA8]">✦ auto-generated soon</span>}>
        <div className="flex flex-col gap-2.5">
          {INSIGHTS.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center gap-2.5 text-[14px]">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F5FA8]" />
              <span className="min-w-0 flex-1 text-[#171A17]">{i.text}</span>
              {i.module ? (
                <Link href={MODULE_META[i.module].route} className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: MODULE_META[i.module].accent.bg, color: MODULE_META[i.module].accent.fg }}>{MODULE_META[i.module].name} →</Link>
              ) : null}
            </div>
          ))}
        </div>
      </SectionCard>

      <MobileWidgets onAction={() => setLogOpen(true)} />

      <LogWasteModal open={logOpen} onClose={() => setLogOpen(false)} onSaved={() => show('Waste logged')} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekly report body
// ---------------------------------------------------------------------------

function WeeklyReportBody({ weekly, food }: { weekly: WeeklyReport; food: FoodCostContext }) {
  const worseThanLastWeek = weekly.deltaPct != null && weekly.deltaPct > 0;

  return (
    <div className="space-y-5">
      {/* Headline row */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-5">
          <ProgressRing pct={weekly.preventablePct} color="#854F0B" size={96} thickness={9}>
            <span className="of-num text-[22px] font-semibold tracking-[-0.02em] text-[#854F0B]">{weekly.preventablePct}%</span>
            <span className="text-[10px] uppercase tracking-[0.05em] text-[#A0A49C]">preventable</span>
          </ProgressRing>
          <div>
            <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Waste this week</div>
            <div className="of-num mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.02em] text-[#171A17]">{zar(weekly.total)}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
              {weekly.deltaPct != null ? (
                <span className="of-num font-medium" style={{ color: worseThanLastWeek ? '#A32D2D' : '#0F6E56' }}>
                  {worseThanLastWeek ? '▲' : '▼'} {Math.abs(weekly.deltaPct)}% vs last week
                </span>
              ) : (
                <span className="text-[#A0A49C]">No prior week to compare</span>
              )}
              <span className="of-num text-[#A0A49C]">· {weekly.events} events · {zar(weekly.preventable)} avoidable</span>
            </div>
          </div>
        </div>

        {/* Waste-in-margin loop */}
        <div className="rounded-[14px] border border-[#EAF2FC] bg-[#F5F9FE] p-4">
          <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-[#8A8E86]">Waste as a share of food cost</div>
          {food.pct != null ? (
            <>
              <div className="of-num mt-1.5 text-[28px] font-semibold leading-none tracking-[-0.02em]" style={{ color: food.pct >= 4 ? '#A32D2D' : '#171A17' }}>{food.pct}%</div>
              <p className="mt-2 text-[12px] leading-relaxed text-[#6B6F68]">
                <span className="of-num font-medium text-[#171A17]">{zar(food.wastePerDay)}</span> of waste a day against{' '}
                <span className="of-num font-medium text-[#171A17]">{zar(food.foodCostPerDay)}</span> of food cost a day — measured from {food.basisLabel}.
              </p>
              <p className="mt-1.5 text-[12px] text-[#A0A49C]">At this rate that is <span className="of-num font-medium text-[#A32D2D]">{zar(food.annualised)}</span> a year, and it is the figure PricePilot attributes margin drift to.</p>
            </>
          ) : (
            <p className="mt-2 text-[13px] leading-relaxed text-[#6B6F68]">{food.basisLabel}.</p>
          )}
        </div>
      </div>

      {/* Causes + items */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <h3 className="of-display mb-2.5 text-[14px] font-semibold text-[#171A17]">Top causes</h3>
          {weekly.topCauses.length === 0 ? (
            <EmptyPanel>No reason codes recorded this week.</EmptyPanel>
          ) : (
            <div className="flex flex-col gap-2">
              {weekly.topCauses.map((c) => (
                <div key={c.reason} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[14px] text-[#171A17]">
                      <span className="truncate font-medium">{c.reason}</span>
                      <Badge label={c.preventable ? 'Preventable' : 'Unavoidable'} tone={c.preventable ? 'warning' : 'neutral'} />
                    </span>
                    <span className="mt-1 block h-2 overflow-hidden rounded-full bg-[#EEF1F5]">
                      <span className="block h-full rounded-full" style={{ width: `${c.pct}%`, backgroundColor: c.preventable ? '#854F0B' : '#8A8E86', transition: 'width 0.6s ease' }} />
                    </span>
                  </span>
                  <span className="of-num w-24 shrink-0 text-right text-[14px] font-semibold text-[#171A17]">
                    {zar(c.cost)}
                    <span className="block text-[11px] font-normal text-[#A0A49C]">{c.pct}% · {c.events}×</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="of-display mb-2.5 text-[14px] font-semibold text-[#171A17]">Costliest items</h3>
          {weekly.topItems.length === 0 ? (
            <EmptyPanel>No items recorded this week.</EmptyPanel>
          ) : (
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-[#EEF1F5] text-[11px] uppercase tracking-[0.06em] text-[#A0A49C]">
                  <th className="py-2 pr-2 text-left font-medium">Item</th>
                  <th className="px-2 py-2 text-left font-medium">Main reason</th>
                  <th className="py-2 pl-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {weekly.topItems.map((i) => (
                  <tr key={i.item} className="border-b border-[#F4F5F7] last:border-0">
                    <td className="py-2.5 pr-2 font-semibold text-[#171A17]">{i.item}</td>
                    <td className="px-2 py-2.5 text-[#6B6F68]">{i.topReason} <span className="of-num text-[11px] text-[#A0A49C]">· {i.events}×</span></td>
                    <td className="of-num py-2.5 pl-2 text-right font-semibold text-[#A32D2D]">{zar(i.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Next steps */}
      <div>
        <h3 className="of-display mb-2.5 text-[14px] font-semibold text-[#171A17]">What to change next week</h3>
        <div className="flex flex-col gap-2">
          {weekly.actions.map((a, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[14px]">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1F5FA8]" />
              <span className="text-[#6B6F68]">{a}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

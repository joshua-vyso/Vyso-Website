"use client";

/* ── Automation scale ────────────────────────────────────────────────────────
   "Start with one task. Go as far as you need." — the page's first pinned
   sequence. Desktop: the stage stays sticky for ~3 viewport heights while a
   horizontal three-stop scale fills with native scroll progress and one stage
   is active at a time; each stage pairs with a clean interface schematic
   (sorted inbox → WhatsApp orders → connected operations system). Mobile and
   reduced-motion render the same three stages as a stacked sequence with a
   vertical progress line — no pinning, no lost content. */

import { useStaticMotion } from "@/components/site/motion-preference";
import { useMediaQuery } from "@/components/site/use-media-query";
import { useActiveIndex, useStickyProgress } from "./scroll";

const STAGES = [
  {
    title: "Automate your inbox",
    body: "Sort messages. Draft replies. Flag what matters.",
    label: "One task",
  },
  {
    title: "Capture every order",
    body: "Turn WhatsApp messages into tracked orders.",
    label: "One workflow",
  },
  {
    title: "Build your operations system",
    body: "Custom software designed around how your business works.",
    label: "Whole operation",
  },
] as const;

/* ── Schematics — quiet interface drawings, not screenshots ───────────────── */

function PanelFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="w-full max-w-[560px] rounded-2xl border border-[#2A2722] bg-[#12100C] p-5 md:p-6">
      <p className="vy-mono mb-4 text-[10px] uppercase tracking-[0.18em] text-ondark-3">{label}</p>
      {children}
    </div>
  );
}

function Bar({ w, tone = "dim" }: { w: string; tone?: "dim" | "mid" | "signal" }) {
  const bg = tone === "signal" ? "bg-signal/70" : tone === "mid" ? "bg-[#4A463C]" : "bg-[#2E2B25]";
  return <span className={`block h-2 rounded-full ${bg}`} style={{ width: w }} />;
}

function InboxSchematic() {
  return (
    <PanelFrame label="Inbox · triaged">
      <div className="grid grid-cols-[minmax(0,5fr)_auto_minmax(0,6fr)] items-center gap-4 md:gap-6">
        <div className="space-y-2.5">
          {["82%", "64%", "91%", "55%", "73%"].map((w, i) => (
            <Bar key={i} w={w} />
          ))}
        </div>
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-ondark-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M4 12h14M13 6l6 6-6 6" />
        </svg>
        <div className="space-y-3">
          {[
            ["Replies drafted", "03", "signal"],
            ["Flagged for you", "02", "mid"],
            ["Filed away", "09", "dim"],
          ].map(([label, count, tone]) => (
            <div key={label as string} className="flex items-center justify-between rounded-lg border border-[#26231D] px-3 py-2">
              <span className="text-xs text-ondark-2">{label}</span>
              <span className={`vy-mono text-xs ${tone === "signal" ? "text-signal-ondark" : "text-ondark-3"}`}>
                {count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PanelFrame>
  );
}

function OrdersSchematic() {
  return (
    <PanelFrame label="WhatsApp → tracked orders">
      <div className="grid grid-cols-[minmax(0,5fr)_auto_minmax(0,6fr)] items-center gap-4 md:gap-6">
        <div className="space-y-2.5">
          {["3 crates butternut pls", "+ 2 spinach", "same as last week"].map((message) => (
            <p key={message} className="w-fit max-w-full rounded-xl rounded-bl-sm bg-[#1E2A22] px-3 py-1.5 text-[11px] leading-snug text-[#B9CDBB]">
              {message}
            </p>
          ))}
        </div>
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-ondark-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M4 12h14M13 6l6 6-6 6" />
        </svg>
        <div className="space-y-2">
          {[
            ["ORD-2214", "Confirmed"],
            ["ORD-2215", "Picking"],
            ["ORD-2216", "Invoiced"],
          ].map(([id, status]) => (
            <div key={id} className="flex items-center justify-between rounded-lg border border-[#26231D] px-3 py-2">
              <span className="vy-mono text-[11px] text-ondark-2">{id}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-ondark-3">
                <span className="h-1.5 w-1.5 rounded-full bg-signal/80" aria-hidden="true" />
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PanelFrame>
  );
}

function SystemSchematic() {
  const satellites = [
    { label: "Orders", x: 84, y: 30 },
    { label: "Stock", x: 246, y: 30 },
    { label: "Invoices", x: 84, y: 128 },
    { label: "Alerts", x: 246, y: 128 },
  ];
  return (
    <PanelFrame label="Your operations system">
      <svg viewBox="0 0 330 158" className="w-full" aria-hidden="true">
        {satellites.map((s) => (
          <g key={s.label}>
            <path
              d={`M${s.x < 165 ? s.x + 34 : s.x - 34} ${s.y < 79 ? s.y + 8 : s.y - 8} Q165 79 165 79`}
              fill="none"
              stroke="#4A463C"
              strokeWidth="1.2"
              strokeDasharray="3 4"
            />
            <rect x={s.x - 34} y={s.y - 13} width="68" height="26" rx="8" fill="#181510" stroke="#2A2722" />
            <text x={s.x} y={s.y + 3.5} textAnchor="middle" fill="#B9B3A3" fontSize="10" fontFamily="var(--font-plex-mono), monospace">
              {s.label}
            </text>
          </g>
        ))}
        <circle cx="165" cy="79" r="17" fill="#1B1408" stroke="var(--color-signal)" strokeWidth="1.4" />
        <circle cx="165" cy="79" r="5" fill="var(--color-signal)" />
      </svg>
    </PanelFrame>
  );
}

const SCHEMATICS = [InboxSchematic, OrdersSchematic, SystemSchematic] as const;

/* ── Heading block shared by both layouts ─────────────────────────────────── */

function ScaleHead() {
  return (
    <div className="mx-auto max-w-[760px] text-center">
      <h2
        id="scale-heading"
        className="text-balance text-[clamp(1.9rem,3.8vw,3rem)] font-semibold leading-[1.06] tracking-[-0.015em] text-ondark"
      >
        What could Vyso look like{" "}
        <em className="vy-serif font-normal italic text-signal-ondark">in your business?</em>
      </h2>
      <p className="mt-4 text-lg text-ondark-2">Start with one task. Go as far as you need.</p>
    </div>
  );
}

/* ── Static / mobile form: stacked steps with a vertical progress line ────── */

function StackedScale() {
  const staticMotion = useStaticMotion();
  const { containerRef, active } = useActiveIndex<HTMLDivElement>(STAGES.length, staticMotion);
  return (
    <div ref={containerRef} className="relative mx-auto mt-14 max-w-[640px]">
      <span aria-hidden="true" className="absolute bottom-6 left-[7px] top-2 w-px bg-[#2A2722]" />
      <div className="space-y-12">
        {STAGES.map((stage, index) => {
          const isActive = staticMotion || index <= active;
          const Schematic = SCHEMATICS[index];
          return (
            <div key={stage.title} data-active-item className="relative pl-9">
              <span
                aria-hidden="true"
                className="absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 transition-colors duration-400"
                style={{
                  borderColor: isActive ? "var(--color-signal)" : "#3A362F",
                  background: isActive ? "var(--color-signal)" : "#12100C",
                }}
              />
              <p className="vy-eyebrow text-ondark-3">{stage.label}</p>
              <h3 className="mt-1.5 text-xl font-semibold text-ondark">{stage.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ondark-2">{stage.body}</p>
              <div className="mt-5">
                <Schematic />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Pinned desktop form ──────────────────────────────────────────────────── */

function PinnedScale() {
  const { ref, progress } = useStickyProgress<HTMLDivElement>();
  /* Three equal scroll bands; a stage is active while its band scrolls. */
  const seg = Math.min(2.9999, progress * 3);
  const stage = Math.floor(seg);

  return (
    <div ref={ref} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden px-6">
        <ScaleHead />

        {/* Stage copy + schematic, crossfaded */}
        <div className="relative mx-auto mt-10 grid w-full max-w-[1000px] flex-none items-center gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" style={{ minHeight: "300px" }}>
          {STAGES.map((item, index) => {
            const isActive = index === stage;
            const Schematic = SCHEMATICS[index];
            return (
              <div
                key={item.title}
                className="absolute inset-0 grid items-center gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
                style={{
                  opacity: isActive ? 1 : 0,
                  transform: isActive ? "none" : `translateY(${index < stage ? -14 : 14}px)`,
                  transition: "opacity 0.45s var(--vy-ease), transform 0.45s var(--vy-ease)",
                  pointerEvents: isActive ? "auto" : "none",
                }}
                aria-hidden={!isActive}
              >
                <div>
                  <p className="vy-eyebrow text-ondark-3">{item.label}</p>
                  <h3 className="mt-2 text-3xl font-semibold tracking-[-0.015em] text-ondark">{item.title}</h3>
                  <p className="mt-3 max-w-[360px] leading-relaxed text-ondark-2">{item.body}</p>
                </div>
                <div className="flex justify-center md:justify-end">
                  <Schematic />
                </div>
              </div>
            );
          })}
        </div>

        {/* The scale itself */}
        <div className="mx-auto mt-12 w-full max-w-[760px] flex-none pb-2">
          <div className="relative h-px bg-[#2A2722]">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 bg-signal"
              style={{ width: `${progress * 100}%`, transition: "width 0.15s linear" }}
            />
            {STAGES.map((item, index) => {
              const reached = seg >= index;
              return (
                <span
                  key={item.title}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${(index / (STAGES.length - 1)) * 100}%` }}
                >
                  <span
                    className="block h-3 w-3 rounded-full border-2 transition-colors duration-300"
                    style={{
                      borderColor: reached ? "var(--color-signal)" : "#3A362F",
                      background: reached ? "var(--color-signal)" : "#0A0908",
                    }}
                  />
                  <span
                    className="vy-mono absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-[0.16em] transition-colors duration-300"
                    style={{ color: index === stage ? "var(--color-signal-ondark)" : "var(--color-ondark-3)" }}
                  >
                    {item.label}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AutomationScale() {
  const staticMotion = useStaticMotion();
  const wide = useMediaQuery("(min-width: 1024px)", false);
  const pinned = wide && !staticMotion;

  return (
    <section className="border-t border-[#211E19]" aria-labelledby="scale-heading">
      {pinned ? (
        <PinnedScale />
      ) : (
        <div className="px-6 py-24 md:py-32">
          <ScaleHead />
          <StackedScale />
        </div>
      )}

      {/* Resolution — the section releases into this */}
      <div className="mx-auto max-w-[760px] px-6 pb-28 pt-8 text-center md:pb-36">
        <h3 className="text-balance text-[clamp(1.5rem,2.8vw,2.2rem)] font-semibold leading-[1.15] tracking-[-0.01em] text-ondark">
          From everyday admin to your entire operation.
        </h3>
        <p className="mt-3 text-ondark-2">Vyso does it all. You only pay for what you need.</p>
      </div>
    </section>
  );
}

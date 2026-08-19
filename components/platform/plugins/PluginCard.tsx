import Link from 'next/link';
import {
  pluginToneDot,
  pluginToneLabel,
  type PluginRailRow,
} from '@/lib/platform/plugins';

/**
 * One plugin, as a card on `/app/plugins` — the same three facts the rail row
 * carries (name, state, where it goes), given room to say what the connection
 * is actually for.
 *
 * A SERVER COMPONENT. There is nothing interactive here: it is a `<Link>` and
 * three strings, all resolved by the page. Marking it `'use client'` would ship
 * the card, its blurb and the tone helpers to the browser for no behaviour at
 * all.
 *
 * Deliberately NOT `SectionCard` (components/platform/module-ui.tsx): that one
 * is a titled container for a body, and this is a link tile. The markup below is
 * the same tile `/app/settings` uses for its "My Organisation" row, which is the
 * closest thing the platform already has to "a card that is one big link".
 */
export function PluginCard({
  plugin,
  blurb,
}: {
  plugin: PluginRailRow;
  blurb: string;
}) {
  return (
    <Link
      href={plugin.href}
      className="flex items-center justify-between gap-4 rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)] transition-colors hover:border-[#C9DEF7] hover:bg-[#FBFCFE]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ backgroundColor: pluginToneDot(plugin.tone) }}
          />
          <span className="of-display text-[16px] font-semibold text-[#171A17]">{plugin.label}</span>
          <span className="text-[12px] text-[#8A8E86]">{pluginToneLabel(plugin.tone)}</span>
        </div>
        <p className="mt-1 text-[13px] text-[#6B6F68]">{blurb}</p>
      </div>
      <span className="shrink-0 text-[18px] text-[#A0A49C]" aria-hidden>
        ›
      </span>
    </Link>
  );
}

import Link from 'next/link';
import type { ChatSummary } from '@/lib/platform/finch-chats-shared';
import { chatTimeLabel } from '@/lib/platform/finch-chats-shared';

/**
 * "Older chats" — the tail of the rail's list, under History (plan §1.2).
 *
 * A chat drops out of the rail after 14 days of silence (`splitChats`; no cron,
 * no status column — it is a read-time rule). This is where it lands, so
 * "recent" can stay genuinely short without a conversation ever becoming
 * unreachable.
 *
 * A SERVER COMPONENT, deliberately: it is a list of links with a date on each,
 * nothing is interactive, and the date is computed here rather than in the
 * browser for the same reason the rail's is — a relative label recomputed at
 * hydration can disagree with the HTML it is hydrating.
 *
 * Lives in components/platform/chat/ rather than in the Brief's folder because
 * it draws chats, and because keeping it out of app/app/page.tsx is what let
 * that page's edit stay to a handful of lines.
 */
export function OlderChats({ chats }: { chats: ChatSummary[] }) {
  const now = new Date();

  return (
    <section className="mt-10">
      <h2 className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--pf-text-faint)]">
        Older chats
      </h2>
      <div className="mt-3 flex flex-col overflow-hidden rounded-[var(--pf-radius-card)] border border-[#EFEDE8] bg-[#FBFAF8]">
        {chats.map((chat, i) => (
          <Link
            key={chat.id}
            href={`/app/chat/${chat.id}`}
            className={`flex items-center gap-3 px-[22px] py-3 transition-colors hover:bg-white ${
              i > 0 ? 'border-t border-[#EFEDE8]' : ''
            }`}
            style={{ transitionDuration: 'var(--dur-hover)' }}
          >
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-[var(--pf-text-secondary)]">
              {chat.title}
            </span>
            <span className="of-num shrink-0 text-[12px] text-[var(--pf-text-faint)]">
              {chatTimeLabel(chat.updated_at, now)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

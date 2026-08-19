import { redirect } from 'next/navigation';
import { getPlatformSession } from '@/lib/platform/supabase-server';
import { canSeeMoney } from '@/lib/platform/access';
import { PLUGINS } from '@/lib/platform/plugins';
import { pluginRailRows } from '@/lib/platform/plugins-data';
import { PluginCard } from '@/components/platform/plugins/PluginCard';
import { firstOpenableModuleHref, railModules } from '@/components/platform/shell/shell-data';

/**
 * `/app/plugins` — the index of the outside systems this business has plugged
 * into.
 *
 * ONE ENTRY TODAY, AND THE PAGE STILL EARNS ITS PLACE. The rail links straight to
 * `/app/plugins/xero`, so this list is not on anybody's path; it exists because
 * "Plugins" is a section and a section with no front door is a section that
 * cannot answer "what else could I connect?" when the second plugin arrives.
 * It costs one status read that the layout has already paid for the rail.
 *
 * OWNERS AND ADMINS ONLY. A plugin page shows the company's money — receivables,
 * payables, who is late — so it carries the same gate the Brief and the finance
 * tools do (`canSeeMoney`, lib/platform/access.ts), and a member is REDIRECTED
 * to their first unlocked module rather than shown a 403: the rail never offered
 * them the link, so the only ways to arrive are a stale bookmark or a typed URL,
 * and both deserve to land somewhere they can work.
 *
 * THE CHECK LIVES HERE, IN THE PAGE, and not in a layout. Next 16 layouts do not
 * re-render on a client-side navigation (Partial Rendering), so an auth check
 * placed in one is not re-run on a route change and cannot be relied on
 * (node_modules/next/dist/docs/01-app/02-guides/authentication.md, "Layouts and
 * auth checks"). `/app/plugins/xero` carries its own copy for the same reason.
 */
export default async function PluginsIndex() {
  const session = await getPlatformSession();
  // The layout guards both of these already; repeating them narrows
  // `session.org` for the read below and keeps the page correct if it is ever
  // rendered outside that layout.
  if (!session) redirect('/login');
  if (!session.org) redirect('/onboarding');
  if (!canSeeMoney(session.profile?.role)) {
    redirect(firstOpenableModuleHref(railModules(session.features), session.lockedModules));
  }

  const rows = await pluginRailRows(session.org.id);
  const blurbByKey = new Map(PLUGINS.map((p) => [p.key, p.blurb]));

  return (
    <div className="px-8 py-7">
      <div className="min-w-0">
        <h1 className="of-display text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">
          Plugins
        </h1>
        <p className="mt-1.5 text-[14px] text-[#8A8E86]">
          The systems Vyso reads alongside your own data.
        </p>
      </div>

      <div className="mt-6 max-w-[820px] space-y-4">
        {rows.map((row) => (
          <PluginCard key={row.key} plugin={row} blurb={blurbByKey.get(row.key) ?? ''} />
        ))}
      </div>
    </div>
  );
}

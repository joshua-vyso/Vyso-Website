/**
 * The plugin registry — the one list of the outside systems Vyso plugs into,
 * and the pure rules for how their connection state is drawn.
 *
 * WHY A REGISTRY FOR ONE ENTRY. Josh's ask was explicitly "a separate section
 * for integrations that has ALL integrations in one place… we'll do this just
 * for Xero for now" (2026-08-18). A section built around a single hardcoded Xero
 * row is a section that has to be rewritten the first time a second plugin
 * arrives; a registry with one entry is the same amount of code today and none
 * tomorrow. It mirrors `lib/platform/modules.ts`, which is the shape the rail's
 * other list already has.
 *
 * PLUGINS ARE NOT MODULES, and this is deliberately NOT an entry in
 * `MODULES`. A module is a screen this business works in and is gated by the
 * org's features and locks; a plugin is a connection an owner administers and is
 * gated by role (`canSeeMoney` — a Xero mirror is the company's money). Folding
 * them into one list would mean one of those two gates silently applying to the
 * other kind of row.
 *
 * NO PER-PLUGIN ICON IN X1. The plan's registry sketch carried an `icon`; the
 * rail row it feeds already carries a STATUS DOT, which is the thing an owner
 * actually scans that list for, and a glyph beside a one-row list is decoration
 * this brand does not spend. When a second plugin lands and the rows need
 * telling apart at a glance, an icon field is a one-line addition here.
 *
 * Framework-free and dependency-free so the rail (client), the pages (server)
 * and `node --test` can all import it — the same rule every unit-tested module
 * under lib/platform follows.
 */

/** Plugin slugs. A union rather than `string` so a typo in a route or a rail row
 *  is a compile error rather than a plugin that silently never matches. */
export type PluginKey = 'xero';

export interface PluginDefinition {
  key: PluginKey;
  /** What the owner calls it. */
  label: string;
  /** Its page under `/app/plugins`. */
  href: string;
  /** One line for the index card. Says what Vyso DOES with the connection, not
   *  what the vendor is — the owner already knows what Xero is. */
  blurb: string;
}

export const PLUGINS: readonly PluginDefinition[] = [
  {
    key: 'xero',
    label: 'Xero',
    href: '/app/plugins/xero',
    blurb: 'Read your invoices and contacts every night, and flag what does not line up.',
  },
];

/** The section's own route — the index card list. */
export const PLUGINS_HREF = '/app/plugins';

/**
 * How a plugin row reads at a glance.
 *
 * THREE STATES, NOT FIVE. `xero_connections.status` has five values
 * (`connected`, `syncing`, `error`, `reauth_required`, `disconnected`) and the
 * rail has one dot. `syncing` is `connected` mid-read — a green dot that flicked
 * amber for the twenty seconds a nightly sync takes would teach the owner to
 * distrust the colour. `error` and `reauth_required` both mean "linked, but
 * nothing is coming through", which is one thing to a person even though it is
 * two things to the code. `disconnected` and "no row at all" are the same fact.
 */
export type PluginTone = 'connected' | 'attention' | 'idle';

/**
 * Map `xero_connections.status` onto a dot.
 *
 * FAILS TO `idle`, not to `connected`: a status this build does not recognise
 * must not be drawn as a healthy connection. A row wrongly showing "not
 * connected" costs a click; a row wrongly showing green costs the owner a
 * night's data without knowing it.
 */
export function xeroStatusTone(status: string | null | undefined): PluginTone {
  if (status === 'connected' || status === 'syncing') return 'connected';
  if (status === 'error' || status === 'reauth_required') return 'attention';
  return 'idle';
}

/** The words beside the dot. */
export function pluginToneLabel(tone: PluginTone): string {
  if (tone === 'connected') return 'Connected';
  if (tone === 'attention') return 'Needs attention';
  return 'Not connected';
}

/** The dot's colour. Green/amber/grey — the platform's tone pairs, quoted as the
 *  literals the rail's other dots already use rather than as CSS vars, because
 *  a 5px square is a colour and not a surface. */
export function pluginToneDot(tone: PluginTone): string {
  if (tone === 'connected') return '#27733B';
  if (tone === 'attention') return '#B4780F';
  return '#C9CCC4';
}

/** One rail row, resolved. Built server-side (the layout reads the status once)
 *  and handed to the client rail as finished data — the same contract
 *  `RailModule` has. */
export interface PluginRailRow {
  key: PluginKey;
  label: string;
  href: string;
  tone: PluginTone;
}

/**
 * True when a pathname is inside the Plugins section — what the rail's rows
 * highlight on. Prefix-matched (`/app/plugins/xero/...`) so a future sub-route
 * keeps its parent row lit, and anchored on a `/` so `/app/pluginsomething`
 * could never match.
 */
export function isPluginPath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

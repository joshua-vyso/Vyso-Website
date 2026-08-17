/**
 * Which Finch is the owner talking to, given where they are standing
 * (`.ai/plan_brief_chat_v2.md` §2.5, W4).
 *
 * Until this wave the dock sent `module: 'brief'` from every route in the
 * platform, so the OrderFlow screens answered with the Brief's tools and the
 * legacy FinchModal — mounted only on OrderFlow and Doc-U — was the only way to
 * reach a module-aware agent. One Finch means the dock has to work that out for
 * itself, from the pathname, which is the only thing it knows about where it is.
 *
 * WHY A LITERAL TABLE RATHER THAN THE MODULES REGISTRY. `AgentModule` is not the
 * module list: it is the agent's unit of KNOWLEDGE (a system prompt in
 * knowledge.ts plus a tool set in TOOLS_BY_MODULE), and only two of the nine
 * modules have one. ProcurePulse, PricePilot, WasteWatch and the rest have no
 * Finch knowledge of their own, so on those screens the honest answer is the
 * cross-module 'brief' agent — which is also what the plan asks for on the
 * non-module routes (settings, organisation, notifications). Deriving the table
 * from MODULES would therefore say nothing true; `tests/finch-module-route.test.ts`
 * pins each route below against the registry so a renamed route still cannot
 * drift silently.
 *
 * Type-only import: this file is loaded by a client component AND by
 * `node --test`, and `config.ts` reads `process.env` at module scope.
 */
import type { AgentModule } from './config';

/** Route prefix → the agent whose knowledge and tools that screen deserves.
 *  Longest-prefix wins, so a nested route can never be captured by a shorter
 *  sibling (there is no such pair today; the loop keeps it true if one lands). */
export const AGENT_MODULE_ROUTES: readonly (readonly [route: string, module: AgentModule])[] = [
  ['/app/orderflow', 'orderflow'],
  ['/app/docu', 'docu'],
];

/**
 * The module a chat started on `pathname` belongs to.
 *
 * Everything the table does not name is `'brief'`: `/app` itself, `/app/chat/*`,
 * the seven modules with no agent knowledge, and the account screens. That is a
 * deliberate default rather than a fallback — the Brief agent is the
 * cross-module one, so "I don't know this screen" and "answer as the COO
 * surface" are the same instruction.
 */
export function agentModuleForPathname(pathname: string): AgentModule {
  let best: AgentModule = 'brief';
  let bestLength = 0;
  for (const [route, module] of AGENT_MODULE_ROUTES) {
    const matches = pathname === route || pathname.startsWith(`${route}/`);
    if (matches && route.length > bestLength) {
      best = module;
      bestLength = route.length;
    }
  }
  return best;
}

/**
 * Does this route get the collapsed gradient bubble rather than the Brief's
 * dock? (plan §1.5)
 *
 * The two exceptions are the two screens the conversation already owns: `/app`
 * draws it in the floating panel above the wide pill, and `/app/chat/*` IS the
 * transcript. A bubble on either would be a second door into the room the owner
 * is standing in. Shared by GlobalChatDock (which surface to render) and
 * FinchChatProvider (whether an answer that landed unseen deserves the unread
 * dot), so the two cannot disagree about where the bubble is.
 */
export function isBubbleRoute(pathname: string): boolean {
  return pathname !== '/app' && !pathname.startsWith('/app/chat');
}

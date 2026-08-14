/**
 * SUPERSEDED — kept as a rename-only shim until Wave 5 deletes it.
 *
 * The Brief's chat pill is now `GlobalChatDock`
 * (components/platform/shell/GlobalChatDock.tsx), a view over
 * `FinchChatProvider` mounted in app/app/layout.tsx: same wire contract
 * (POST /api/ai/agent, `{ messages, module: 'brief', orgName }`, SSE frames),
 * same prelude-on-turn-0 rule, same gradient chrome — but the conversation
 * survives navigation and the pill appears on every /app/* route rather than
 * only on /app (.ai/plan_chat_first_shell.md §4.3, Wave 4).
 *
 * The whole implementation moved rather than being copied: the SSE reader, the
 * abort controller and the `onBriefAsk` subscription now live in the provider,
 * so there is exactly one of each. Nothing imports this file — the shim exists
 * only so the old name resolves to the new component for the length of one
 * wave, and because W4's brief was explicitly "do NOT delete files this wave".
 *
 * Two behavioural notes carried over from BriefChatPill, both deliberate:
 *   - The dock takes NO props. The findings prelude and org name are handed to
 *     FinchChatProvider by the layout, off the findings read it already does
 *     for the rail badges (plan §4.1 — one fetch, two consumers), instead of
 *     being prop-drilled from app/app/page.tsx.
 *   - With `finchEnabled` false the dock renders nothing, where this pill drew
 *     inert "switched off" chrome. Plan §8 E6: that explanation was worth a
 *     page, not worth thirteen.
 */
export { GlobalChatDock as BriefChatPill } from '@/components/platform/shell/GlobalChatDock';

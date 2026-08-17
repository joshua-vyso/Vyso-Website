import { NextResponse, after } from 'next/server';
import type Anthropic from '@anthropic-ai/sdk';
import { resolveUser, AI_CORS_HEADERS } from '@/lib/ai/auth';
import { agentClient, agentConfigured, sanitizeMessages } from '@/lib/ai/finch/runtime';
import { AGENT_MODEL, WORKFLOW_MODEL, AGENT_MAX_TOKENS, isAgentModule, isFinchAllowed } from '@/lib/ai/finch/config';
import { buildSystemPrompt } from '@/lib/ai/finch/knowledge';
import { buildTitlePrompt, normaliseChatTitle } from '@/lib/ai/finch/chat-title';
import { attachmentContextLine } from '@/lib/ai/finch/attachments';
import { CREATE_ORDER_RE } from '@/lib/ai/finch/order-intent';
import { toolDefsFor, runTool, type ToolContext } from '@/lib/ai/finch/tools';
import { rateLimitAllowed } from '@/lib/platform/rate-limit';
import {
  appendMessages,
  getChatForOwner,
  setChatTitle,
  stripBriefPrelude,
  type ChatMessageContent,
  type ChatRecord,
  type NewChatMessage,
} from '@/lib/platform/finch-chats';

// Tool-use turns can chain a couple of round-trips, and the workflow tier runs
// on Sonnet (slower) — give headroom.
export const maxDuration = 60;

// Safety cap on the agentic loop (each iteration = one model turn ± tool calls).
const MAX_TURNS = 5;

/* The cheap "is this an order request?" router now lives in
 * lib/ai/finch/order-intent.ts — the client arms the same escalation from the
 * chat dock (W4), and two copies of this regex that disagree mean a turn the
 * client flagged as workflow and the server then answered on the Q&A tier with
 * no order tool offered. */

/** A short, user-facing status shown while a tool runs. */
const TOOL_ACTIVITY: Record<string, string> = {
  orderflow_get_business_snapshot: 'Checking the numbers…',
  orderflow_list_recent_invoices: 'Reading recent invoices…',
  orderflow_list_recent_orders: 'Reading recent orders…',
  orderflow_get_order_lines: 'Reading the order lines…',
  orderflow_find_customer: 'Looking up the customer…',
  orderflow_prepare_order: 'Putting the order together…',
  onboarding_get_progress: 'Checking your setup progress…',
};

/**
 * Turn a prepare_order tool result into the ParsedOrder shape the client's
 * "review in a new order" card consumes. Only a confidently matched customer is
 * passed as the name — otherwise the user picks the customer on the order page,
 * so we never pre-select the wrong account.
 */
function buildOrderDraft(toolResult: string): {
  customerName: string | null;
  items: Array<{ name: string; qty: number; unit_price: number }>;
} {
  try {
    const draft = JSON.parse(toolResult) as {
      customer?: { name?: string | null; matched?: boolean };
      items?: Array<{ name?: string; qty?: number }>;
    };
    return {
      customerName: draft.customer?.matched ? draft.customer.name ?? null : null,
      items: (draft.items ?? [])
        .map((i) => ({ name: String(i.name ?? '').trim(), qty: Number(i.qty) || 1, unit_price: 0 }))
        .filter((i) => i.name),
    };
  } catch {
    return { customerName: null, items: [] };
  }
}

/** Cap on documents cited by one turn — a chat message, not a data dump. */
const MAX_ATTACHMENTS = 10;

/**
 * Narrow the client's `attachments` to the shape `finch_messages.content`
 * documents. Anything without a document id is dropped rather than stored as a
 * card that links nowhere.
 */
function parseAttachments(raw: unknown): { document_id: string; filename: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Record<string, unknown> => !!a && typeof a === 'object')
    .map((a) => ({
      document_id: typeof a.document_id === 'string' ? a.document_id : '',
      filename: typeof a.filename === 'string' ? a.filename.slice(0, 300) : '',
    }))
    .filter((a) => a.document_id)
    .slice(0, MAX_ATTACHMENTS);
}

/**
 * Name a chat from its first exchange, on the cheap tier.
 *
 * Runs inside `after()`, so it is never on the user's critical path, and it
 * answers null on ANY failure — a chat with no title reads as "New chat" and
 * gets another attempt on the next exchange, which is a far better outcome than
 * an error reaching a route whose real job is already done.
 */
async function generateChatTitle(userText: string, assistantText: string): Promise<string | null> {
  try {
    const msg = await agentClient().messages.create({
      model: AGENT_MODEL,
      max_tokens: 30,
      messages: [{ role: 'user', content: buildTitlePrompt(userText, assistantText) }],
    });
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join(' ');
    return normaliseChatTitle(text);
  } catch (err) {
    console.error('[finch-chats] title generation failed', err);
    return null;
  }
}

const SSE_HEADERS: Record<string, string> = {
  ...AI_CORS_HEADERS,
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: AI_CORS_HEADERS });
}

/**
 * Finch chat — streams a Haiku reply as Server-Sent Events, with tool use so
 * the agent can read the caller's live OrderFlow data (via their RLS-scoped
 * Supabase client — a tool can only ever touch the caller's own org). Preview-
 * gated by the platform-wide kill switch on the server (isFinchAllowed →
 * FINCH_ENABLED).
 *
 * Body: { messages, module, orgName?, workflow?, chatId?, attachments? }.
 *
 * `chatId` + `attachments` are the persistence half (plan_brief_chat_v2 W1) and
 * are entirely optional: with no `chatId` this route streams exactly as it
 * always has and stores nothing. With one, the chat's ownership is checked
 * before generation starts and the finished exchange is written to
 * finch_messages in `after()` — off the user's critical path, and never able to
 * affect what the stream said.
 *
 * `attachments` does double duty from W5: the ids are prepended to the turn the
 * documents were dropped into so the model can call docu_get_document_summary
 * on them, AND stored on the user message so the transcript redraws the
 * document cards on reload.
 */
export async function POST(req: Request) {
  if (!agentConfigured) {
    return NextResponse.json({ error: 'AI is not configured on the server.' }, { status: 503, headers: AI_CORS_HEADERS });
  }

  const auth = await resolveUser(req);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: AI_CORS_HEADERS });
  }
  if (!isFinchAllowed(auth.email)) {
    return NextResponse.json({ error: 'Finch is not enabled for your account.' }, { status: 403, headers: AI_CORS_HEADERS });
  }

  // Per-user hourly cap on Finch agent requests.
  if (!(await rateLimitAllowed(`ai-agent:${auth.userId}`, 40, 3600))) {
    return NextResponse.json(
      { error: "You've hit the hourly Finch limit. Try again soon." },
      { status: 429, headers: AI_CORS_HEADERS },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    messages?: unknown;
    module?: unknown;
    orgName?: unknown;
    workflow?: unknown;
    chatId?: unknown;
    attachments?: unknown;
  };

  const messages = sanitizeMessages(body.messages);
  if (!messages) {
    return NextResponse.json({ error: 'messages is required' }, { status: 400, headers: AI_CORS_HEADERS });
  }

  const module = isAgentModule(body.module) ? body.module : 'orderflow';
  const orgName = typeof body.orgName === 'string' ? body.orgName.slice(0, 120) : null;

  // Escalate to the Sonnet workflow tier when the user is building an order —
  // either flagged explicitly by the client (the "/" customer picker) or detected
  // from the message. Only OrderFlow has a workflow tool today.
  // The turn being answered. Its INDEX matters as well as its text: an attached
  // document's ids are prepended to this message and nothing else (W5).
  const lastUserIndex = messages.map((m) => m.role).lastIndexOf('user');
  const lastUserText = lastUserIndex >= 0 ? messages[lastUserIndex].content : '';
  const wantsWorkflow = module === 'orderflow' && (body.workflow === true || CREATE_ORDER_RE.test(lastUserText));
  const system = buildSystemPrompt({ module, orgName, workflow: wantsWorkflow });

  // Resolve the caller's org + role (for tools + the finance gate). RLS lets a
  // user read their own profile only.
  const { data: profile } = await auth.supabase
    .from('profiles')
    .select('org_id, role')
    .eq('id', auth.userId)
    .maybeSingle<{ org_id: string | null; role: string | null }>();
  const orgId = profile?.org_id ?? null;
  // Allow-list, mirroring RoleGate.useIsAdmin: only owner/admin see money. Any
  // unset/unknown role is treated as non-admin so finance data is never leaked.
  const canSeeMoney = profile?.role === 'owner' || profile?.role === 'admin';

  /* ── Persistence (plan_brief_chat_v2 §2.3, W1) ────────────────────────────
   * `chatId` is optional and everything below is additive: without it this
   * route behaves exactly as it did before, which is what the mobile client
   * and the onboarding stage (useFinchStream) still expect.
   *
   * The chat is verified NOW, before a single token is generated, so a request
   * naming someone else's conversation is refused rather than answered and
   * silently not stored. `getChatForOwner` filters org + user on top of RLS.
   *
   * `tableMissing` is the one case that is NOT a 404: the migration is pasted
   * into Supabase by hand, so a client can legitimately know about chats
   * before the database does. Then we answer normally and store nothing —
   * exactly the platform's behaviour before this wave (plan §5).
   */
  const chatId = typeof body.chatId === 'string' && body.chatId ? body.chatId : null;
  const attachments = parseAttachments(body.attachments);
  /* Documents dropped into this turn (W5). The ids go to the MODEL here and to
   * the TRANSCRIPT via `content.attachments` below — two different jobs from
   * one array. Note this is independent of `chatId`: a chat that cannot be
   * persisted (migration not applied) must still be able to answer about a file
   * the owner just dropped into it. */
  const attachmentLine = attachmentContextLine(attachments);
  let chat: ChatRecord | null = null;
  if (chatId && orgId) {
    const owned = await getChatForOwner(orgId, auth.userId, chatId, auth.supabase);
    if (!owned.chat && !owned.tableMissing) {
      return NextResponse.json({ error: 'Chat not found.' }, { status: 404, headers: AI_CORS_HEADERS });
    }
    chat = owned.chat;
  }

  const toolCtx: ToolContext = { supabase: auth.supabase, orgId: orgId ?? '', canSeeMoney };
  // Only offer tools when we have an org to read from. Workflow tools (order
  // building) are only offered on the workflow tier.
  const tools = orgId ? toolDefsFor(module, { workflow: wantsWorkflow }) : [];
  const model = wantsWorkflow ? WORKFLOW_MODEL : AGENT_MODEL;

  const client = agentClient();
  const encoder = new TextEncoder();
  const send = (obj: unknown) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

  /* What the persistence tail needs, filled in by the stream below.
   *
   * `answer` stays null unless the agentic loop ran all the way to its natural
   * end. That is the rule from plan §5: a partial or aborted assistant turn is
   * NOT stored — half an answer read back after a reload looks like something
   * Finch actually said and stopped. The user's own message is stored either
   * way, because they did say it.
   *
   * `finished` is how `after()` waits for a STREAMING response to be over. The
   * callback cannot simply read these variables — it may run the moment the
   * response headers are out — so the stream resolves this in its `finally`,
   * on every path including abort. */
  const outcome: { answer: string | null; tools: string[] } = { answer: null, tools: [] };
  let settle: () => void = () => {};
  const finished = new Promise<void>((resolve) => {
    settle = resolve;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const safeEnqueue = (chunk: Uint8Array) => {
        try {
          controller.enqueue(chunk);
        } catch {
          /* stream already cancelled */
        }
      };

      // The attachment prelude rides on the turn the documents were dropped
      // into, and only that one — the model must be able to tell which question
      // was about which file, and the STORED message keeps the owner's own
      // words (the persistence tail below reads `lastUserText`, untouched).
      const convo: Anthropic.MessageParam[] = messages.map((m, i) => ({
        role: m.role,
        content: i === lastUserIndex && attachmentLine ? `${attachmentLine}\n\n${m.content}` : m.content,
      }));
      // The answer as the user sees it: every text delta across every turn of
      // the loop, in order — the same string the client accumulates.
      let answer = '';

      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          // On the final allowed turn, withhold tools so the model MUST produce a
          // text answer rather than requesting a tool whose result nothing reads.
          const offerTools = tools.length > 0 && turn < MAX_TURNS - 1;
          const modelStream = client.messages.stream(
            {
              model,
              max_tokens: AGENT_MAX_TOKENS,
              system,
              messages: convo,
              ...(offerTools ? { tools } : {}),
            },
            { signal: req.signal },
          );
          for await (const event of modelStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              answer += event.delta.text;
              safeEnqueue(send({ text: event.delta.text }));
            }
          }
          const finalMsg = await modelStream.finalMessage();
          convo.push({ role: 'assistant', content: finalMsg.content });

          if (finalMsg.stop_reason !== 'tool_use') break;

          // Run each requested tool through the RLS-scoped client, then feed the
          // results back for the model's next turn.
          const toolUses = finalMsg.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
          );
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const tu of toolUses) {
            outcome.tools.push(tu.name);
            safeEnqueue(send({ tool: TOOL_ACTIVITY[tu.name] ?? 'Looking things up…' }));
            const { content, isError } = await runTool(
              module,
              tu.name,
              toolCtx,
              (tu.input ?? {}) as Record<string, unknown>,
            );
            results.push({ type: 'tool_result', tool_use_id: tu.id, content, is_error: isError });

            // The order-builder tool also streams a structured draft to the
            // client so it can render a "review in a new order" card. This is
            // display data only — no order is saved server-side.
            if (tu.name === 'orderflow_prepare_order' && !isError) {
              safeEnqueue(send({ orderDraft: buildOrderDraft(content) }));
            }
          }
          convo.push({ role: 'user', content: results });
        }
        // Reached only when the loop ended on its own terms — this is what
        // makes the turn "complete" and therefore storable.
        if (answer.trim()) outcome.answer = answer;
        safeEnqueue(send({ done: true }));
      } catch (err) {
        if (!req.signal.aborted) {
          safeEnqueue(send({ error: err instanceof Error ? err.message : 'Finch request failed' }));
        }
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed/cancelled */
        }
        // Always — an aborted stream still has a user message worth keeping.
        settle();
      }
    },
  });

  /* Store the exchange once the response is done with.
   *
   * `after()` is the right primitive here (Next 16 —
   * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md):
   * it schedules work for after the response finishes, runs even when that
   * response ended badly, and is bounded by this route's `maxDuration`. It is
   * called HERE, in the request's own scope, rather than inside the stream —
   * that is the documented place for it, and the callback picks the stream's
   * results up through `finished`.
   *
   * Rule 3 of lib/platform/finch-chats.ts applies to every line of it: the
   * answer is already on the user's screen, so nothing below may throw into
   * anything the user sees. Failures are logged and that is all.
   */
  if (chat && orgId) {
    const persistChat = chat;
    const persistOrgId = orgId;
    // The Brief prefixes its findings to the first user turn (brief-chat.ts);
    // the model should see them, the transcript must not.
    const userText = stripBriefPrelude(lastUserText);

    after(async () => {
      await finished;
      try {
        const turns: NewChatMessage[] = [];
        if (userText) {
          const content: ChatMessageContent = { text: userText };
          if (attachments.length) content.attachments = attachments;
          turns.push({ role: 'user', content });
        }
        if (outcome.answer) {
          const content: ChatMessageContent = { text: outcome.answer };
          // De-duplicated: the same tool called on two turns is one capability
          // this answer used, not two.
          const tools = [...new Set(outcome.tools)];
          if (tools.length) content.tools = tools;
          turns.push({ role: 'assistant', content });
        }
        await appendMessages(persistChat.id, persistOrgId, turns, auth.supabase);

        // Named once, from the first COMPLETE exchange. A chat whose opening
        // turn was aborted stays "New chat" and is named on the next one.
        if (!persistChat.title && userText && outcome.answer) {
          const title = await generateChatTitle(userText, outcome.answer);
          if (title) await setChatTitle(persistChat.id, persistOrgId, title, auth.supabase);
        }
      } catch (err) {
        console.error('[finch-chats] persisting the exchange failed', err);
      }
    });
  }

  return new Response(stream, { headers: SSE_HEADERS });
}

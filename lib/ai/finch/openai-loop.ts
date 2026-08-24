/**
 * The workflow tier's OpenAI agentic loop (Manufacturing C1).
 *
 * WHY A SECOND LOOP AND NOT A REWRITE OF THE FIRST. app/api/ai/agent/route.ts
 * has run every Finch turn through the Anthropic Messages API since Phase 2,
 * and the Q&A tier still does. Rather than teach that loop two dialects, this
 * file is the OpenAI half in full and the route simply branches on
 * `workflowProvider()` — which is what makes `FINCH_WORKFLOW_PROVIDER=anthropic`
 * a genuine revert rather than a code path nobody has run in a month.
 *
 * IT EMITS NOTHING ITSELF. Every visible effect goes out through the callbacks,
 * which the route wires to the SAME SSE frames it already sends (`{text,turn}`,
 * `{interim}`, `{tool}`, `{card}`, `{orderDraft}`). The client's reader
 * (components/platform/shell/FinchChatProvider.tsx) therefore cannot tell which
 * provider answered, and did not have to change to find out.
 *
 * CHAT-COMPLETIONS, NOT THE RESPONSES API, because that is the convention this
 * repo already proved on `gpt-5.6-luna` (lib/ai/openai.ts → order-reader.ts,
 * order-match-call.ts) and a second wire format for the same model is a second
 * thing to be wrong about. The price of that choice is one non-obvious
 * parameter: with function tools on chat-completions, `reasoning_effort` MUST be
 * sent explicitly as 'none' or the API answers 400. It is set below, always, and
 * must not be "tidied away".
 *
 * TOOL CALLS ARRIVE IN PIECES. A streamed tool call is a sequence of deltas
 * keyed by `index`: the first usually carries the id and the function name, and
 * the rest carry fragments of the JSON arguments string. They are accumulated
 * per index and only parsed once the turn has finished — a half-received
 * arguments string is not "malformed input", it is an unfinished sentence.
 */
import 'server-only';
import { openaiChatStream } from '@/lib/ai/openai';
import type { TurnText } from './narration';

/** A tool as the registry describes it (lib/ai/finch/tools.ts). The JSON schema
 *  is shared verbatim with the Anthropic path — that is the whole reason a
 *  provider swap is a routing change rather than a re-authoring of 15 tools. */
export interface WorkflowTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface WorkflowLoopCallbacks {
  /** A text delta, with the loop turn it belongs to. */
  onText: (delta: string, turn: number) => void;
  /** "Everything turn N said was on the way to a tool call." */
  onInterim: (turn: number) => void;
  /** A tool is about to run — the ✦ status line. */
  onToolCall: (name: string) => void;
  /** Run it. The route keeps ownership of the RLS-scoped context, so this file
   *  never sees a Supabase client and cannot widen what a tool may read. */
  runTool: (name: string, input: Record<string, unknown>) => Promise<{ content: string; isError: boolean }>;
  /** A tool's result landed — where the route turns `pp_prepare_batch_log` into
   *  a `card` frame, exactly as it does on the Anthropic path. */
  onToolResult: (name: string, content: string, isError: boolean) => void;
}

export interface WorkflowLoopParams {
  model: string;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  tools: WorkflowTool[];
  maxTokens: number;
  maxTurns: number;
  signal?: AbortSignal;
  callbacks: WorkflowLoopCallbacks;
}

/** One accumulating tool call, keyed by the stream's `index`. */
interface PendingToolCall {
  id: string;
  name: string;
  args: string;
}

/** The wire messages this loop builds up. Deliberately loose — three shapes
 *  (system/user, assistant-with-tool_calls, tool result) that only ever go
 *  straight back out as JSON. */
type WireMessage = Record<string, unknown>;

/** A streamed chunk, as much of it as this loop reads. */
interface StreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
}

/** Function-tool definitions in OpenAI's shape, from the shared registry. */
function toolParams(tools: WorkflowTool[]): Record<string, unknown>[] {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

/**
 * Read one streamed completion, reporting text as it arrives.
 *
 * Returns the turn's text and the tool calls it decided on. A frame this build
 * does not understand is skipped rather than thrown on: the failure mode of a
 * strict parser here is a whole answer lost to one unfamiliar field.
 */
async function readStream(
  res: Response,
  onDelta: (text: string) => void,
): Promise<{ text: string; toolCalls: PendingToolCall[] }> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  const pending = new Map<number, PendingToolCall>();

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // The last element is whatever arrived without its newline yet.
    buffer = lines.pop() ?? '';
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(payload) as StreamChunk;
      } catch {
        continue;
      }
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (typeof delta.content === 'string' && delta.content) {
        text += delta.content;
        onDelta(delta.content);
      }
      for (const call of delta.tool_calls ?? []) {
        const index = typeof call.index === 'number' ? call.index : 0;
        const entry = pending.get(index) ?? { id: '', name: '', args: '' };
        if (call.id) entry.id = call.id;
        if (call.function?.name) entry.name = call.function.name;
        if (typeof call.function?.arguments === 'string') entry.args += call.function.arguments;
        pending.set(index, entry);
      }
    }
  }

  const toolCalls = [...pending.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, call]) => ({
      // An id is required on the `tool` reply that answers this call. The API
      // always sends one; the fallback exists so a missing id degrades into a
      // synthetic-but-consistent pairing rather than a rejected request.
      id: call.id || `call_${index}`,
      name: call.name,
      args: call.args,
    }))
    .filter((c) => c.name);

  return { text, toolCalls };
}

/** Model-written JSON arguments → a tool input. Never throws: a tool that is
 *  handed `{}` answers with its own honest "I need a recipe name", which is a
 *  far better turn than an exception ending the stream. */
function parseArgs(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Run the workflow tier on OpenAI until the model stops calling tools.
 *
 * Returns the per-turn text so the caller can apply `splitTurnText` — the same
 * narration rule the Anthropic loop uses, so an answer reads identically
 * whichever provider produced it.
 */
export async function runOpenAiWorkflowLoop(params: WorkflowLoopParams): Promise<TurnText[]> {
  const { model, system, messages, tools, maxTokens, maxTurns, signal, callbacks } = params;

  const convo: WireMessage[] = [
    { role: 'system', content: system },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
  const turnTexts: TurnText[] = [];

  for (let turn = 0; turn < maxTurns; turn++) {
    const current: TurnText = { turn, text: '', interim: false };
    turnTexts.push(current);
    // On the final allowed turn, withhold tools so the model MUST produce a
    // text answer rather than requesting a tool whose result nothing reads —
    // the Anthropic loop's rule, kept.
    const offerTools = tools.length > 0 && turn < maxTurns - 1;

    const res = await openaiChatStream(
      {
        model,
        messages: convo,
        // NOT max_tokens — gpt-5.x rejects it (lib/ai/openai.ts).
        max_completion_tokens: maxTokens,
        // MANDATORY with function tools on chat-completions: without an
        // explicit 'none' the request comes back 400. Sent on every turn so a
        // tool-less final turn cannot behave differently from the ones before.
        reasoning_effort: 'none',
        // No `tool_choice`: 'auto' is already the default when tools are
        // present, and an extra knob on a model whose parameter surface has
        // already bitten this codebase twice (temperature, max_tokens) is risk
        // with no upside.
        ...(offerTools ? { tools: toolParams(tools) } : {}),
      },
      { signal },
    );

    const { text, toolCalls } = await readStream(res, (delta) => {
      current.text += delta;
      callbacks.onText(delta, turn);
    });

    if (toolCalls.length === 0) break;

    // Everything this turn said was said on the way to a tool call.
    current.interim = true;
    if (text.trim()) callbacks.onInterim(turn);

    convo.push({
      role: 'assistant',
      // `null`, not '', when the turn was pure tool call — an empty string is a
      // message the API can reject as content-free.
      content: text || null,
      tool_calls: toolCalls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: c.args || '{}' },
      })),
    });

    for (const call of toolCalls) {
      callbacks.onToolCall(call.name);
      const { content, isError } = await callbacks.runTool(call.name, parseArgs(call.args));
      callbacks.onToolResult(call.name, content, isError);
      convo.push({ role: 'tool', tool_call_id: call.id, content });
    }
  }

  return turnTexts;
}

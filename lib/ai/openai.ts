/**
 * OpenAI transport — raw `fetch`, no SDK.
 *
 * NO NEW DEPENDENCY, DELIBERATELY. The whole of what we need from OpenAI is one
 * POST that carries an image and returns a JSON object. An SDK for that is a
 * second vendor client in the bundle, a second release cadence to track and a
 * second place model ids get defaulted behind our backs, in exchange for
 * `JSON.stringify` and `res.json()`. The shape below is the documented
 * chat-completions request and it is small enough to read in one sitting.
 *
 * DELIBERATELY DUMB, like `lib/ai/price-watch-model.ts`: prompt in, raw model
 * text out. Every contract — the prompt, the schema, the coercion, the honesty
 * gates — lives in the pure modules the callers use, so it is testable without a
 * network and identical whichever provider served the call.
 *
 * NO `temperature`. The gpt-5.x family rejects the parameter outright (the same
 * rule the n8n workflows learned the hard way), and a 400 from a sampling knob
 * nobody needed is a silly way to lose a document. It is simply never sent.
 *
 * NOT MARKED `server-only`. It has no alias imports and no React, so a plain
 * node script can smoke-test it — which is exactly how the Luna path was first
 * proven. Nothing here reads the key at module scope; every call reads
 * `process.env.OPENAI_API_KEY` when it runs, so importing this file in a context
 * without a key is harmless.
 */

/** The one image an order read carries, base64 with its media type. */
export interface OpenAiImage {
  base64: string;
  /** "image/png", "image/jpeg", … Used verbatim in the data: URL. */
  mediaType: string;
}

export interface OpenAiJsonCall {
  model: string;
  /** The instruction. Sent as the user turn alongside the image, if any. */
  prompt: string;
  /** An optional system turn — used by the matching agent, not by the reader. */
  system?: string;
  image?: OpenAiImage | null;
  /**
   * Ceiling on the response. Named `max_completion_tokens` on the wire: the
   * gpt-5.x models reject the older `max_tokens`, and because reasoning tokens
   * are billed against this budget it must be generous or a long document comes
   * back truncated with no error at all.
   */
  maxTokens: number;
  /** Milliseconds before the request is abandoned. Default 120s. */
  timeoutMs?: number;
}

/** True when an OpenAI key is configured at all. */
export function openaiConfigured(): boolean {
  return Boolean((process.env.OPENAI_API_KEY ?? '').trim());
}

/** The image media types OpenAI's vision input accepts. */
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/** Normalise the common `image/jpg` alias some cameras and mailers emit. */
export function normaliseImageType(mediaType: string): string {
  const raw = (mediaType || 'image/jpeg').toLowerCase().trim();
  return raw === 'image/jpg' ? 'image/jpeg' : raw;
}

/** True when this file can be sent to the vision endpoint as an image. */
export function isSupportedImageType(mediaType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.has(normaliseImageType(mediaType));
}

/**
 * One JSON-mode call. Returns the model's raw text — parsing is the caller's.
 *
 * Throws on anything short of a usable response, and the message carries the
 * API's own words. That matters more than it sounds: the first question anyone
 * asks about a new model id is "did it reject the name?", and an error that says
 * `model_not_found` answers it, while "OpenAI request failed" starts an
 * afternoon of guessing.
 */
export async function openaiJson(call: OpenAiJsonCall): Promise<string> {
  const key = (process.env.OPENAI_API_KEY ?? '').trim();
  if (!key) throw new Error('OPENAI_API_KEY is not configured');

  const content: Record<string, unknown>[] = [];
  if (call.image) {
    const mediaType = normaliseImageType(call.image.mediaType);
    if (!isSupportedImageType(mediaType)) {
      throw new Error(`Unsupported file type "${mediaType}". Use a JPEG, PNG, GIF or WebP.`);
    }
    content.push({
      type: 'image_url',
      image_url: { url: `data:${mediaType};base64,${call.image.base64}` },
    });
  }
  content.push({ type: 'text', text: call.prompt });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), call.timeoutMs ?? 120_000);
  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: call.model,
        // NOT max_tokens — gpt-5.x rejects it. NOT temperature — same.
        max_completion_tokens: call.maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          ...(call.system ? [{ role: 'system', content: call.system }] : []),
          { role: 'user', content },
        ],
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string; code?: string; type?: string };
    choices?: { message?: { content?: string }; finish_reason?: string }[];
  } | null;

  if (!res.ok) {
    const err = body?.error;
    // The API's own message, verbatim. A wrapped one hides the model id that was
    // actually refused, which is the only fact anyone wants from this error.
    throw new Error(
      `OpenAI ${res.status} for model "${call.model}": ${err?.message ?? 'no error body'}${
        err?.code ? ` (${err.code})` : ''
      }`,
    );
  }

  const choice = body?.choices?.[0];
  const text = choice?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    // A `length` finish with empty content is the truncation case, and saying so
    // points at max_completion_tokens rather than at the prompt.
    throw new Error(
      `OpenAI returned no content for model "${call.model}" (finish_reason: ${choice?.finish_reason ?? 'unknown'})`,
    );
  }
  return text;
}

/**
 * One STREAMING chat-completions call, handed back as the raw `Response` for
 * the caller to read frame by frame.
 *
 * ADDED FOR FINCH'S WORKFLOW TIER (Manufacturing C1), ALONGSIDE `openaiJson`
 * RATHER THAN INSTEAD OF IT. The two calls want opposite things: `openaiJson`
 * wants one settled JSON object and the Doc-U lane must keep getting exactly
 * that, while a chat turn wants tokens as they are produced and tool calls as
 * they are decided. Sharing the key handling and the verbatim-error rule is
 * worth one more export; sharing a return type would mean changing the
 * extraction lane to get a chat feature, which is not a trade this file makes.
 *
 * DELIBERATELY DUMB, like its neighbour: the request body is the caller's, the
 * SSE frames are the caller's to parse (lib/ai/finch/openai-loop.ts). All this
 * owns is the key, the URL and turning a non-2xx into an error that names the
 * model the API actually refused.
 *
 * NO `temperature`, and `max_completion_tokens` NOT `max_tokens` — the same two
 * gpt-5.x rules the header of this file explains. The caller supplies both the
 * budget and, when it sends function tools, `reasoning_effort: 'none'`.
 */
export async function openaiChatStream(
  body: Record<string, unknown>,
  opts: { signal?: AbortSignal } = {},
): Promise<Response> {
  const key = (process.env.OPENAI_API_KEY ?? '').trim();
  if (!key) throw new Error('OPENAI_API_KEY is not configured');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    signal: opts.signal,
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!res.ok || !res.body) {
    // The error body is JSON even on a streaming request — it failed before the
    // stream began. Its own message, verbatim, for the same reason as above.
    const detail = (await res.json().catch(() => null)) as { error?: { message?: string; code?: string } } | null;
    const err = detail?.error;
    throw new Error(
      `OpenAI ${res.status} for model "${String(body.model ?? 'unknown')}": ${err?.message ?? 'no error body'}${
        err?.code ? ` (${err.code})` : ''
      }`,
    );
  }
  return res;
}

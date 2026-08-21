import 'server-only';
import { extractOrderDocumentAnthropic } from './anthropic';
import {
  buildOrderPrompt,
  coerceOrderExtraction,
  type OrderExtractionResult,
} from './order-prompt';
import { isSupportedImageType, normaliseImageType, openaiConfigured, openaiJson } from './openai';
import { applyRowArithmeticToLines } from '@/lib/platform/docu/row-arithmetic';

/**
 * The order lane's READER, and the only thing application code calls to read an
 * uploaded customer order.
 *
 * TWO PROVIDERS, ONE CONTRACT. `ORDER_EXTRACT_PROVIDER` selects between OpenAI
 * and Anthropic; both are handed the identical instruction from
 * `./order-prompt`, so the comparison is about the model and not about the
 * prompt. The default is **openai** — the order lane is where the reading has
 * been failing, and Luna is here to be tested on it rather than to sit behind a
 * flag nobody flips.
 *
 * THE ANTHROPIC PATH IS NOT DECOMMISSIONED. It is the fallback, and it runs on
 * any OpenAI failure at all: no key, a rejected model id, a timeout, a 500. A
 * document that fails to read is a document a human has to re-upload, and that
 * is a far worse outcome than a document read by the second-choice model — so
 * long as the screen SAYS SO, which is what `warning` is for. A silent fallback
 * would recreate exactly the condition that cost an afternoon last time: a
 * document read by a model nobody chose, with nothing recording which.
 *
 * ARITHMETIC RUNS AFTERWARDS, REGARDLESS OF PROVIDER. `applyRowArithmetic` is
 * not reading and does not belong to a reader — it is the row's own printed
 * total deciding which of its columns multiply. See
 * `lib/platform/docu/row-arithmetic.ts`.
 */

/** Which provider reads orders. Default openai — see above. */
export type OrderProvider = 'openai' | 'anthropic';

export function orderProvider(): OrderProvider {
  return (process.env.ORDER_EXTRACT_PROVIDER ?? '').trim().toLowerCase() === 'anthropic'
    ? 'anthropic'
    : 'openai';
}

/** The OpenAI model the order reader uses. */
export function openaiOrderModel(): string {
  return (process.env.OPENAI_ORDER_MODEL ?? '').trim() || 'gpt-5.6-luna';
}

export interface OrderReadParams {
  base64: string;
  mediaType: string;
  filename: string;
  products?: string[];
  note?: string;
}

/** Read one uploaded customer order into structured lines. */
export async function extractOrderDocument(params: OrderReadParams): Promise<OrderExtractionResult> {
  const provider = orderProvider();

  if (provider === 'openai') {
    try {
      const result = await readWithOpenAi(params);
      return withArithmetic(result);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      // Fall through to Claude, and say so on the document. The API's own words
      // are carried into the warning verbatim: "model_not_found" is the answer
      // to the only question anyone asks after a fallback.
      const fallback = await extractOrderDocumentAnthropic(params);
      return withArithmetic({
        ...fallback,
        warning: `Read by ${fallback.model} — the ${openaiOrderModel()} read failed: ${detail}`,
      });
    }
  }

  return withArithmetic(await extractOrderDocumentAnthropic(params));
}

/** The OpenAI half. A PDF cannot go down this path — see below. */
async function readWithOpenAi(params: OrderReadParams): Promise<OrderExtractionResult> {
  if (!openaiConfigured()) throw new Error('OPENAI_API_KEY is not configured');

  const isPdf =
    params.mediaType === 'application/pdf' || params.filename.toLowerCase().endsWith('.pdf');
  // The chat-completions image part takes images, not PDFs. Rather than reach
  // for a second endpoint shape for one file type, a PDF order raises here and
  // takes the Anthropic fallback — which reads PDFs natively and has done since
  // the beginning. The reviewer sees the reason on the document.
  if (isPdf) throw new Error('PDF orders are read by the Anthropic path (no image input)');

  const mediaType = normaliseImageType(params.mediaType);
  if (!isSupportedImageType(mediaType)) {
    throw new Error(`Unsupported file type "${mediaType}". Use a PDF, JPEG, PNG, GIF or WebP.`);
  }

  const model = openaiOrderModel();
  const raw = await openaiJson({
    model,
    prompt: buildOrderPrompt(params),
    image: { base64: params.base64, mediaType },
    // Generous: a three-page purchase order is twenty-odd lines of ten fields,
    // and on a reasoning model the thinking is billed against this same budget.
    // A truncated read comes back as valid JSON with lines missing, which is the
    // one failure mode nothing downstream can detect.
    maxTokens: 16_000,
  });

  return { ...coerceOrderExtraction(raw), model: `openai/${model}` };
}

/** Total-first arithmetic over every line, whoever read them. */
function withArithmetic(result: OrderExtractionResult): OrderExtractionResult {
  return { ...result, line_items: applyRowArithmeticToLines(result.line_items) };
}

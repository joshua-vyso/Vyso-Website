import 'server-only';
import { extractOrderDocumentAnthropic } from './anthropic';
import {
  buildOrderPrompt,
  coerceOrderExtraction,
  openaiOrderModel,
  orderProvider,
  type OrderExtractionResult,
} from './order-prompt';
import { isSupportedImageType, normaliseImageType, openaiConfigured, openaiJson } from './openai';
import { applyRowArithmeticToLines } from '@/lib/platform/docu/row-arithmetic';
import {
  auditExtractionStructure,
  finalizeExtractionConfidence,
  shouldRetryPdfOrientation,
} from '@/lib/platform/docu/extraction-quality';
import { pdfOrientationCandidates } from '@/lib/platform/docu/pdf-orientation';

/**
 * The order lane's READER, and the only thing application code calls to read an
 * uploaded customer order.
 *
 * TWO PROVIDERS, ONE CONTRACT. `ORDER_EXTRACT_PROVIDER` selects between OpenAI
 * and Anthropic; both are handed the identical instruction from
 * `./order-prompt`, so the comparison is about the model and not about the
 * prompt.
 *
 * THE DEFAULT IS **anthropic**, AND IT IS THE BENCH THAT SAYS SO. `02a25ef`
 * made Luna the default to have it tested in the lane where reading was
 * failing, which was the right instinct and the wrong order: it shipped before
 * anything measured it, and Turn 'n Slice measured it for us, in production, on
 * live orders. `scripts/extraction-bench.mjs` now does that job properly — the
 * same degraded 22-line Bakubung purchase order through each prompt × model,
 * four runs each — and the gap is not close:
 *
 *     HEAD prompt · claude-sonnet-4-6   names 100%   digits 63%
 *     HEAD prompt · gpt-5.6-luna        names  68%   digits  4%
 *
 * Luna does not merely misread this document, it declines it: nearly every
 * unit-price and amount comes back blank, and the product names it does return
 * carry inventions ("Bananas Bunch", "Baby Marrows 2") that no honesty gate
 * downstream can catch, because a plausible product name is not a detectable
 * error. Sonnet read all 22 rows correctly by name in every run.
 *
 * THE OPENAI PATH IS NOT DECOMMISSIONED, it has swapped seats: set
 * `ORDER_EXTRACT_PROVIDER=openai` to put Luna back in front, and re-run the
 * bench before believing it has improved.
 *
 * FALLBACK RUNS ON ANY FAILURE OF THE CHOSEN PROVIDER: no key, a rejected model
 * id, a timeout, a 500. A document that fails to read is a document a human has
 * to re-upload, and that is a far worse outcome than a document read by the
 * second-choice model — so long as the screen SAYS SO, which is what `warning`
 * is for. A silent fallback would recreate exactly the condition that cost an
 * afternoon: a document read by a model nobody chose, with nothing recording
 * which.
 *
 * ARITHMETIC RUNS AFTERWARDS, REGARDLESS OF PROVIDER. `applyRowArithmetic` is
 * not reading and does not belong to a reader — it is the row's own printed
 * total deciding which of its columns multiply. See
 * `lib/platform/docu/row-arithmetic.ts`.
 */

// `orderProvider` and `openaiOrderModel` live in `./order-prompt` with the rest
// of the contract, and are re-exported here because this is where callers look
// for them. They are pure env reads, and being pure is the point: `server-only`
// on this module means a node test cannot reach them here, and a default nobody
// can pin is a default that flips again.
export {
  openaiOrderModel,
  orderProvider,
  type OrderProvider,
} from './order-prompt';

export interface OrderReadParams {
  base64: string;
  mediaType: string;
  filename: string;
  products?: string[];
  note?: string;
  /**
   * Set by the caller when the bytes handed to this reader have ALREADY been
   * through PDF-orientation recovery — set by `document-ingest.ts` whenever
   * `preparedDocumentInput` returned a rotated copy from the classification
   * read, and ALWAYS on a routing-escalation second opinion
   * (`lib/platform/docu/classification-policy.ts`). Skips this reader's own
   * retry loop entirely: retrying rotation twice over the same document
   * (once in the classification lane, again here) would double the
   * unattended-document cost for a rotation search that already ran.
   */
  orientationChecked?: boolean;
}

/**
 * Read one uploaded customer order into structured lines.
 *
 * The chosen provider reads it; the OTHER one catches it if that fails. The
 * ladder runs in both directions now that the default has moved — a reader that
 * only knew how to fall back one way would have left an Anthropic outage with
 * no second chance at all, purely because of which provider happened to be in
 * front on the day it was written.
 */
export async function extractOrderDocument(params: OrderReadParams): Promise<OrderExtractionResult> {
  const initial = await readOrderOnce(params);
  const isPdf =
    params.mediaType === 'application/pdf' || params.filename.toLowerCase().endsWith('.pdf');
  if (params.orientationChecked || !isPdf || !shouldRetryPdfOrientation(initial)) {
    const structureAudit = auditExtractionStructure(initial);
    return {
      ...initial,
      overall_confidence: finalizeExtractionConfidence(initial.overall_confidence, {
        adoptedRotation: false,
        auditStatus: structureAudit.status,
      }),
      structure_audit: structureAudit,
    };
  }

  try {
    const variants = await pdfOrientationCandidates(params.base64);
    let best = initial;
    let bestScore = auditExtractionStructure(initial).score;
    let selectedRotation = variants.originalRotation;
    const attempted: number[] = [];
    for (const variant of variants.candidates) {
      attempted.push(variant.rotation);
      const candidate = await readOrderOnce({ ...params, base64: variant.base64 });
      // Hoisted: this used to run auditExtractionStructure(candidate) twice
      // (once for the score, again for the status in the break check below).
      const candidateAudit = auditExtractionStructure(candidate);
      if (candidateAudit.score > bestScore) {
        best = candidate;
        bestScore = candidateAudit.score;
        selectedRotation = variant.rotation;
      }
      if (candidateAudit.score >= 85 && candidateAudit.status === 'ok') break;
    }
    const structureAudit = auditExtractionStructure(best);
    const adoptedRotation = best !== initial;
    return {
      ...best,
      overall_confidence: finalizeExtractionConfidence(best.overall_confidence, {
        adoptedRotation,
        auditStatus: structureAudit.status,
      }),
      structure_audit: structureAudit,
      // Only record provenance when a rotation was actually TRIED. An empty
      // `attempted_rotations` (variants.candidates was empty — a multi-page
      // PDF, see pdf-orientation.ts) is not provenance, it's noise, and used
      // to be stored anyway.
      ...(attempted.length > 0
        ? {
            orientation_normalization: {
              applied: adoptedRotation,
              original_rotation: variants.originalRotation,
              selected_rotation: selectedRotation,
              attempted_rotations: attempted,
            },
          }
        : {}),
    };
  } catch {
    const structureAudit = auditExtractionStructure(initial);
    return {
      ...initial,
      overall_confidence: finalizeExtractionConfidence(initial.overall_confidence, {
        adoptedRotation: false,
        auditStatus: structureAudit.status,
      }),
      structure_audit: structureAudit,
    };
  }
}

async function readOrderOnce(params: OrderReadParams): Promise<OrderExtractionResult> {
  const primary = orderProvider();
  const read = primary === 'openai' ? readWithOpenAi : extractOrderDocumentAnthropic;
  const backup = primary === 'openai' ? extractOrderDocumentAnthropic : readWithOpenAi;

  try {
    return withArithmetic(await read(params));
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    // Fall through to the other provider, and SAY SO on the document. The API's
    // own words are carried into the warning verbatim: "model_not_found" is the
    // answer to the only question anyone asks after a fallback.
    const fallback = await backup(params);
    return withArithmetic({
      ...fallback,
      warning: `Read by ${fallback.model} — the ${primary} read failed: ${detail}`,
    });
  }
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

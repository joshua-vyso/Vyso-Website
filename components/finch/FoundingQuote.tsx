import { FinchBirdMark } from "./FinchBirdMark";
import { Band } from "./ground/Band";
import { WaveField } from "./ground/WaveField";
import { WaveClockProvider } from "./ground/wave-clock";

/* ── Roberto, over the wave ──────────────────────────────────────────────────
   The homepage's **ink** band (§7): ten orange sine lines at 16px amplitude
   roll across it. The band moves; **the quote does not.**

   It used to. The words rode the field per-word through `WaveText`, which is
   §4.1's signature move and is right for a Statement — a short, wide, declared
   line where a crest crossing left to right reads as breathing. It is wrong
   here: this is four lines of somebody else's sentence at 44px, and per-word
   `y` on wrapped prose reads as the text warping rather than as the ground
   breathing. Josh's 6b review said exactly that, and it is the correct reading.

   So the quote is static and the field keeps moving. The band still holds one
   moving thing (the canvas), which also puts a viewport of budget back.
   `WaveClockProvider` stays because `WaveField` takes its clock from it.

   Three colour and type decisions, all §2/§4:
   - The bird is a flat `--fn-orange-on-ink` silhouette (`FinchBirdMark`), not
     the gradient logo. On ink the logo's blue half falls to ~2:1, and a
     multi-colour mark next to a statement competes with the band's one orange
     element.
   - The quote is the Statement's family and tracking at **44px, weight 400 and
     upright** — deliberately below `STATEMENT_CLASS`'s 72px/500 and without its
     italic, because this is somebody else's sentence, not the site's own claim.
     Quotation marks stay: a pull-quote that drops them stops being a quote.
   - The attribution is `--fn-ink-mono`, the dimmest thing §2 allows on ink and
     the right weight for provenance rather than voice.

   The field is the band's one device and the only moving thing in the band —
   including the bird, and now including the words.                            */
export function FoundingQuote() {
  return (
    <WaveClockProvider amplitude={16}>
      <Band
        ground="ink"
        device={<WaveField lines={10} amplitude={16} color="--fn-orange" opacity={0.34} />}
        intrinsicHeight={520}
        contentClassName="text-center"
        /* 6b-fixes: the ink preset (112/120) is sized for a hero-weight band;
           four lines of pull-quote at 44px don't need that much air. Own
           override rather than touching `PADDING.ink` — the audit statement
           and the COO hero are still full-weight ink bands and keep the
           preset. 511px measured band vs 156px content before this. */
        paddingClassName="pt-[64px] pb-[72px] lg:pt-[96px] lg:pb-[104px]"
      >
        <div className="mx-auto max-w-[860px]">
          <FinchBirdMark color="var(--fn-orange-on-ink)" size={44} className="mb-[28px]" />
          <blockquote className="m-0 mb-[28px]">
            <p className="m-0 font-fn-serif text-[30px] font-normal leading-[1.25] tracking-[-0.02em] text-balance text-fn-ink-text lg:text-[44px] lg:leading-[1.18]">
              &ldquo;Finch automates our invoicing, ordering, and insight into how our company is
              actually running.&rdquo;
            </p>
          </blockquote>
          <div className="font-fn-mono text-[11.5px] tracking-[0.1em] text-fn-ink-mono">
            ROBERTO · TURN &rsquo;N SLICE · JOHANNESBURG · FOUNDING CLIENT
          </div>
        </div>
      </Band>
    </WaveClockProvider>
  );
}

export default FoundingQuote;

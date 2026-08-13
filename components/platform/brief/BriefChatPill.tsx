import { AI_GRADIENT_CHROME, AI_GRADIENT_TEXT } from './brief-display';

/**
 * The chat pill — the Brief's second half, present but not yet wired.
 *
 * Wave A ships the chrome only; Wave B connects it to Finch
 * (.ai/plan_brief_home.md § Wave B). It therefore renders DISABLED rather than
 * as a live-looking input that swallows what the owner types, and the hint line
 * says so — the brand labels unfinished features instead of faking them. The
 * mock's "Tap any finding to bring it into the conversation" is a promise about
 * behaviour that doesn't exist yet, so it waits for the behaviour.
 *
 * Sticky rather than fixed: it sits at the bottom of the page's own scroll
 * column, so the platform TopBar above it and the modules beside it are
 * untouched.
 */
export function BriefChatPill() {
  return (
    <div className="sticky bottom-0 mt-8 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,#FFFFFF_55%)] px-1 pb-6 pt-7">
      {/* 1.5px gradient border, drawn as padding under a white inner pill — one
          of the four places this gradient is allowed to appear. */}
      <div
        className="mx-auto max-w-[680px] rounded-full p-[1.5px] opacity-60 shadow-[0_16px_50px_-12px_rgba(31,95,168,0.18)]"
        style={{ background: AI_GRADIENT_CHROME }}
      >
        <div className="flex items-center gap-3 rounded-full bg-white py-[13px] pl-5 pr-2">
          <span
            className="bg-clip-text text-[15px] text-transparent"
            style={{ backgroundImage: AI_GRADIENT_TEXT }}
            aria-hidden
          >
            ✦
          </span>
          <input
            type="text"
            disabled
            placeholder="Ask Vyso anything about your operation…"
            aria-label="Ask Vyso (coming soon)"
            className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[var(--pf-text)] outline-none placeholder:text-[var(--pf-text-muted)] disabled:cursor-not-allowed"
          />
          <button
            type="button"
            disabled
            aria-label="Send (coming soon)"
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-[var(--pf-text)] text-white disabled:cursor-not-allowed"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
      <p className="mx-auto mt-2 max-w-[680px] text-center text-[11.5px] text-[var(--pf-text-faint)]">
        Asking Vyso about your operation lands here soon.
      </p>
    </div>
  );
}

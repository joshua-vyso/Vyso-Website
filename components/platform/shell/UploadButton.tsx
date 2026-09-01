import Link from 'next/link';

/**
 * The global Upload control (`.ai/plan_phase0_teardown_shell.md` Task E4).
 *
 * ONE PLACE TO PUT A DOCUMENT IN, reachable from every screen. Until now the
 * only ways to file paperwork were Doc-U's own upload page, the chat's
 * paperclip and the drop zone — and two of those three left with the chat
 * surfaces in Task D. This is the replacement, and it is deliberately a plain
 * link rather than a picker: Phase 1 swaps the destination for the upload tray
 * and `/api/ingest`, so anything clever built here would be built twice.
 *
 * A LINK, NOT A BUTTON, and therefore no `'use client'`. It has no state and no
 * handler, so it is safe to import from AppRail (a server component) as well as
 * from MobileTopBar (a client one) — the same rule shell-data.ts and
 * nav-config.ts follow.
 *
 * STYLED AS THE PRIMARY ACTION, one size smaller. The tokens are
 * `PrimaryAction`'s (components/platform/module-ui.tsx) — `--pf-accent-strong`
 * with `--pf-accent-deep` on hover, `--pf-radius-control` — because this IS the
 * primary action of the shell and the platform has exactly one accent. The
 * height drops from 42px to 36px for the two places it has to fit: a 216px rail
 * beside a 64px logo, and a 56px mobile bar beside a 40px menu button.
 *
 * THE LABEL STAYS AT EVERY WIDTH. An icon-only button here would be a bare
 * arrow with no established meaning — this is a new control, not a hamburger —
 * and the whole cluster (80px mark + 85px here + 40px menu + gutters) still
 * fits a 320px handset with the trial pill hidden, which is exactly what that
 * pill's `hidden sm:inline-flex` is for. `className` is for the caller's
 * MARGINS, not for hiding half of it.
 */
export function UploadButton({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/app/docu/upload"
      title="Upload a document"
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--pf-radius-control)] bg-[var(--pf-accent-strong)] px-3 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--pf-accent-deep)] ${className}`}
      style={{ transitionDuration: 'var(--dur-hover)' }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="shrink-0"
      >
        <path d="M12 16.5V4.5M12 4.5 7.75 8.75M12 4.5l4.25 4.25M4.5 19.5h15" />
      </svg>
      Upload
    </Link>
  );
}

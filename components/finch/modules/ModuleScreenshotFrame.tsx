import Image from "next/image";

/* ── The Finch-style screenshot frame ────────────────────────────────────────
   `components/marketing/ScreenshotFrame.tsx` (the old design) draws a glass
   browser window — traffic-dot bar, faux URL pill, orange glow, frosted top
   layer. The plan asks for the opposite on this page: "soft border, radius
   12, no browser chrome." This is that — a plain white surface with a
   hairline border and the module's `app.vyso.co.za/...` path set underneath
   as a quiet mono caption instead of a fake browser bar.

   The masked patch in the top-right corner is not chrome — it is privacy: the
   demo-account chip ("Meridian Food Co. / demo@vyso.co.za") baked into every
   capture. Kept for the same reason the old frame kept it, drawn as a plain
   opaque tile (`bg-fn-surface`) rather than a frosted blur, since blur reads
   as glass and this page has none.                                          */

const DEFAULT_WIDTH = 3200;
const DEFAULT_HEIGHT = 2000;
const DEFAULT_SIZES = "(max-width: 760px) 92vw, (max-width: 1020px) 80vw, 640px";

export interface ModuleScreenshotFrameProps {
  src: string;
  alt: string;
  /** The app path shown under the frame, e.g. "app.vyso.co.za/docu". */
  label?: string;
  width?: number;
  height?: number;
  aspect?: string;
  /** The capture has empty space in its lower ~40% — show only the top. */
  cropTop?: boolean;
  priority?: boolean;
  /** Masks the demo-account chip baked into the top-right of every capture. */
  maskAccountChip?: boolean;
  sizes?: string;
  className?: string;
}

export function ModuleScreenshotFrame({
  src,
  alt,
  label,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  aspect,
  cropTop = false,
  priority = false,
  maskAccountChip = true,
  sizes = DEFAULT_SIZES,
  className = "",
}: ModuleScreenshotFrameProps) {
  const resolvedAspect =
    aspect ?? (cropTop ? `${width} / ${Math.round(height * 0.6)}` : `${width} / ${height}`);

  return (
    <figure className={`m-0 ${className}`}>
      <div
        className="relative overflow-hidden rounded-[12px] border border-fn-line bg-fn-surface shadow-[var(--fn-shadow-card)]"
        style={{ aspectRatio: resolvedAspect }}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={sizes}
          priority={priority}
          className={
            cropTop
              ? "h-full w-full object-cover object-top"
              : "h-full w-full object-cover object-top"
          }
        />
        {maskAccountChip ? (
          <span
            aria-hidden="true"
            className="absolute right-[10px] top-[10px] h-[26px] w-[168px] rounded-[6px] bg-fn-surface"
          />
        ) : null}
      </div>
      {label ? (
        <figcaption className="mt-[10px] font-fn-mono text-[10.5px] tracking-[0.08em] text-fn-muted">
          {label}
        </figcaption>
      ) : null}
    </figure>
  );
}

export default ModuleScreenshotFrame;

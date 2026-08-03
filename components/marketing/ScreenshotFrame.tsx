import Image from "next/image";
import { Lock } from "lucide-react";

import styles from "./ScreenshotFrame.module.css";

const DEFAULT_WIDTH = 3200;
const DEFAULT_HEIGHT = 2000;
const DEFAULT_SIZES = "(max-width: 760px) 92vw, (max-width: 1020px) 80vw, 640px";

export interface ScreenshotFrameProps {
  /** Path under /public, e.g. "/screenshots/modules/orderflow-invoicing.png". */
  src: string;
  alt: string;
  /** Faux browser-bar URL, e.g. "app.vyso.co.za/orderflow". Omit to hide the bar label. */
  label?: string;
  /** Intrinsic size of the source PNG. Defaults to the 3200×2000 capture size. */
  width?: number;
  height?: number;
  /** Explicit CSS aspect-ratio override, e.g. "8 / 3". Defaults from width/height. */
  aspect?: string;
  /**
   * The capture has empty space in its lower ~40% — show only the top of the
   * image (shorter frame, object-position: top) instead of the full frame.
   */
  cropTop?: boolean;
  /** Preloads the image for LCP — use on the one hero/above-the-fold screenshot per page. */
  priority?: boolean;
  /**
   * Frosted-glass patch over the top-right account chip ("Meridian Food Co. /
   * demo@vyso.co.za") baked into every capture, so the demo email isn't legible
   * on marketing pages. On by default.
   */
  maskAccountChip?: boolean;
  sizes?: string;
  quality?: number;
  className?: string;
}

/**
 * Presentational, server-safe "browser window" frame for real platform
 * screenshots: rounded glass frame, top bar with traffic dots + optional faux
 * URL pill, soft orange-tinted glow behind, and a frosted overlay patch that
 * blurs the demo-account chip baked into the top-right of every capture.
 */
export function ScreenshotFrame({
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
  quality,
  className,
}: ScreenshotFrameProps) {
  const resolvedAspect =
    aspect ?? (cropTop ? `${width} / ${Math.round(height * 0.6)}` : `${width} / ${height}`);

  return (
    <div className={className ? `${styles.wrap} ${className}` : styles.wrap}>
      <span className={styles.glow} aria-hidden="true" />
      <div className={styles.frame}>
        <div className={styles.bar}>
          <span className={styles.dots} aria-hidden="true">
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </span>
          {label ? (
            <span className={styles.urlPill}>
              <Lock size={10} className={styles.urlLock} aria-hidden="true" />
              <span>{label}</span>
            </span>
          ) : null}
        </div>
        <div
          className={cropTop ? `${styles.imageWrap} ${styles.cropTop}` : styles.imageWrap}
          style={{ aspectRatio: resolvedAspect }}
        >
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            sizes={sizes}
            quality={quality}
            preload={priority}
          />
          {maskAccountChip ? <span className={styles.chipMask} aria-hidden="true" /> : null}
        </div>
      </div>
    </div>
  );
}

export default ScreenshotFrame;

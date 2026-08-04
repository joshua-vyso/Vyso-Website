"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import styles from "./IntegrationsMarquee.module.css";

/*
  ── Integrations marquee ───────────────────────────────────────────────────
  A rounded rail carrying one row of integration logos that scrolls forever.
  The logo nearest the rail's horizontal centre is shown in full colour at
  1.15× ; everything else sits greyed and dimmed. The centred integration's
  name prints underneath, inside the rail.

  ANIMATION — rAF driving a single transform
  ------------------------------------------
  The track renders the roster `COPIES` times and is translated by an offset
  that wraps at exactly one roster width (`ROSTER.length × item pitch`), so the
  wrap is pixel-identical to the frame before it — seamless with no snap.

  Every slot is a fixed `--item-w` wide (no flex gap), which is what makes the
  centre-detection free: the focused index falls straight out of the offset,

      index = round((offset + railWidth / 2 − itemWidth / 2) / itemWidth)

  rather than needing per-frame getBoundingClientRect() over 39 nodes. Only
  transforms are written each frame; React re-renders once per centre change
  (~1.4s), not per frame.

  THE GOO LAYER — why the surface is not a CSS background
  ------------------------------------------------------
  The highlight used to be a halo drawn *inside* the scrolling viewport, so the
  rail's rounded rect sliced its top and bottom off. Instead the rail's surface
  is now a metaball composite: a `<div>` stack (rounded bar + travelling circle,
  both solid white) run through one SVG filter — a wide Gaussian blur followed
  by an alpha-contrast `feColorMatrix`. Two shapes that overlap after the blur
  re-threshold into a single silhouette with a fluid meniscus where they join,
  so the bar *bulges* around the circle and the circle's crown and foot stand
  proud of the bar instead of being clipped. The same filter chain adds the
  drop shadows, so the whole surface still reads as the glass bar it replaced,
  and the logo/label layer sits above it, untouched by the filter.

  The circle's x is not snapped to the centred slot: a critically damped spring
  (with the track's own velocity fed forward, so there is no steady-state lag)
  chases the centred logo's live on-screen x. It therefore drifts along with
  whichever logo currently owns the centre and springs one pitch across at the
  hand-over.
*/

interface Integration {
  name: string;
  file: string;
  /* Set for marks that are white/near-white and need a neutral tile behind
     them to stay visible on the light rail. Nothing needs it today. */
  tile?: boolean;
}

/* Display order is deliberate — brand colours and mark shapes alternate so the
   row keeps a rhythm as it passes the centre. */
const ROSTER: Integration[] = [
  { name: "Xero",               file: "xero.svg"       },
  { name: "WhatsApp Business",  file: "whatsapp.svg"   },
  { name: "Gmail",              file: "gmail.svg"      },
  { name: "Yoco",               file: "yoco.svg"       },
  { name: "QuickBooks",         file: "quickbooks.svg" },
  { name: "Notion",             file: "notion.svg"     },
  { name: "Claude",             file: "claude.svg"     },
  { name: "n8n",                file: "n8n.svg"        },
  { name: "Outlook",            file: "outlook.svg"    },
  { name: "SimplePay",          file: "simplepay.svg"  },
  { name: "Sage Accounting",    file: "sage.svg"       },
  { name: "Loyverse POS",       file: "loyverse.svg"   },
  { name: "GPT",                file: "gpt.svg"        },
];

/* Three passes of the roster guarantee the rail stays full at every offset:
   the visible window is at most (roster width + rail width) into the track. */
const COPIES = 3;

/* Calm pace — one logo width every 1.4s. */
const SECONDS_PER_ITEM = 1.4;

/* Frame clamp: a backgrounded tab hands back a huge delta on return, which
   would teleport the rail. 100ms keeps the wrap smooth either way. */
const MAX_FRAME_MS = 100;

/* Blob geometry, both as a fraction of the rail's height so desktop (≈148px)
   and mobile (≈111px) get the same proportions from one measurement.
     · BULGE  — how far the circle stands proud of the bar, top and bottom.
       The circle's diameter is therefore railHeight + 2 × bulge.
     · BLUR   — the metaball blur. Large enough to fillet the join into a
       meniscus, small enough that the shallow cap survives thresholding
       (a convex edge only shrinks by ~σ²/radius ≈ 1px at this scale).       */
const BULGE_RATIO = 0.085;
const BLUR_RATIO  = 0.068;

/* Halo that rides with the blob, drawn above the goo layer so the filter can't
   touch it. Sized off the logo row: 1.226 × the row height == 1.9 × logo. */
const GLOW_RATIO = 1.226;

/* The frost circle sits this far inside the goo circle. The metaball threshold
   pulls convex corners in by about σ²/radius (≈4px on the bar's corners), so a
   frost shape flush with the goo shape would poke out of the silhouette it is
   supposed to be frosting. */
const FROST_INSET = 3;

/* Critically damped spring, rad/s. ω = 15 settles the one-pitch hand-over in
   roughly 4/ω ≈ 270ms. Integrated in sub-steps so a 100ms frame can't blow the
   explicit integrator up (stability needs 2ωh < 2). */
const SPRING_OMEGA    = 15;
const SPRING_MAX_STEP = 1 / 120;

/* Single instance per page, so a constant id is safe — and `useId()` returns a
   value containing characters that are awkward inside `url(#…)`. */
const GOO_FILTER_ID = "vyso-integrations-goo";

export function IntegrationsMarquee() {
  const railRef     = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef    = useRef<HTMLDivElement>(null);
  const blobRef     = useRef<HTMLDivElement>(null);
  const frostRef    = useRef<HTMLDivElement>(null);
  const glowRef     = useRef<HTMLDivElement>(null);
  const blurRef     = useRef<SVGFEGaussianBlurElement>(null);

  const pausedRef = useRef(false);
  const activeRef = useRef(0);

  const [active, setActive] = useState(0);
  const [reduced, setReduced] = useState(false);

  const pause  = useCallback(() => { pausedRef.current = true;  }, []);
  const resume = useCallback(() => { pausedRef.current = false; }, []);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync  = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduced) return;

    const rail     = railRef.current;
    const viewport = viewportRef.current;
    const track    = trackRef.current;
    const blob     = blobRef.current;
    const frost    = frostRef.current;
    const glow     = glowRef.current;
    if (!rail || !viewport || !track || !blob || !frost || !glow) return;

    let itemW = 0;
    let railW = 0;

    /* Layout-dependent geometry is written once per resize, never per frame:
       the blob and the halo are sized/parked here and only their `transform`
       moves afterwards. */
    const measure = () => {
      const first = track.firstElementChild as HTMLElement | null;
      itemW = first ? first.getBoundingClientRect().width : 0;

      const railBox = rail.getBoundingClientRect();
      railW = railBox.width;
      const railH = railBox.height;
      if (railH === 0) return;

      const blobD = railH + 2 * railH * BULGE_RATIO;
      blob.style.width      = `${blobD}px`;
      blob.style.height     = `${blobD}px`;
      blob.style.marginLeft = `${-blobD / 2}px`;
      blob.style.marginTop  = `${-blobD / 2}px`;

      /* The frost circle is inset inside the goo circle so it can never poke
         out of the silhouette it is meant to be frosting. */
      const frostD = blobD - 2 * FROST_INSET;
      frost.style.width      = `${frostD}px`;
      frost.style.height     = `${frostD}px`;
      frost.style.marginLeft = `${-frostD / 2}px`;
      frost.style.marginTop  = `${-frostD / 2}px`;

      blurRef.current?.setAttribute("stdDeviation", (railH * BLUR_RATIO).toFixed(2));

      const glowD = viewport.offsetHeight * GLOW_RATIO;
      glow.style.width      = `${glowD}px`;
      glow.style.height     = `${glowD}px`;
      glow.style.marginLeft = `${-glowD / 2}px`;
      glow.style.marginTop  = `${-glowD / 2}px`;
      glow.style.top        = `${viewport.offsetTop + viewport.offsetHeight / 2}px`;
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(rail);

    let offset = 0;
    let last   = 0;
    let raf    = 0;

    let blobX  = 0;
    let blobV  = 0;
    let primed = false;

    const step = (now: number) => {
      const delta = last === 0 ? 0 : Math.min(now - last, MAX_FRAME_MS);
      last = now;

      if (itemW > 0) {
        const cycle  = ROSTER.length * itemW;
        const paused = pausedRef.current;
        const dt     = delta / 1000;

        if (!paused) {
          offset = (offset + (itemW / SECONDS_PER_ITEM) * dt) % cycle;
        }

        track.style.transform = `translate3d(${-offset}px, 0, 0)`;

        // Index of the slot whose centre sits closest to the rail's centre.
        const centred = Math.round((offset + railW / 2 - itemW / 2) / itemW);
        if (centred !== activeRef.current) {
          activeRef.current = centred;
          setActive(centred);
        }

        /* Where that logo actually is right now, in rail coordinates. It slides
           left with the track and jumps one pitch right when the centre hands
           over — continuous across the wrap, because `centred` drops by exactly
           ROSTER.length at the same moment `offset` drops by one cycle. */
        const targetX = centred * itemW + itemW / 2 - offset;
        const targetV = paused ? 0 : -(itemW / SECONDS_PER_ITEM);

        if (!primed) {
          blobX  = targetX;
          blobV  = targetV;
          primed = true;
        } else {
          let remaining = dt;
          while (remaining > 0) {
            const h = Math.min(remaining, SPRING_MAX_STEP);
            remaining -= h;
            // Critically damped, with the target's velocity fed forward so the
            // blob rides *on* the drifting logo rather than trailing it.
            const accel =
              -2 * SPRING_OMEGA * (blobV - targetV) -
              SPRING_OMEGA * SPRING_OMEGA * (blobX - targetX);
            blobV += accel * h;
            blobX += blobV * h;
          }
        }

        const ride = `translate3d(${blobX}px, 0, 0)`;
        blob.style.transform  = ride;
        frost.style.transform = ride;
        glow.style.transform  = ride;
      }

      raf = window.requestAnimationFrame(step);
    };

    raf = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [reduced]);

  /* Reduced motion — a static, wrapping grid on a plain glass rail. No track,
     no blob, no filter: there is nothing moving for the goo to follow. */
  if (reduced) {
    return (
      <div className={`${styles.rail} ${styles.railStatic}`} ref={railRef}>
        <div className={styles.grid}>
          {ROSTER.map((item, i) => (
            <Image
              key={`${item.file}-${i}`}
              className={styles.gridLogo}
              src={`/integrations/${item.file}`}
              alt={item.name}
              width={48}
              height={48}
              unoptimized
            />
          ))}
        </div>
      </div>
    );
  }

  const logoSlots = Array.from({ length: COPIES }, () => ROSTER).flat();
  const focused   = ROSTER[active % ROSTER.length];

  return (
    <div
      ref={railRef}
      className={styles.rail}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      onTouchStart={pause}
      onTouchEnd={resume}
      role="group"
      aria-label="Integrations Vyso is built to plug into"
      tabIndex={0}
    >
      {/*
        The filter lives in a zero-sized SVG rather than `display: none`, which
        would stop Firefox resolving the reference. `sRGB` interpolation is
        both cheaper and what makes the white silhouette hold its colour.
      */}
      <svg className={styles.defs} aria-hidden="true" focusable="false">
        <defs>
          <filter
            id={GOO_FILTER_ID}
            colorInterpolationFilters="sRGB"
            x="-3%"
            y="-34%"
            width="106%"
            height="168%"
          >
            <feGaussianBlur ref={blurRef} in="SourceGraphic" stdDeviation="10" result="blur" />
            {/* Alpha contrast: everything the blur left above 50% snaps to
                opaque, everything below to nothing — the metaball threshold. */}
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
              result="goo"
            />
            {/* Drop the silhouette to 82% so the frosted backdrop underneath
                actually shows through — this is the whole difference between
                "white bar" and "glass". */}
            <feComponentTransfer in="goo" result="surface">
              <feFuncA type="linear" slope="0.82" />
            </feComponentTransfer>

            {/*
              Edges, as true rim bands rather than drop shadows.

              `feDropShadow` is NOT a rim: it paints a full, offset copy of the
              silhouette *behind* the source. That was invisible while the
              surface was opaque, but at 82% the white one showed straight
              through and dragged the whole surface back up to ~95% alpha —
              measured 232/255 over a black backdrop when 204 was intended.

              So the edges are built as a difference of the hard silhouette
              against a shifted copy of itself — a band exactly `dy` tall
              hugging an edge — which, being derived from the goo alpha,
              follows the bulge instead of cutting a straight line across it.

            One `xor` against a single shifted copy yields BOTH edges at once —
              (goo ∖ shifted) is the band just inside the top edge, the specular
              lip, and (shifted ∖ goo) is the band just outside the bottom edge,
              the rim light. Doing it in one pass rather than two matters: every
              primitive here is a full-filter-region pass, and two flood/composite
              groups measured ~33ms/frame on the software rasteriser against
              ~16ms for one.
            */}
            <feOffset in="goo" dy="1.5" result="shifted" />
            <feComposite in="goo" in2="shifted" operator="xor" result="rimHard" />
            <feGaussianBlur in="rimHard" stdDeviation="0.8" result="rim" />
            <feFlood floodColor="#ffffff" floodOpacity="0.9" result="whiteInk" />
            <feComposite in="whiteInk" in2="rim" operator="in" result="specular" />

            {/* The wide ambient shadow and the dark contact line are deliberately
                not in this chain — they sit on `.gooShadow` as plain box-shadows,
                which cost nothing per frame. */}
            <feMerge>
              <feMergeNode in="surface" />
              <feMergeNode in="specular" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Unfiltered, unmoving: the rail's ambient lift. */}
      <div className={styles.gooShadow} aria-hidden="true" />

      {/*
        Frost. `backdrop-filter` cannot ride inside an SVG filter chain, so the
        blur/saturate lives on its own unfiltered layer *under* the goo: a bar
        matching the rail plus a circle riding the same spring, so the bulge is
        frosted too. Neither carries a background tint — two overlapping
        translucent fills would double up into a visible disc inside the bar,
        and for the same reason there is no brightness/contrast here. All of
        the white is in the goo silhouette above, where the metaball maths
        already resolves bar ∪ circle into one surface.
      */}
      <div className={styles.frost} aria-hidden="true">
        <div className={styles.frostBar} />
        <div className={styles.frostBlob} ref={frostRef} />
      </div>

      <div
        className={styles.goo}
        style={{ filter: `url(#${GOO_FILTER_ID})` }}
        aria-hidden="true"
      >
        <div className={styles.gooBar} />
        <div className={styles.gooBlob} ref={blobRef} />
      </div>

      <div className={styles.glow} ref={glowRef} aria-hidden="true" />

      <div className={styles.viewport} ref={viewportRef}>
        <div className={styles.track} ref={trackRef}>
          {logoSlots.map((item, i) => (
            <div
              key={`${item.file}-${i}`}
              className={[
                styles.item,
                item.tile ? styles.tile : "",
                i === active ? styles.itemActive : "",
              ].filter(Boolean).join(" ")}
            >
              <Image
                className={styles.logo}
                src={`/integrations/${item.file}`}
                alt={item.name}
                width={48}
                height={48}
                unoptimized
              />
            </div>
          ))}
        </div>
      </div>

      <p className={styles.label}>
        <span key={focused.name} className={styles.labelText}>
          {focused.name}
        </span>
      </p>
    </div>
  );
}

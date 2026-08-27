/* ── Fonts for the OG image renderer ─────────────────────────────────────────
   `next/og` (satori) needs real font binaries — it cannot read the `next/font`
   CSS variables the site renders with, and there is no copy of STIX Two Text,
   DM Sans or IBM Plex Mono in the repo (they are all `next/font/google`
   downloads that live inside `.next`). So the three families the card design
   uses are fetched from Google's CSS API once per server process and cached in
   module scope.

   Two rules this file exists to keep:

   1. **It never throws.** An OG image that 500s because a font CDN was slow is
      worse than an OG image in the fallback face: link previews are the one
      surface where a broken response is visible to everyone who shares the
      page. Every failure path returns `[]`, and `renderOgImage` then omits the
      `fonts` option entirely, which makes `ImageResponse` use its own bundled
      default font. The layout is unchanged; only the typeface is.
   2. **It asks for TTF, not WOFF2.** Google serves WOFF2 to modern browsers and
      TTF to everything else, keyed off the `User-Agent`. Satori can only parse
      TTF/OTF/WOFF, so the request deliberately carries a UA Google does not
      recognise, and any `src` that still comes back as WOFF2 is skipped.

   A cached rejection would strand a whole server process in the fallback face
   after one bad minute, so a failed load clears the cache and the next request
   tries again. */

/** One entry of `ImageResponse`'s `fonts` option, typed locally so nothing here
    reaches into `next/dist` for a type. */
export type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600;
  style: "normal";
};

/* The three faces the Finch-era template (`lib/og/render.tsx`) uses, and
   nothing else:
   - STIX Two Text 500 — the editorial title (`--font-stix` on the site).
   - DM Sans 400/600 — the finding card's observation and impact (`--font-body`).
   - IBM Plex Mono 400 — agent label, evidence chip, meta and the footer. */
const FONT_CSS_URL =
  "https://fonts.googleapis.com/css2" +
  "?family=DM+Sans:wght@400;600" +
  "&family=IBM+Plex+Mono:wght@400" +
  "&family=STIX+Two+Text:wght@500";

/* The redesign's three faces (`.ai/plan_vyso_redesign_2026.md` §4), for
   `lib/og/vyso.tsx`:
   - Instrument Sans 500/600 — display and headings (`--vy-font-display`).
   - Inter 400 — body (`--vy-font-body`).
   - IBM Plex Mono 400 — eyebrows, timestamps, the footer (`--vy-font-mono`).
   A second URL rather than a longer first one: loading five families to draw
   two would make every existing OG image pay for the new template's faces. */
const VYSO_FONT_CSS_URL =
  "https://fonts.googleapis.com/css2" +
  "?family=IBM+Plex+Mono:wght@400" +
  "&family=Instrument+Sans:wght@500;600" +
  "&family=Inter:wght@400";

/* Chrome would be served WOFF2. This UA is deliberately one Google's font API
   has no modern-format rule for, so every `src` comes back `format('truetype')`. */
const LEGACY_UA = "Mozilla/5.0 (compatible; VysoOG/1.0)";

/** Nothing in an OG image is worth blocking a response for. */
const FETCH_TIMEOUT_MS = 5_000;

const FACE_BLOCK = /@font-face\s*\{([^}]*)\}/g;
const FACE_FAMILY = /font-family:\s*'([^']+)'/;
const FACE_WEIGHT = /font-weight:\s*(\d+)/;
const FACE_SRC = /src:\s*url\((https:\/\/[^)]+)\)/;

/* One entry per stylesheet URL, so the two templates cache independently and
   neither can strand the other in the fallback face. */
const cache = new Map<string, Promise<OgFont[]>>();

/**
 * The fonts for `ImageResponse`, or `[]` if they could not be loaded.
 * Resolved once per server process; a failure is not cached.
 */
export function loadOgFonts(): Promise<OgFont[]> {
  return loadFontsFrom(FONT_CSS_URL);
}

/** The same, for the `--vy-*` template (`lib/og/vyso.tsx`). */
export function loadVysoOgFonts(): Promise<OgFont[]> {
  return loadFontsFrom(VYSO_FONT_CSS_URL);
}

function loadFontsFrom(url: string): Promise<OgFont[]> {
  const hit = cache.get(url);
  if (hit) return hit;

  const pending = fetchOgFonts(url).catch((error: unknown) => {
    // Let a later request retry rather than pinning the process to the
    // fallback face for as long as it lives.
    cache.delete(url);
    console.warn("[og] font load failed, falling back to the default face:", error);
    return [];
  });
  cache.set(url, pending);
  return pending;
}

async function fetchOgFonts(cssUrl: string): Promise<OgFont[]> {
  const css = await fetchText(cssUrl);

  const faces: { name: string; weight: OgFont["weight"]; url: string }[] = [];
  for (const [, body] of css.matchAll(FACE_BLOCK)) {
    const name = FACE_FAMILY.exec(body)?.[1];
    const url = FACE_SRC.exec(body)?.[1];
    const weight = Number(FACE_WEIGHT.exec(body)?.[1] ?? "400");
    // Satori parses TTF/OTF/WOFF only, and only 400/500/600 are used below.
    if (!name || !url || !/\.(ttf|otf)$/.test(url)) continue;
    if (weight !== 400 && weight !== 500 && weight !== 600) continue;
    faces.push({ name, weight, url });
  }

  if (faces.length === 0) throw new Error("no usable @font-face rules in the Google CSS response");

  return Promise.all(
    faces.map(async (face) => ({
      name: face.name,
      data: await fetchBinary(face.url),
      weight: face.weight,
      style: "normal" as const,
    })),
  );
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": LEGACY_UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.text();
}

async function fetchBinary(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response.arrayBuffer();
}

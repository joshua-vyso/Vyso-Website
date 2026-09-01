/* Type support for the Vite-style `?raw` imports used by the registered
   ThreeUI sources (see `.ai/threeui_source_record.md`). The build-side
   counterpart lives in `next.config.ts` (turbopack `raw` rule + webpack
   `asset/source` fallback). */
declare module "*.html?raw" {
  const source: string;
  export default source;
}

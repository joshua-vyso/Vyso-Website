/* Build-time label adapter for the registered ThreeUI plasma source
   (`src/shaders/neuform-isolated/sources/aetheris-labs.html`, SHA-256
   verified on disk — see `.ai/threeui_source_record.md`).

   The registered component exposes no label API and its sandboxed document
   can't be reached at runtime, so the site's CTA label is applied here, in
   the module pipeline, at the user's direction — the file itself stays
   byte-exact. The transform is a no-op for every other source that flows
   through the `*.html` rule. Order-agnostic: it works on the raw HTML or on
   raw-loader's JS-wrapped output, whichever this bundler hands it. */
module.exports = function vysoPlasmaLabelLoader(source) {
  if (typeof source !== "string") return source;
  return source.replace(">AETHER DRIVE<", ">BOOK A FREE AUDIT<");
};

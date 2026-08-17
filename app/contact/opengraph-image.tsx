/* The site-wide image, re-exported so this segment has one of its own.

   Next merges metadata per segment and a page that declares `openGraph` at all
   REPLACES the parent's whole `openGraph` object — including the `images` the
   root `app/opengraph-image.tsx` contributes (see the "Inheriting fields" note
   in `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
   generate-metadata.md`). Every page here sets its own og:title and
   og:description, so without a file in its own segment it would ship no
   og:image at all. Two lines here beats an `images: [...]` URL hard-coded back
   into the metadata block, and the day this page earns its own design, this
   file is where it goes. */

export { default, alt, size, contentType } from "@/app/opengraph-image";

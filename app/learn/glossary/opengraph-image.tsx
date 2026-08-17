/* This segment's og:image. A page that declares `openGraph` replaces its
   parent's whole `openGraph` object, the file-convention `images` included, so
   a segment with its own metadata needs an image file of its own or it ships
   none — the full note is in `app/contact/opengraph-image.tsx`. Re-exports the
   site-wide image; replace this line the day the page earns its own design. */

export { default, alt, size, contentType } from "@/app/opengraph-image";

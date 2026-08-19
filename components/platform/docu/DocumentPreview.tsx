/**
 * The original document, on screen (`.ai/plan_review_v2.md` §1.3).
 *
 * FACTORED OUT OF `DocumentDetailPanel`, not rewritten. Review v2's pane has to
 * show the same file the Doc-U page shows, and the two rules that make that work
 * — an `<img>` for images, an `<iframe>` for everything else, and a signed URL
 * that expires — are the sort of thing that quietly diverges the moment there
 * are two copies. One of them would then be the one that renders a PDF as a
 * broken image.
 *
 * IT TAKES A SIGNED URL, IT DOES NOT MAKE ONE. Both callers already hold a
 * server-side Supabase client and both mint the URL there
 * (`storage.from('documents').createSignedUrl(path, 600)`); minting it here
 * would mean either a client-side service call or a component that cannot be
 * used from a server page. A null url is a real state — a document with no
 * `storage_path`, or a signing failure — and draws the dashed "Preview
 * unavailable" box rather than an empty frame.
 *
 * THE HEIGHT IS THE CALLER'S BUSINESS. The Doc-U page gives it most of the
 * viewport beside a two-column detail; the review pane gives it a shorter box
 * above the fields, and on mobile the pane is a bottom sheet. So the sizing
 * arrives as a class rather than being decided in here, and the iframe scrolls
 * its own content inside whatever it is given (plan §3, "very large preview").
 *
 * A server component — nothing here is interactive.
 */

/** Filename extensions the browser will render as an image. Everything else
 *  (PDFs, and anything unrecognised) goes to the iframe, which is the honest
 *  default: a PDF in an `<img>` is a broken icon, whereas an image in an iframe
 *  is an image. */
const IMAGE_EXTENSIONS: readonly string[] = ['jpg', 'jpeg', 'png', 'heic', 'webp', 'gif', 'bmp'];

/**
 * Is this file an image? Decided by filename extension because the `documents`
 * row carries no mime type — the same derivation `app/app/docu/[id]/page.tsx`
 * has always done, moved here so both callers share it.
 */
export function isImageDocument(filename: string | null | undefined, storagePath?: string | null): boolean {
  const ext = (filename || storagePath || '').toLowerCase().split('?')[0].split('.').pop();
  return IMAGE_EXTENSIONS.includes(ext ?? '');
}

export function DocumentPreview({
  url,
  isImage,
  filename,
  imageClassName = 'max-h-[calc(100vh-16rem)]',
  frameClassName = 'h-[calc(100vh-16rem)] min-h-[420px]',
  emptyClassName = 'min-h-[50vh]',
}: {
  /** A signed URL minted by the caller, or null when there is nothing to show. */
  url: string | null;
  isImage: boolean;
  filename: string | null;
  /** Sizing for an image, which sizes itself from its own pixels and so takes a
   *  MAX height — a receipt photographed portrait must not be stretched. */
  imageClassName?: string;
  /** Sizing for the iframe, which has no intrinsic height and so takes a real
   *  one, with a floor so a short viewport still shows a page of the PDF. */
  frameClassName?: string;
  /** Sizing for the "unavailable" box, which has no content to size itself by. */
  emptyClassName?: string;
}) {
  if (!url) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl border border-dashed border-[#EAEDF2] bg-[#F5F9FE] ${emptyClassName}`}
      >
        <span className="text-[13px] text-[#8A8E86]">Preview unavailable</span>
      </div>
    );
  }

  if (isImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={filename ? `Original document — ${filename}` : 'Original document'}
        className={`w-full rounded-xl border border-[#EAEDF2] object-contain ${imageClassName}`}
      />
    );
  }

  return (
    <iframe
      src={url}
      title={filename ? `Original document — ${filename}` : 'Original document'}
      className={`w-full rounded-xl border border-[#EAEDF2] ${frameClassName}`}
    />
  );
}

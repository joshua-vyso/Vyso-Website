import { REVIEWS, type Review } from "../content";
import { Marquee, Reveal, Words } from "../primitives";

/* ── Review cards ────────────────────────────────────────────────────────────
   Shared by the homepage rail and `/reviews`. Cards show the person's name
   and role only; the company field in the data is never rendered. */

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");

function CardBody({ review }: { review: Review }) {
  return (
    <>
      <span className="vx-chip vx-chip-muted vx-review-tag">{review.sector}</span>
      <blockquote className="vx-review-q">{review.quote}</blockquote>
      <figcaption className="vx-review-who">
        <span className="vx-avatar" aria-hidden="true">
          {initials(review.name)}
        </span>
        <span>
          <span className="n" style={{ display: "block" }}>
            {review.name}
          </span>
          <span className="r" style={{ display: "block" }}>
            {review.role}
          </span>
        </span>
      </figcaption>
    </>
  );
}

export function ReviewCard({ review, delay = 0, plain = false }: { review: Review; delay?: number; plain?: boolean }) {
  if (plain) {
    return (
      <figure className="vx-review">
        <CardBody review={review} />
      </figure>
    );
  }
  return (
    <Reveal as="figure" className="vx-review" delay={delay}>
      <CardBody review={review} />
    </Reveal>
  );
}

/* Homepage: every review on a perpetual rail drifting left (pauses on
   hover). The rail is decorative for assistive tech; the same reviews are
   read in full on /reviews, linked from the nav. */
export function ReviewsHome() {
  return (
    <section className="vx-section" aria-labelledby="reviews-h" style={{ paddingTop: 0 }}>
      <div className="vx-wrap">
        <div className="vx-section-head">
          <div>
            <Reveal>
              <p className="vx-eyebrow">Reviews</p>
            </Reveal>
            <Words as="h2" className="vx-display vx-h2" text="What it feels like" em="on the inside." />
            <span id="reviews-h" className="sr-only">
              Reviews
            </span>
          </div>
        </div>
      </div>
      <div className="vx-wrap vx-review-rail-wrap">
        <Marquee speed={110}>
          <div className="vx-review-rail">
            {REVIEWS.map((r) => (
              <ReviewCard key={r.name} review={r} plain />
            ))}
          </div>
        </Marquee>
      </div>
    </section>
  );
}

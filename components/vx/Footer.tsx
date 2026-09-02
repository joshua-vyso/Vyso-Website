"use client";

/* ── Closing plate + footer ──────────────────────────────────────────────────
   Every page ends the way the homepage begins: an ink plate. The giant line
   is the last argument; the footer beneath it carries the key facts as a
   definition list (machine-readable, human-quiet) and the wordmark rising
   out of the bottom edge. */

import Link from "next/link";
import { track } from "@/lib/analytics";
import { BRAND, NAV } from "./content";
import { Btn, Reveal, Words } from "./primitives";

export function Closing({
  line = "Let's build",
  em = "yours.",
  hideCta = false,
}: {
  line?: string;
  em?: string;
  hideCta?: boolean;
}) {
  return (
    <div className="vx-closing">
      <div className="vx-plate vx-grain vx-closing-plate">
        <div>
          <Reveal>
            <p className="vx-eyebrow">Next step</p>
          </Reveal>
          <Words as="h2" className="vx-display vx-h1" text={line} em={em} delay={80} />
          {!hideCta ? (
            <Reveal className="vx-closing-cta" delay={160}>
              <p className="vx-lead">
                A free audit. One operation mapped, the biggest leak found, and an honest answer on whether a
                system would pay for itself.
              </p>
              <Btn href="/join" variant="vx-btn-signal" onClick={() => track("join_waitlist_click", { source: "section_cta" })}>
                Book a free audit
              </Btn>
            </Reveal>
          ) : null}
        </div>

        <footer className="vx-footer" aria-label="Footer">
          <div>
            <h2>Vyso</h2>
            <dl className="vx-footer-facts">
              <div>
                <dt>What</dt>
                <dd>AI automation agency</dd>
              </div>
              <div>
                <dt>Where</dt>
                <dd>
                  {BRAND.city}, {BRAND.country}
                </dd>
              </div>
              <div>
                <dt>Serving</dt>
                <dd>Operations-heavy businesses, SA first</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>
                  <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
                </dd>
              </div>
            </dl>
          </div>
          <div>
            <h2>Site</h2>
            <ul>
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Industries</h2>
            <ul>
              <li>
                <Link href="/industries/food-hospitality">Food &amp; hospitality</Link>
              </li>
              <li>
                <Link href="/industries/construction">Construction</Link>
              </li>
              <li>
                <Link href="/industries/insurance">Insurance</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>Company</h2>
            <ul>
              <li>
                <Link href="/join" onClick={() => track("join_waitlist_click", { source: "footer" })}>
                  Book a free audit
                </Link>
              </li>
              <li>
                <Link href="/construction">Vyso Construction · waitlist</Link>
              </li>
              <li>
                <Link href="/login">Client login</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy</Link>
              </li>
              <li>
                <Link href="/terms">Terms</Link>
              </li>
              <li>
                <Link href="/popia">POPIA</Link>
              </li>
            </ul>
          </div>
        </footer>

        <div>
          <div className="vx-footer-bottom">
            <span>© {new Date().getFullYear()} Vyso (Pty) Ltd</span>
            <span>Software proposes. People decide.</span>
            <span>Built and run from Johannesburg</span>
          </div>
          <Reveal className="vx-footer-mark" margin="0px">
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative giant wordmark */}
            <img src="/site/vyso-wordmark-paper.svg" alt="" aria-hidden="true" width={825} height={210} />
          </Reveal>
        </div>
      </div>
    </div>
  );
}

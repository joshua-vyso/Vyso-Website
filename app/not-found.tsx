import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteNav } from "@/components/site/SiteChrome";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

/* Useful 404: says what happened, offers the four places people actually
   want, and keeps the one conversion path in reach. */
export default function NotFound() {
  return (
    <div className="vy-site">
      <SiteNav />
      <main id="main" className="mx-auto flex min-h-[70svh] max-w-[1200px] flex-col justify-center px-6 pt-28">
        <p className="vy-eyebrow text-ink-3">404 · Page not found</p>
        <h1 className="mt-5 max-w-[700px] text-balance text-[clamp(2rem,4.6vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
          This page has been{" "}
          <em className="vy-serif font-normal italic text-signal-deep">automated away.</em>
        </h1>
        <p className="mt-5 max-w-[520px] leading-relaxed text-ink-2">
          The address doesn&rsquo;t exist any more — the site was recently restructured. These are
          probably what you were after:
        </p>
        <ul className="mt-8 flex flex-wrap gap-3">
          {(
            [
              ["Home", "/"],
              ["What we automate", "/automations"],
              ["Industries", "/industries"],
              ["Join the waitlist", "/join"],
            ] as const
          ).map(([label, href]) => (
            <li key={href}>
              <Link href={href} className="vy-btn vy-btn-quiet">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}

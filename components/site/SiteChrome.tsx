import Link from "next/link";
import { DockNav } from "@/components/site/nav/DockNav";
import { MobileNav } from "@/components/site/nav/MobileNav";

/* ── Site chrome: nav + footer for every agency page ───────────────────────── */

export function SiteNav() {
  /* The root layout already renders the site-wide SkipLink — no second one. */
  return (
    <>
      <DockNav />
      <MobileNav />
    </>
  );
}

const FOOTER_COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: "Vyso",
    links: [
      ["Home", "/"],
      ["What we automate", "/automations"],
      ["Industries", "/industries"],
      ["Integrations", "/integrations"],
      ["About", "/about"],
    ],
  },
  {
    title: "Industries",
    links: [
      ["Food & hospitality", "/industries/food-hospitality"],
      ["Construction", "/industries/construction"],
      ["Insurance", "/industries/insurance"],
    ],
  },
  {
    title: "Company",
    links: [
      ["Join the waitlist", "/join"],
      ["Log in", "/login"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["POPIA", "/popia"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-inkline bg-ink text-ondark-2">
      <div className="mx-auto max-w-[1200px] px-6 py-16">
        <div className="flex flex-col gap-12 md:flex-row md:justify-between">
          <div className="max-w-xs">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size inline wordmark */}
            <img src="/site/vyso-wordmark-paper.svg" alt="Vyso" width={64} height={16} />
            <p className="mt-4 text-sm leading-relaxed">
              AI automation for the work that slows your business down. Built and run from
              Johannesburg.
            </p>
            <a
              href="mailto:joshua@vyso.co.za"
              className="mt-4 inline-block text-sm text-ondark underline decoration-ondark-3 underline-offset-4 hover:decoration-ondark"
            >
              joshua@vyso.co.za
            </a>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <h2 className="vy-eyebrow text-ondark-3">{column.title}</h2>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href} className="text-sm text-ondark-2 hover:text-ondark">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <p className="mt-14 border-t border-inkline pt-6 text-xs text-ondark-3">
          © {new Date().getFullYear()} Vyso (Pty) Ltd · Johannesburg, South Africa
        </p>
      </div>
    </footer>
  );
}

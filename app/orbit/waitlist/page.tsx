import type { Metadata } from "next";
import Link from "next/link";

import { Band } from "@/components/finch/ground/Band";
import { Glow } from "@/components/finch/ground/Glow";
import { Breadcrumb, Eyebrow, StatusNote } from "@/components/orbit/OrbitBits";
import { OrbitShell } from "@/components/orbit/OrbitShell";
import { WaitlistForm } from "@/components/orbit/WaitlistForm";
import { WhatsAppPhone } from "@/components/orbit/WhatsAppPhone";
import { breadcrumbNode, jsonLd, orbitGraph, webPageNode } from "@/components/orbit/orbit-jsonld";
import { SITE } from "@/lib/marketing/site";
import { JOB_TO_INVOICE } from "@/lib/orbit/sequences";
import { ORBIT } from "@/lib/orbit/site";

/* ── `/orbit/waitlist` ───────────────────────────────────────────────────────
   The one page on the subsite that asks for something. It therefore says, above
   the form and before the fields, exactly what the list is and what it is not:
   free, no commitment, one WhatsApp message when Orbit opens, founding pricing
   locked.

   No `WaitlistBand` at the bottom. Every other Orbit page closes on a CTA
   pointing here; a page that *is* the CTA closing on a link to itself is the
   kind of loop that reads as a template rather than as a document.             */

const TITLE = "Join the Orbit waitlist";
const DESCRIPTION =
  "Join the Orbit waitlist: free, no commitment, and founding pricing locked. We WhatsApp you when Orbit opens for South African tradespeople.";
const URL = `${ORBIT.url}/waitlist`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/orbit/waitlist" },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: SITE.name,
    locale: "en_ZA",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const PROMISES: [string, string][] = [
  ["One message, when it opens", "On WhatsApp, from us, once. No newsletter and no sales sequence."],
  ["Founding pricing, locked", `${ORBIT.price.display} ${ORBIT.price.unit}, held for the people on the list.`],
  ["Nothing to pay, nothing to sign", "The list is free and commits you to nothing at all."],
  ["Your answers shape the first release", "What you do and how you work is what the first version is built around."],
];

function buildSchema() {
  return orbitGraph([
    webPageNode(URL, TITLE, DESCRIPTION),
    breadcrumbNode(URL, [
      ["Vyso", "/"],
      ["Orbit", "/orbit"],
      ["Join Waitlist", "/orbit/waitlist"],
    ]),
  ]);
}

export default function OrbitWaitlistPage() {
  return (
    <OrbitShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(buildSchema()) }} />

      <Band
        ground="ink"
        className="bg-ob-bg"
        paddingClassName="pt-[24px] pb-[64px] lg:pt-[36px] lg:pb-[104px]"
        device={<Glow tone="blue" size={420} className="left-[22%] top-[40%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2" />}
      >
        <Breadcrumb trail={[["Vyso", "/"], ["Orbit", "/orbit"], ["Join Waitlist", "/orbit/waitlist"]]} />

        <div className="grid grid-cols-1 gap-[44px] lg:grid-cols-[1fr_0.95fr] lg:gap-[72px]">
          <div>
            <h1 className="m-0 mb-[18px] font-fn-serif text-[38px] font-medium leading-[1.08] tracking-[-0.025em] text-balance text-ob-text lg:text-[56px]">
              Join the Orbit waitlist.
            </h1>
            <p className="m-0 mb-[24px] max-w-[520px] text-[16px] leading-[1.68] text-ob-text-2 lg:text-[18px]">
              Orbit is being built now. Tell us your trade and your WhatsApp number, and
              you&rsquo;ll be one of the first to hear when it opens.
            </p>
            <StatusNote className="mb-[32px]" />

            <ul className="m-0 flex list-none flex-col gap-[16px] p-0">
              {PROMISES.map(([title, body]) => (
                <li key={title} className="border-t border-ob-line pt-[13px]">
                  <h2 className="m-0 mb-[5px] text-[15px] font-semibold text-ob-text">{title}</h2>
                  <p className="m-0 text-[14px] leading-[1.6] text-ob-text-2">{body}</p>
                </li>
              ))}
            </ul>

            <p className="m-0 mt-[28px] text-[13.5px] leading-[1.65] text-ob-mono">
              Not sure yet?{" "}
              <Link href="/orbit/how-it-works" className="underline decoration-ob-line underline-offset-[4px] hover:text-fn-orange-on-ink hover:decoration-fn-orange-on-ink">
                See how it works
              </Link>
              ,{" "}
              <Link href="/orbit/pricing" className="underline decoration-ob-line underline-offset-[4px] hover:text-fn-orange-on-ink hover:decoration-fn-orange-on-ink">
                read the pricing
              </Link>{" "}
              or{" "}
              <Link href="/orbit/faq" className="underline decoration-ob-line underline-offset-[4px] hover:text-fn-orange-on-ink hover:decoration-fn-orange-on-ink">
                check the FAQ
              </Link>
              .
            </p>
          </div>

          <div className="rounded-[14px] border border-ob-line bg-ob-surface p-[22px] lg:p-[28px]">
            <Eyebrow>Three required fields</Eyebrow>
            <WaitlistForm />
          </div>
        </div>
      </Band>

      <Band ground="ink" className="bg-ob-bg-2">
        <div className="grid grid-cols-1 items-center gap-[36px] lg:grid-cols-[0.9fr_1.1fr] lg:gap-[64px]">
          <div className="flex justify-center lg:justify-start">
            <WhatsAppPhone script={JOB_TO_INVOICE} />
          </div>
          <div>
            <Eyebrow>What you&rsquo;re joining</Eyebrow>
            <h2 className="m-0 mb-[16px] font-fn-serif text-[26px] font-medium leading-[1.2] tracking-[-0.02em] text-ob-text lg:text-[34px]">
              This, at the end of every job.
            </h2>
            <p className="m-0 max-w-[520px] text-[15.5px] leading-[1.7] text-ob-text-2 lg:text-[17px]">
              One message when the work is done, a record made while the detail is still in your
              head, and an invoice drafted before you have washed the tools. {ORBIT.draftsOnly}
            </p>
          </div>
        </div>
      </Band>
    </OrbitShell>
  );
}

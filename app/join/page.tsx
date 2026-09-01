import type { Metadata } from "next";
import { PageShell, JsonLd, breadcrumbs } from "@/components/site/PageShell";
import { WaitlistForm } from "@/components/site/WaitlistForm";

export const metadata: Metadata = {
  title: "Join the waitlist",
  description:
    "Join the Vyso waitlist. We onboard a small number of businesses at a time so every automation build gets senior attention — tell us what repetitive work you want off your team's plate.",
  alternates: { canonical: "/join" },
};

const STEPS = [
  {
    title: "You join",
    body: "A minute of detail about your business and the work that eats its hours. No payment, no commitment.",
  },
  {
    title: "We read it",
    body: "Every submission is read by a person. When a build slot opens, we reach out — usually with a couple of sharp questions first.",
  },
  {
    title: "We talk it through",
    body: "A short conversation about your operation and whether an automation would genuinely pay for itself. If it wouldn't, we say so.",
  },
];

export default function JoinPage() {
  return (
    <PageShell>
      <JsonLd data={breadcrumbs([["Home", "/"], ["Join the waitlist", "/join"]])} />
      <div className="mx-auto max-w-[1200px] px-6 pb-24">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <header>
            <p className="vy-eyebrow text-ink-3">Join the waitlist</p>
            <h1 className="mt-5 text-balance text-[clamp(2.2rem,4.6vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.02em]">
              Tell us what{" "}
              <em className="vy-serif font-normal italic text-signal-deep">slows you down.</em>
            </h1>
            <p className="mt-6 max-w-[460px] text-pretty leading-relaxed text-ink-2">
              We onboard a small number of businesses at a time, so every build gets senior
              attention through mapping, build and run-in. The waitlist keeps that honest —
              there&rsquo;s no queue number theatre, just an ordered list we work through
              properly.
            </p>
            <ol className="mt-10 space-y-6 border-t border-line pt-8">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="vy-mono flex-none text-sm text-signal-deep">0{index + 1}</span>
                  <div>
                    <h2 className="font-semibold">{step.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-ink-2">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </header>
          <div className="vy-card h-fit p-6 md:p-9">
            <WaitlistForm />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

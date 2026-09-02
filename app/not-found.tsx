import type { Metadata } from "next";
import { VxShell } from "@/components/vx/VxShell";
import { Btn, Words } from "@/components/vx/primitives";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <VxShell closing={{ line: "Back to", em: "the start.", hideCta: true }}>
      <div className="vx-wrap vx-page-head" style={{ minHeight: "70svh", display: "grid", alignContent: "center" }}>
        <p className="vx-eyebrow">404</p>
        <Words as="h1" className="vx-display vx-h1" text="This page was" em="automated away." immediate delay={100} />
        <p className="vx-lead" style={{ marginTop: 28 }}>
          The address doesn&rsquo;t exist any more. The site was recently restructured.
        </p>
        <div style={{ marginTop: 32, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Btn href="/">Home</Btn>
          <Btn href="/automations" variant="vx-btn-ghost">
            The systems
          </Btn>
        </div>
      </div>
    </VxShell>
  );
}

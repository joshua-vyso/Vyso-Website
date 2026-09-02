import type { Metadata } from "next";
import { IndustryPage } from "@/components/vx/IndustryPage";
import { INDUSTRY_PAGES } from "@/components/site/industries-content";

const industry = INDUSTRY_PAGES.find((entry) => entry.slug === "insurance")!;

export const metadata: Metadata = {
  title: industry.metaTitle,
  description: industry.metaDescription,
  alternates: { canonical: "/industries/insurance" },
};

export default function Page() {
  return <IndustryPage industry={industry} />;
}

import type { Metadata } from "next";
import { IndustryPage } from "@/components/site/IndustryPage";
import { INDUSTRY_PAGES } from "@/components/site/industries-content";

const industry = INDUSTRY_PAGES.find((entry) => entry.slug === "construction")!;

export const metadata: Metadata = {
  title: industry.metaTitle,
  description: industry.metaDescription,
  alternates: { canonical: "/industries/construction" },
};

export default function Page() {
  return <IndustryPage industry={industry} />;
}

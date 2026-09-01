# plan_home_dark_2026.md — homepage dark redesign (Josh, 2026-09-01)

**Branch:** `redesign/agency-2026` (continues). **Scope:** homepage only + global CTA relabel.

## Goal
Near-black premium homepage telling: hero → problem → capabilities → automation scale → integrations climax → reviews → conversion. Hero and reviews sections LOCKED (layout/motion/styling unchanged; text edits only). Old five-card "How we work" removed, not replaced. Global CTA becomes **"Book a free audit"** everywhere (Josh's explicit instruction; overrides the pasted spec's "Join waitlist" label). Destination stays `/join`.

## Acceptance
- Hero: headline exactly "Automate the work that keeps you losing time and money."; plasma module replaced by a real primary CTA button "Book a free audit"; everything else untouched.
- Reviews (TestimonialsSection + FlowFieldLayer): untouched.
- New sections per spec: ProblemTable (one rounded table, stagger/divider-draw/indicator), OperationsSection (sticky heading + five rows, progressive schematics), AutomationScale (~300vh pinned 3-stage with schematics; vertical on mobile), IntegrationExperience (~420vh sticky: wheel WhatsApp→Outlook→Xero→"30+" using real brand SVGs from `public/finch/integrations/`, then Canvas-2D particle convergence with environmental "ONE / BRAIN." type and orange centre node), ClosingCta ("Ready to get your time back?").
- Removed from home: ProblemSection, CapabilitiesSection, BriefDemo section, ProcessSection, IntegrationsSection (cards), IndustriesSection, FaqSection (+ its FAQPage JSON-LD), FinalCtaSection.
- Reduced motion: all sections static and legible; sticky/pins released; canvas renders final state once.
- No scroll hijack; transforms/opacity/SVG/canvas only; particles on one canvas (DPR≤2, mobile density cut, no rAF once resolved).
- Works at 320/768/1024/1440; no horizontal overflow; tsc/lint/tests/build green.

## Files
- Edit: `components/site/home/Hero.tsx` (headline + CTA), `Sections.tsx` (trim to SectionHead + TestimonialsSection), `app/page.tsx` (new composition, dark sheet), `nav/DockNav.tsx` + `nav/MobileNav.tsx` + `SiteChrome.tsx` footer + `PageShell`-adjacent CTAs + `/join` submit label (CTA relabel), `app/globals.css` (dark-home layer).
- New: `components/site/home/ProblemTable.tsx`, `OperationsSection.tsx`, `AutomationScale.tsx`, `IntegrationExperience.tsx`, `ClosingCta.tsx`, `scroll.ts` (shared sticky-progress hook).
- Keep unused-but-intact: `BriefDemo.tsx`, `three/PlasmaCta.tsx` (plasma no longer mounted; ThreeUI record unchanged).

## Verification
tsc · eslint (site scope) · node --test · next build · QA shots at 320/768/1024/1440 + reduced-motion + sticky-release checks · keyboard pass · console clean.

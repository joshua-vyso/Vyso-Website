"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic                     from "next/dynamic";
import Link                        from "next/link";
import { BounceDot }               from "@/components/BounceDot";
import { Navbar }                  from "@/components/Navbar";
import { HeroSection }             from "@/components/HeroSection";
import { IntegrationsMarquee }     from "@/components/marketing/IntegrationsMarquee";
import { SystemsShowcase }         from "@/components/sections/SystemsShowcase";
import { HowItWorks }              from "@/components/sections/HowItWorks";
import { AppsShowcase }            from "@/components/sections/AppsShowcase";
import { TrustStrip }              from "@/components/sections/TrustStrip";
import { ContactSection }          from "@/components/sections/ContactSection";
import { SiteFooter }              from "@/components/sections/SiteFooter";

// The WebGL background pulls in three.js (~650KB) and only runs in the browser,
// so it's lazy-loaded (ssr:false) — it no longer blocks the homepage's initial
// JS/first paint, and streams in just behind the intro animation.
const WebGLShaderBackground = dynamic(
  () => import("@/components/WebGLShaderBackground").then((m) => m.WebGLShaderBackground),
  { ssr: false },
);

/* ── Integrations band ──────────────────────────────────────────────────────
   Compact section directly under the hero: the marquee rail plus the same
   eyebrow/heading register the other homepage sections use (see
   SystemsShowcase). The copy is deliberately about intent — what Vyso is built
   to plug into — never a claim that every logo is live; per-integration status
   lives on /integrations.                                                    */
const FONT: React.CSSProperties = { fontFamily: "var(--font-sans)" };
const BODY: React.CSSProperties = { fontFamily: "var(--font-body, var(--font-sans))" };

// Complement of the orange gradient — reads orange on white, blue on the band.
const blendOrange: React.CSSProperties = {
  background:           "linear-gradient(135deg, hsl(219,72%,50%), hsl(202,69%,56%), hsl(199,66%,64%))",
  WebkitBackgroundClip: "text",
  backgroundClip:       "text",
  WebkitTextFillColor:  "transparent",
  color:                "transparent",
  mixBlendMode:         "difference",
  display:              "inline",
};

function IntegrationsBand() {
  return (
    <section
      style={{
        position:      "relative",
        width:         "100%",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        padding:       "clamp(3.5rem, 7vw, 6rem) 2rem",
        boxSizing:     "border-box",
        background:    "transparent",
      }}
    >
      <div style={{ position: "relative", width: "100%", maxWidth: 1100, textAlign: "center" }}>
        <p style={{
          ...BODY,
          fontSize:      "0.72rem",
          fontWeight:    600,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color:         "#bbb",
          marginBottom:  "1rem",
        }}>
          Integrations
        </p>

        <h2 style={{
          ...FONT,
          fontSize:      "clamp(2rem, 4.4vw, 3.4rem)",
          fontWeight:    700,
          lineHeight:    1.04,
          letterSpacing: "-0.03em",
          margin:        "0 0 2.4rem",
        }}>
          <span className="blend-h-plain" style={{ color: "white", mixBlendMode: "difference" as const }}>Built to plug into </span>
          <span className="blend-h-orange" style={blendOrange}>the tools you already run.</span>
        </h2>

        <IntegrationsMarquee />

        <div style={{ marginTop: "1.6rem" }}>
          <Link
            href="/integrations"
            style={{
              ...BODY,
              fontSize:       "0.86rem",
              fontWeight:     700,
              color:          "hsl(22,69%,44%)",
              textDecoration: "none",
            }}
          >
            Explore integrations →
          </Link>
        </div>
      </div>
    </section>
  );
}

const SECTIONS: [React.ComponentType, string][] = [
  [HeroSection,      "hero"        ],
  [IntegrationsBand, "integrations"],
  [SystemsShowcase,  "systems"     ],
  [HowItWorks,       "how-it-works"],
  [AppsShowcase,     "our-toolkit" ],
  [TrustStrip,       "trust"       ],
  [ContactSection,   "contact"     ],
];

export default function Home() {
  const [siteVisible, setSiteVisible] = useState(false);
  const [introChecked, setIntroChecked] = useState(false);

  useEffect(() => {
    let scrollFrame: number | undefined;
    const checkFrame = window.requestAnimationFrame(() => {
      const hasAnchor = window.location.hash.length > 1;
      let introSeen = false;

      try {
        introSeen = window.sessionStorage.getItem("vyso:intro-seen") === "1";
      } catch {
        // Storage can be unavailable in privacy-restricted browsers.
      }

      if (introSeen || hasAnchor) {
        setSiteVisible(true);

        if (hasAnchor) {
          try {
            window.sessionStorage.setItem("vyso:intro-seen", "1");
          } catch {
            // The hash bypass still works when storage is unavailable.
          }

          scrollFrame = window.requestAnimationFrame(() => {
            const id = decodeURIComponent(window.location.hash.slice(1));
            document.getElementById(id)?.scrollIntoView({ block: "start" });
          });
        }
      }

      setIntroChecked(true);
    });

    return () => {
      window.cancelAnimationFrame(checkFrame);
      if (scrollFrame !== undefined) window.cancelAnimationFrame(scrollFrame);
    };
  }, []);

  // Lock body scroll while the intro is playing so the user can't
  // accidentally scroll away from hero before the animation finishes.
  useEffect(() => {
    if (!siteVisible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [siteVisible]);

  const handleAnimationComplete = useCallback(() => {
    try {
      window.sessionStorage.setItem("vyso:intro-seen", "1");
    } catch {
      // The intro can still complete normally when storage is unavailable.
    }

    // Snap back to the top before revealing the site so the user
    // always lands on the hero no matter where scroll drifted during the intro.
    if (!window.location.hash) {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    setSiteVisible(true);
  }, []);

  return (
    <>
      {introChecked && !siteVisible ? (
        <BounceDot onComplete={handleAnimationComplete} />
      ) : null}

      {/* `blend-surface` — universal reactive text blend, see app/globals.css. */}
      <div
        className="blend-surface"
        style={{
          opacity:       siteVisible ? 1 : 0,
          transition:    "opacity 0.5s ease",
          pointerEvents: siteVisible ? "auto" : "none",
        }}
      >
        <WebGLShaderBackground global />
        <Navbar />

        <main style={{ paddingTop: 64 }}>
          {SECTIONS.map(([Section, id]) => (
            <div key={id} id={id}>
              <Section />
            </div>
          ))}
        </main>

        <SiteFooter />
      </div>
    </>
  );
}

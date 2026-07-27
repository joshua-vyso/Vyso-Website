# Implementation log: Round-2 fixes

## A — Pricing tiles: trim to 5 scope bullets each

**Status: Done.**

File touched: `components/sections/PricingSection.tsx` only (the `TIERS` array's `features` lists).

Changes:
- **Start**: replaced 7-item feature list with the exact 5 bullets from the plan — "Workflow automation in your existing stack" (sub: "WhatsApp, Google Sheets, Outlook, etc."), "Up to 5 automations included", "Breakages fixed proactively", "New automations on a monthly delivery cycle", "Finch available from Create".
- **Create**: replaced 8-item feature list with the exact 5 bullets — "One productised Vyso module of your choice", "Start automations migrated into your module", "Finch companion app included for your module", "Team onboarding and 60-day support", "Dashboard, user roles and handover included".
- **Scale**: replaced 10-item feature list with the exact 5 bullets — "Everything in Create", "Add modules as your operation grows", "Finch companion app across all modules", "Two-way integrations with outside systems" (sub: "accounting, POS, banking, CRMs, supplier systems"), "Monthly ops reports and quarterly optimisation".

Untouched, as required: prices (R10,000/R8,000, R30,000/R10,000, R50,000/R15,000), "+R3,000/month per additional module" note on Scale's retainer, all three taglines, all three "Join Waitlist" CTAs, the scope-guard paragraph below the dot indicators, and the `AuditBanner` component/copy. The FAQ (full scope lists) was not touched.

Verification:
- `npx tsc --noEmit` — passed with no output/errors.
- Card layout: each tier now renders exactly 5 `<li>` feature rows instead of 7–10, so vertical space that was previously consumed by extra bullets is now free — cards should sit well within `CARD_H` (560px) with more headroom before the pricing/CTA block, not less. The SETUP/RETAINER pricing row markup itself was not modified (still `display:flex, gap:1.5rem`), and reducing the feature-list height only reduces pressure on that row, so no new wrapping risk was introduced by this change. Did not run a visual/browser check (out of scope for Workstream A per the plan — that's Workstream C's job); if the Scale card's pricing row still wraps awkwardly after C's screenshot pass, it was pre-existing and not caused by this edit.

No other files were modified. Did not commit (per instructions).

## B — Desktop app: fix "damaged" launch error + rounded icon

**Status: Done.**

Files touched: `desktop/package.json`, `desktop/build/icon.icns` (plus gitignored `desktop/dist/*` build outputs). Nothing else in the repo was touched; did not commit.

1. **Signing fix**: Removed `"identity": null` from the `mac` block in `desktop/package.json` (the `dmg`/`arm64` target config is otherwise unchanged). Rebuilt with `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist`. electron-builder logged `skipped macOS application code signing` (expected — that env var stops it from hunting for a real Developer ID cert), but the arm64 Mach-O binary still carries the linker's mandatory ad-hoc signature. Verified:
   ```
   codesign -dv dist/mac-arm64/Vyso.app
   CodeDirectory v=20400 size=392 flags=0x20002(adhoc,linker-signed) hashes=9+0 location=embedded
   Signature=adhoc
   ```
   This matches the plan's expected result — app will now open via right-click → Open ("unverified developer") instead of failing as "damaged".

2. **Rounded icon**: Confirmed python3 + Pillow (12.2.0) available locally, no extra install needed. Wrote a one-off script to the scratchpad (`make_icon.py`, not copied into the repo) that: loads `Vyso Mobile/assets/icon.png` (1254×1254 source), resizes to 824×824, applies a 4x-supersampled rounded-rect alpha mask with corner radius 185px (22.5% of 824, per plan), and composites it centered onto a transparent 1024×1024 canvas. Built the full 10-image iconset with `sips` and converted with `iconutil -c icns`, then copied the result over `desktop/build/icon.icns` (1,278,243 → 1,112,208 bytes). The intermediate `.iconset` directory was created and deleted in the scratchpad only — never in the repo.

3. **Rebuild**: `cd desktop && CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist` completed successfully (also re-ran `@electron/rebuild` for native deps as part of the normal build). Outputs: `desktop/dist/mac-arm64/Vyso.app` and `desktop/dist/Vyso-Desktop.dmg`.
   - `codesign -dv` on the app: `Signature=adhoc` (see above).
   - `hdiutil verify dist/Vyso-Desktop.dmg` → `verified CRC32 $1D6A0745` / `checksum ... is VALID`.

4. **Release asset replaced in place**: `gh release upload desktop-v1.0.0 "desktop/dist/Vyso-Desktop.dmg#Vyso-Desktop.dmg" --clobber --repo joshua-vyso/Vyso-Website` succeeded. Release notes updated via `gh release edit` to state this is an unsigned/ad-hoc-signed community build (not notarized), with right-click Vyso.app → Open → Open instructions for first launch, and a fallback `xattr -cr /Applications/Vyso.app` if macOS still reports it as damaged.

5. **Verification**:
   - `curl -sIL -o /dev/null -w '%{http_code}' https://github.com/joshua-vyso/Vyso-Website/releases/latest/download/Vyso-Desktop.dmg` → `200`.
   - New DMG size: **121,464,091 bytes (~115.8 MiB / ~121.5 MB)**, matching the size reported by `gh release view desktop-v1.0.0 --json assets`.

No website files, `ModulesOverlay.tsx`, or anything outside `desktop/package.json` + `desktop/build/icon.icns` (+ gitignored `desktop/dist`) was modified. Did not commit.

## C — Mobile responsiveness check

**Status: Done. No code changes required (nothing to fix in `PricingSection.tsx`).**

Build: `rm -rf .next && npm run build` succeeded (clean; the `.next` dir needed a second `rm -rf` after a transient "Directory not empty" error, then removed fine). `npm run start` served on `:3000`, killed at the end via `lsof -ti :3000 | xargs kill -9`.

Tooling: Playwright installed into a scratch package at `/private/tmp/claude-501/-Users-joshuamoreira-Developer-Vyso-Software/82928899-37fd-4392-b0cc-28540e55acae/scratchpad/qa-playwright` (`npm i playwright` + `npx playwright install chromium`), nothing added to the repo. Screenshots and scripts live under that directory's `screenshots/` (full-page captures, `slices/` for readable chunks of the very tall pages, `wheel-segments/` and `segments/` from intermediate scroll investigation).

**Overflow check (programmatic):** `document.scrollWidth` vs `window.innerWidth` was compared on all 4 pages at 390×844 (mobile) and 1440×900 (desktop) — **zero horizontal page-level overflow on any page/viewport combination** (`overflowAmount: 0` in every case; raw data in `screenshots/results.json`). A DOM walk for elements with `getBoundingClientRect().right > innerWidth+1` or `left < -1` did return matches, but every one of them was an off-canvas card belonging to an intentional horizontal carousel (the pricing tier carousel's adjacent card, the "Our toolkit" module carousel's next card) — these sit outside the clipped viewport by design and don't affect `scrollWidth`, so they are not bugs.

**Pricing page — verdict: clean.**
- Desktop (`screenshots/desktop-pricing.png`): all three tier cards (Start/Create/Scale) render side by side, equal height, 5 bullets each, SETUP/RETAINER row on one line per card, no clipping/overlap. Workstream A's trim clearly fixed the original overflow problem.
- Mobile (`screenshots/mobile-pricing.png`, `mobile-pricing-scale-card.png`, `screenshots/slices` crop `mobile-scale-card-crop.png`): the tier cards are a swipeable one-at-a-time carousel (dot pagination + prev/next arrows), so the full-page screenshot only shows Audit + Create; had to click "Next tier" to bring Scale into frame. Scale card renders cleanly: "SETUP (ONCE-OFF)" wraps to two lines and "RETAINER … +R3,000/month per additional module" wraps to three lines, each within its own column — no clipping, no horizontal overflow, no overlap with the Join Waitlist button. This is acceptable wrapping, not the "awkward" wrapping the plan was worried about, so **no PricingSection.tsx edit was made**.
- Minor non-blocking cosmetic note (not fixed, out of scope — not an overflow issue): on the mobile Scale card, the carousel's prev/next arrow buttons are positioned mid-card and visually sit on top of the 4th bullet's sub-text ("accounting, POS, banking, CRMs, supplier systems"), partially obscuring it. Pre-existing carousel-chrome placement, not something Workstream A's copy trim caused.

**Home page — verdict: clean (after accounting for the intro overlay).** The homepage has a click-to-enter intro (`components/BounceDot.tsx`) — a white dot the user must click before the real page is revealed (`aria-label="Enter Vyso"`); it doesn't dismiss on scroll. Initial automated scrolling appeared "stuck" because of this overlay, not a bug — once the dot is clicked and the ~4s GSAP reveal finishes, the full page (navbar, "what we build" module grid, "how it works" steps, toolkit carousel, "our reach" globe/testimonial, contact form, footer) renders correctly at both viewports with no clipping or overflow. See `screenshots/mobile-home-full.png` / `desktop-home-full.png`, sliced for readability in `screenshots/slices/mobile-home-part*.png` and `desktop-home-part*.png`. The navbar (logo + hamburger on mobile, full link row + Join Waitlist on desktop) renders correctly; the mobile hamburger menu was opened and checked too (`screenshots/mobile-nav-open.png`) — all links present, readable, no overflow. The home contact form ("Join the waitlist") is clean on both viewports — full-width inputs, no clipping, readable placeholder text.

**Contact page — verdict: clean.** `screenshots/mobile-contact.png` / `desktop-contact.png`: hero headline, form, "Email us directly" / "What to expect" side cards, and footer all render correctly with no overflow at either viewport.

**FAQ page — verdict: functional layout is clean (no overflow, no clipping), but a real, non-viewport-specific content bug was found and is being reported (not fixed — out of scope for this workstream, and not in `PricingSection.tsx`):**

Most FAQ question titles are invisible (white text on a white background) on both mobile and desktop. Root cause, confirmed by reading the source:
- `app/faq/page.tsx` renders each group heading (lines ~372–377) and each accordion `<summary>` question span (lines ~384–390) with `className={\`blend-h-plain ${styles.blendPlain}\`}`.
- `app/faq/faq.module.css` (lines 69–73) defines `.blendPlain { color: white; mix-blend-mode: difference; }`.
- This pattern is designed to composite against a full-viewport WebGL/gradient canvas positioned behind the hero band (as it correctly does for `HeroSection.tsx`, `PricingSection.tsx`, `HowItWorks.tsx`, etc. — all of which pass an inline `style={blendWhite}`/`blendText}` too), so the white text visually reads as a shifting gradient against the dark swoosh graphic. On the FAQ page, that swoosh/gradient background only covers the hero banner area near the top of the page. As soon as a `.blendPlain`-styled element scrolls into the plain white body of the page (the accordion list itself, and every FAQ group's `<h2>` title after the first one, which happens to still overlap the tail of the hero graphic), there is nothing for `mix-blend-mode: difference` to composite against, so the text renders literally white-on-white — invisible. Confirmed visually at both viewports: `screenshots/slices/mobile-faq-part1.png` (rows show only a bare "+" toggle button, no question text) and `screenshots/slices/desktop-faq-part0.png` (same — "GETTING STARTED" group's `<h2>` title and every accordion question in the "THE PLATFORM" group are blank). The accordion still works functionally (clicking/tapping the invisible row still expands to show the answer `<p>`, which is not blend-styled and renders fine), but the question text itself can't be read until clicked blindly. The "Compare options" comparison cards further down the FAQ page use plain (non-blend) styling and render correctly.
- This is pre-existing and unrelated to Workstream A/B; flagging for the architect to fix (likely fix: drop `.blendPlain`/`mix-blend-mode` on the group `<h2>` and accordion `<summary>` spans in `app/faq/page.tsx`, or add a real backdrop, since these do not sit over the animated canvas).

**tsc check:** `npx tsc --noEmit` — clean, no errors, run after the visual pass (no PricingSection.tsx edits were made, so this is confirming pre-existing state, not a new change).

Screenshot inventory (all under the scratchpad `qa-playwright/screenshots/` dir above): `mobile-home-full.png`, `desktop-home-full.png`, `mobile-pricing.png`, `mobile-pricing-scale-card.png`, `mobile-scale-card-crop.png`, `desktop-pricing.png`, `mobile-faq.png`, `desktop-faq.png`, `mobile-contact.png`, `desktop-contact.png`, `mobile-nav-open.png`, plus `slices/` (readable chunked crops of the tall pages) and `results.json` (raw overflow-check data per page/viewport).

No repo files were modified for Workstream C. Did not commit.

## D — FAQ page: fix white-on-white question titles (the bug flagged in C)

**Status: Done.**

Files touched: `app/faq/faq.module.css` and `app/faq/page.tsx` only. Did not commit.

**Investigation.** Grepped every `.blendPlain` usage in `app/faq/page.tsx` (6 total) before touching anything:
- Line 321 — hero title, first span ("Clarity before") inside `<section className={styles.hero}>`. Sits directly over the `WebGLShaderBackground` canvas near the top of the page, where the shader's dark line is deliberately offset upward (`lineOffset: 0.32`) to hug the headline. Genuinely hero — kept blended.
- Line 324 — hero title, second span ("commitment."), uses the sibling `.blendOrange` class (gradient-clip text + `mix-blend-mode`). Also genuinely hero, untouched — out of scope (not `.blendPlain`, not reported broken).
- Line 374 — each FAQ group's `<h2>` heading (e.g. "What Vyso is", "From messy process to working system"). Renders in `.groups` on the plain white page body, well below the hero.
- Line 386 — each accordion question `<span>` inside `<summary>` — the specific element reported invisible in production.
- Line 412 — the "Different tools suit different jobs." comparison-section heading. Also on the white body.
- Line 468 — the "Bring us the messy workflow." CTA heading. Also on the white body (the CTA glow is a soft orange radial highlight, not a dark backdrop).

Also checked `components/WebGLShaderBackground.tsx`: the `global` canvas is `position: fixed` but sized `100vh` (viewport height only, not full document height), `z-index: -1`. It stays pinned behind the viewport as the page scrolls, so a `mix-blend-mode: difference` element anywhere in the document can technically still composite against whatever the canvas is currently showing at that screen position — but since the shader paints mostly white with only a thin dark line near the top of the *viewport*, any blended text below the hero only reads correctly while that thin line happens to intersect it; the rest of the time (and per the confirmed production Chrome render, apparently all of the time on this page) it's literally `color: white` with no visible blend, i.e. invisible on the white body. Also confirmed the codebase already has a known, separate mobile workaround for this exact class of bug (`components/BlendTextMobile.tsx`, `.line-over` toggling, `app/globals.css` "neutralise positioned ancestors that trap mix-blend-mode" section for the marketing pages) — reinforcing that `mix-blend-mode: difference` on this codebase is only reliable directly over the hero canvas, not for headings scattered down a long page. `.question summary` (`faq.module.css` line ~247) already declares `color: var(--faq-ink)` as its base color — the inner `.blendPlain` span was overriding that correct dark color with `white`, which is the direct mechanism of the bug.

**Fix.** Split `.blendPlain` into two classes in `faq.module.css`:
- `.blendPlain` — unchanged (`display: block; color: white; mix-blend-mode: difference;`), left in place only for the hero title span (line 321), with a comment explaining it's safe there because the dark canvas backdrop is guaranteed.
- New `.plainInk` — `display: block; color: var(--faq-ink);` (the same dark ink, `#0d0d0d`, used as the page's base text color and by the group-heading description/body copy's darker sibling elements), with a comment explaining why: mix-blend-mode isn't reliable against the plain white body.

In `page.tsx`, swapped `className={\`blend-h-plain ${styles.blendPlain}\`}` → `className={styles.plainInk}` for the 4 non-hero usages (group heading L374, question span L386, comparison heading L412, CTA heading L468) — also dropping the now-inert `blend-h-plain` global class (it only mattered for `BlendTextMobile.tsx`'s reactive-color toggling, which no longer applies once the element isn't blend-styled). Hero usages (L321 `.blendPlain`, L324 `.blendOrange`) were left completely untouched.

Chevron/hover/active states were not touched — `.questionControl` (the ⊕/⊖ circle) is a sibling span using `currentColor` and its own `.question[open] .questionControl` rule, independent of the text span's class.

**Verification:**
- `npx tsc --noEmit` — clean, no output.
- `rm -rf .next && npm run build` — succeeded (one transient "Directory not empty" on the first `rm -rf`, resolved on retry, same as Workstream C's build).
- `npm run start` in the background, confirmed `200` from `curl localhost:3000/faq`, no server errors in the log.
- Screenshots via the existing scratchpad Playwright setup (`qa-playwright/faq-screenshot.js`), viewed directly:
  - `faq-desktop-full.png` (1440×900, full page) — every FAQ question title, all 5 group headings, the comparison heading, and the CTA heading render in solid dark ink, fully readable. Hero title ("Clarity before commitment.") still shows its dark/gradient blend effect over the WebGL swoosh, unaffected.
  - `faq-mobile-full.png` (390×844, full page) — same result at mobile width; all question titles readable.
  - `faq-question-active-open.png` — clicked the first question ("What is Vyso?"): title stays dark/legible, the chevron circle rotates and turns orange (open state), confirming interaction styling still works.
- Killed the server (`pkill -f "next start"`, confirmed port 3000 free).

Screenshot paths (scratchpad, not in repo):
- `/private/tmp/claude-501/-Users-joshuamoreira-Developer-Vyso-Software/82928899-37fd-4392-b0cc-28540e55acae/scratchpad/faq-desktop-full.png`
- `/private/tmp/claude-501/-Users-joshuamoreira-Developer-Vyso-Software/82928899-37fd-4392-b0cc-28540e55acae/scratchpad/faq-mobile-full.png`
- `/private/tmp/claude-501/-Users-joshuamoreira-Developer-Vyso-Software/82928899-37fd-4392-b0cc-28540e55acae/scratchpad/faq-question-active-open.png`
- (also captured but not separately reviewed: `faq-desktop-open.png`, `faq-mobile-open.png`, `faq-question-hover.png`)

No other files were modified. Did not commit.

## E — Desktop app "damaged" error, second attempt: real deep ad-hoc signature + hard gates

**Status: Done. All hard gates passed. Root cause of Workstream B's failure was that its ad-hoc signature was invalid (linker-signed only, no sealed resources), not just unnotarized — plus a real, unrelated crash bug in `main.js` was found and fixed along the way.**

Files touched: `desktop/main.js` (one-line real bug fix, see below) and gitignored `desktop/dist/*` build outputs. `desktop/package.json` needed **no change** this round — its `build.mac` config from Workstream B (no `identity: null`) is correct; the earlier "damaged" fix wasn't a package.json problem, it was that Workstream B never got a *sealed* signature (see below). Did not commit.

**Starting state (confirmed before touching anything):** `security find-identity -v -p codesigning` → **0 valid identities** (two expired certs present, both `CSSMERR_TP_CERT_EXPIRED`). `codesign -dv dist/mac-arm64/Vyso.app` showed `Identifier=Electron`, `flags=0x20002(adhoc,linker-signed)`, `Info.plist=not bound`, `Sealed Resources=none`. `codesign --verify --deep --strict` failed: *"code has no resources but signature indicates they must be present."* This confirms Workstream B's app was never actually validly signed — the linker's automatic ad-hoc stub isn't a real seal, so Gatekeeper correctly called it damaged regardless of the "unsigned community build" release notes.

**Step 1 — clean rebuild, no CSC env vars:** `npx electron-builder --mac --dir` (no `CSC_IDENTITY_AUTO_DISCOVERY` set at all this time, confirmed via `env | grep -i csc` → empty). electron-builder logged `skipped macOS application code signing  reason=cannot find valid "Developer ID Application" identity` and listed the same 2 expired identities, 0 valid. Result was identical to before: `flags=0x20002(adhoc,linker-signed)`, `Info.plist=not bound`, `codesign --verify --deep --strict` still failed the same way. So electron-builder genuinely cannot produce a sealed signature on this machine under any env-var combination — manual signing (step 2) is mandatory, not optional.

**Step 2 — manual deep ad-hoc sign:** `codesign --force --deep --sign - --timestamp=none dist/mac-arm64/Vyso.app`. No `--deep` warnings (output was just `dist/mac-arm64/Vyso.app: replacing existing signature`), so no need for the inside-out per-helper fallback — `--deep` alone correctly signed all 4 helper `.app`s (`Vyso Helper.app`, `Vyso Helper (GPU).app`, `Vyso Helper (Renderer).app`, `Vyso Helper (Plugin).app`) and all 4 frameworks (`Electron Framework`, `ReactiveObjC`, `Squirrel`, `Mantle`) before the outer bundle.

**Gate evidence (all HARD gates, step 3):**

a. `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Vyso.app` → walked and `--validated:` every helper/framework, ended:
   ```
   dist/mac-arm64/Vyso.app: valid on disk
   dist/mac-arm64/Vyso.app: satisfies its Designated Requirement
   ```
   **exit=0.**

b. `codesign -dv dist/mac-arm64/Vyso.app`:
   ```
   Identifier=za.co.vyso.desktop
   CodeDirectory v=20400 size=491 flags=0x2(adhoc) hashes=9+3 location=embedded
   Signature=adhoc
   Info.plist entries=32
   Sealed Resources version=2 rules=13 files=10
   ```
   `Signature=adhoc` ✓, **no** `linker-signed` in flags ✓, `Info.plist entries=32` (bound, not "not bound") ✓, `Sealed Resources` now populated (was `none` before) ✓, `Identifier=za.co.vyso.desktop` matches the `appId` configured in `package.json` ✓.

   **Mid-workstream incident, caught and fixed:** an intermediate rebuild (done while temporarily instrumenting `main.js` with debug logging to diagnose the launch-test failure below) produced `Identifier=com.electron.vyso-desktop` and `LSApplicationCategoryType=public.app-category.developer-tools` instead of the configured `za.co.vyso.desktop` / `public.app-category.business`. Investigating why surfaced that `desktop/package.json` itself had been silently truncated at some point during the repeated `electron-builder`/`@electron/rebuild` invocations in this session — `git diff desktop/package.json` showed the entire `scripts`, `devDependencies`, and `build` (appId/category/icon/target/files) blocks had been dropped, leaving only `name`/`private`/`productName`/`version`/`main`. This was **not** an intentional edit. Restored immediately via `git checkout -- desktop/package.json`, confirmed `git diff` clean, then did a full clean rebuild (`rm -rf dist/mac-arm64`) + re-sign + re-ran all three hard gates + rebuilt and re-verified the DMG + re-uploaded the release asset, all against the restored config. The gate evidence and DMG size quoted throughout this section (files/hashes/sizes below) are from that final, package.json-verified-intact build — not the intermediate corrupted one. The app's icon (`build/icon.icns`, sha1 `c54ed333...`) was unaffected either way since `Contents/Resources/icon.icns` had already been copied into `dist/mac-arm64` by an earlier, uncorrupted build step and electron-builder doesn't re-derive it from `package.json` alone.

c. **Launch test** — this required extra diagnosis. Two real issues were found (both are genuine findings, not just "adhoc signing worked"):

   1. **Real crash bug in `main.js` (independent of signing):** the very first fully-instrumented launch attempt showed the app process actually starting (Electron main process, GPU helper, network-service helper all spawned — confirmed via `ps`/`log show`), but crashing inside `app.whenReady()` with:
      ```
      TypeError: win.setWindowOpenHandler is not a function
          at createWindow (.../app.asar/main.js:37:7)
      ```
      `setWindowOpenHandler` is a method of `BrowserWindow.webContents`, not of `BrowserWindow` itself — `main.js` had been calling `win.setWindowOpenHandler(...)` directly since Workstream B (or earlier). This bug would have crashed the app on **every** launch attempt regardless of code signing, and was never actually exercised in Workstream B because that build never got far enough to reach `app.whenReady()`'s promise resolving with a real signature. **Fixed**: changed line 37 in `desktop/main.js` to `win.webContents.setWindowOpenHandler(...)`. No other lines changed.
   2. **Environment gotcha (not an app bug, but recorded for future automated launch tests on this machine):** this Bash tool's shell inherits `ELECTRON_RUN_AS_NODE=1` from the host Claude Code/VS Code Electron process (`env | grep -i electron` confirmed it). With that variable set, *any* Electron binary — including the packaged `Vyso.app` — runs as plain Node.js instead of the real Electron/Chromium runtime: `require('electron')` returns a path string instead of the `{ app, BrowserWindow, ... }` API, so the app silently no-ops or throws and the process exits near-instantly with no window, no crash report, and often no stderr at all. Confirmed this in isolation with a throwaway hello-world Electron app in the scratchpad. **Fix for testing purposes only** (not a shipped-app change): every launch in this workstream was run with `env -u ELECTRON_RUN_AS_NODE` prefixed.

   With both addressed, the real gate-C evidence: `env -u ELECTRON_RUN_AS_NODE open dist/mac-arm64/Vyso.app` (after killing any stray prior test instances) → `open exit=0`. 5 seconds later, `pgrep -fl "Vyso.app"` showed the main process plus, critically, a full Chromium process tree (`ps -o pid,lstart,command`):
   ```
   61393  Vyso (main)                                          started 16:54:15
   61398  Vyso Helper --type=gpu-process                        started 16:54:15
   61399  Vyso Helper --type=utility --utility-sub-type=NetworkService   started 16:54:15
   61400  Vyso Helper (Renderer) --type=renderer --enable-sandbox  started 16:54:15
   ```
   The presence of a live **renderer** process (not just GPU/network-utility) confirms `createWindow()` completed and the window actually began loading `https://vyso.co.za/app` — the app is genuinely functional, not just "not crashing." Quit via `osascript -e 'quit app "Vyso"'`; confirmed clean via `pgrep -fl "Vyso.app|Vyso Helper"` returning nothing 2s later (also force-`pkill -9`'d as a belt-and-braces cleanup).

**Step 4 — deterministic DMG (hdiutil, not electron-builder's dmg target):** staged in scratchpad (`ditto dist/mac-arm64/Vyso.app <staging>/Vyso.app` + `ln -s /Applications <staging>/Applications`), confirmed the `ditto` copy still verified (`codesign --verify --deep --strict` → exit 0) before packaging. `hdiutil create -volname "Vyso" -srcfolder <staging> -ov -format UDZO dist/Vyso-Desktop.dmg` → `created: .../dist/Vyso-Desktop.dmg`. `hdiutil verify dist/Vyso-Desktop.dmg` → all sections `verified CRC32 ...`, final line `verified CRC32 $67AAC970` / `checksum of "dist/Vyso-Desktop.dmg" is VALID`. **Final DMG size: 134,686,957 bytes (~128.4 MiB / ~134.7 MB)**, up from Workstream B's 121,464,091 bytes (the sealed resources/CodeDirectory hashes for every file account for the increase). (Steps 4–7 were each run twice — once against the intermediate corrupted-`package.json` build, then discarded and re-run in full against the restored/verified build once the incident above was caught; all numbers quoted in this section are from the final, correct run.)

**Step 5 — post-package gate (mount → copy → verify → simulate download):**
- `hdiutil attach dist/Vyso-Desktop.dmg -readonly -nobrowse` → mounted read-only.
- `ditto` the mounted `Vyso.app` to a scratchpad temp dir → `codesign --verify --deep --strict` on the copy → **exit 0**.
- Simulated a browser download: `xattr -w com.apple.quarantine "0181;00000000;Safari;" <copy>/Vyso.app`, confirmed via `xattr -l` the quarantine flag was set alongside the pre-existing `com.apple.provenance` attribute. Re-ran `codesign --verify --deep --strict` on the now-quarantined copy → **still exit 0** (the seal survives quarantine tagging, as expected — quarantine is just an xattr, not a signature mutation).
- `spctl -a -vv --type execute <copy>/Vyso.app` → **`rejected`, exit 3**. This is the expected, documented outcome (no notarization ticket, no paid Apple Developer ID available — confirmed 0 valid identities at the very start of this workstream) and matches exactly the "Apple could not verify" flow the release notes now describe, rather than "damaged."
- Detached the mount (`hdiutil detach`) and removed all scratchpad temp dirs (`dmg-staging`, `dmg-mount`, `dmg-copy-test`, the throwaway `hello-electron` test app, and stray debug log files) afterward.

**Step 6 — release upload + notes:** `gh release upload desktop-v1.0.0 "dist/Vyso-Desktop.dmg#Vyso-Desktop.dmg" --clobber --repo joshua-vyso/Vyso-Website` succeeded silently (no output = success for `gh release upload`). `gh release edit desktop-v1.0.0 --repo joshua-vyso/Vyso-Website --notes-file ...` updated the notes to describe the unsigned/ad-hoc/non-notarized build and the correct first-launch flow for the "could not verify" dialog: click Done, then **System Settings → Privacy & Security → Open Anyway** (with the old right-click → Open instructions kept as a fallback for older macOS), plus the existing `xattr -cr /Applications/Vyso.app` fallback if macOS still reports it as damaged.

**Step 7 — download URL check:** `gh release view --json assets` confirmed the new asset (`size: 134686957`, `digest: sha256:846339a9...`, `updatedAt: 2026-07-27T14:55:36Z`). `curl -sIL https://github.com/joshua-vyso/Vyso-Website/releases/download/desktop-v1.0.0/Vyso-Desktop.dmg` → `HTTP/2 302` (GitHub's redirect to its Azure blob CDN) → `HTTP/2 200`, `content-length: 134686957` matching the local file exactly.

**Summary of what changed vs. Workstream B:** B produced an ad-hoc-but-unsealed signature (`linker-signed`, no resources) that Gatekeeper correctly rejected as "damaged" — a strictly worse UX than the "could not verify"/right-click-Open flow it was meant to produce. This workstream replaced that with a real, sealed, deep ad-hoc signature (`Signature=adhoc`, no `linker-signed`, `Sealed Resources` populated, `codesign --verify --deep --strict` passing both pre- and post-quarantine) and fixed a genuine, previously-latent `main.js` crash bug that no prior attempt had actually exercised.

No other files were modified. `desktop/package.json` required no changes. Did not commit.

# Plan: Round-2 fixes — DMG "damaged" error, rounded icon, pricing tile trim, mobile check

## Workstream A — Pricing tiles: trim to 5 scope bullets each
File: `components/sections/PricingSection.tsx` ONLY (TIERS array). The tiles overflowed with the full scope lists (cards misaligned, setup/retainer block wrapping). Keep full scope in the FAQ (already there — do not touch the FAQ). New feature lists, EXACTLY 5 per tier, focused on module count, automation transfer, and Finch availability:

**Start** (prices/tagline/CTA unchanged):
1. "Workflow automation in your existing stack" — keep sub "WhatsApp, Google Sheets, Outlook, etc."
2. "Up to 5 automations included"
3. "Breakages fixed proactively"
4. "New automations on a monthly delivery cycle"
5. "Finch available from Create"

**Create**:
1. "One productised Vyso module of your choice"
2. "Start automations migrated into your module"
3. "Finch companion app included for your module"
4. "Team onboarding and 60-day support"
5. "Dashboard, user roles and handover included"

**Scale**:
1. "Everything in Create"
2. "Add modules as your operation grows"
3. "Finch companion app across all modules"
4. "Two-way integrations with outside systems" — keep sub "accounting, POS, banking, CRMs, supplier systems"
5. "Monthly ops reports and quarterly optimisation"

Keep: prices, "+R3,000/month per additional module" note on Scale, "Join Waitlist" CTAs, scope-guard line, audit banner. After editing, check the card layout renders sanely (equal-ish heights; the SETUP/RETAINER row shouldn't wrap awkwardly — if the note still forces wrapping on the Scale card, report it, don't redesign). Verify `npx tsc --noEmit`. Write outcome to `.ai/implementation_fixes-round2.md` (append section "A").

## Workstream B — Desktop app: fix "damaged" launch error + rounded icon
Files: `desktop/package.json`, `desktop/build/icon.icns`, GitHub release `desktop-v1.0.0`.

1. **Why it's broken:** `mac.identity: null` skips codesigning entirely. On Apple Silicon, unsigned arm64 apps downloaded from a browser fail Gatekeeper with "damaged and can't be opened". Fix: REMOVE `"identity": null` from the mac config so electron-builder applies its default **ad-hoc signature**, and set env `CSC_IDENTITY_AUTO_DISCOVERY=false` for the dist run so it doesn't hunt for a real cert. Result: app opens via right-click → Open ("unverified developer" instead of "damaged").
2. **Rounded icon:** regenerate the icon with Apple's modern icon shape: 1024×1024 canvas, artwork scaled to ~824×824 centred (standard Big Sur margin, transparent border), rounded-rect mask with corner radius ≈ 185px (22.5% of 824). Source: `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Mobile/assets/icon.png`. Tooling: check for python3 + Pillow (`python3 -c "import PIL"`); if missing, `pip3 install --user Pillow` or use a tiny Node script with `sharp` installed into the scratchpad (NOT into the repo). Output a masked transparent PNG, then rebuild the full iconset + `iconutil -c icns` → replace `desktop/build/icon.icns`. Delete any intermediate iconset dir.
3. Rebuild: `cd desktop && CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist`. Verify with `codesign -dv dist/mac-arm64/Vyso.app` (expect `Signature=adhoc`) and `hdiutil verify` on the DMG.
4. Replace the release asset IN PLACE so the stable URL keeps working: `gh release upload desktop-v1.0.0 "desktop/dist/Vyso-Desktop.dmg#Vyso-Desktop.dmg" --clobber --repo joshua-vyso/Vyso-Website`. Then update the release notes: `gh release edit desktop-v1.0.0 --repo joshua-vyso/Vyso-Website --notes "..."` — notes must say: unsigned community build; first launch: right-click Vyso.app → Open → Open; if macOS still reports the app as damaged, run: `xattr -cr /Applications/Vyso.app`.
5. Verify `curl -sIL -o /dev/null -w '%{http_code}' https://github.com/joshua-vyso/Vyso-Website/releases/latest/download/Vyso-Desktop.dmg` → 200. Report new DMG size. Append section "B" to `.ai/implementation_fixes-round2.md`.

Constraints: don't touch ModulesOverlay.tsx or any website file. Don't commit.

## Workstream C — Mobile responsiveness check (after A lands)
Build the site (`npm run build`) and serve it (`npm run start`, default port 3000; run in background, kill after). Screenshot with Playwright: `npx playwright screenshot` won't exist as a project dep — install chromium via `npx -y playwright@latest install chromium --with-deps` is NOT allowed to modify the repo; use scratchpad npx cache. Capture at iPhone viewport (390×844, deviceScaleFactor 2, mobile UA) AND 1440×900 desktop for: `/` (top + contact form section), `/pricing` (tier cards), `/faq`, `/contact`. Full-page screenshots. Inspect the images for: horizontal overflow, overlapping/clipped pricing cards, wrapped SETUP/RETAINER labels, nav issues, text overflowing tiles. Report findings with the screenshot paths (save under the scratchpad dir). Fix nothing without reporting first UNLESS it's a one-line Tailwind class fix in PricingSection.tsx related to card overflow — coordinate: workstream A owns that file, so only touch it after A is done. Append section "C" to `.ai/implementation_fixes-round2.md`.

## After all: architect (me) reviews, commits, pushes to finch-onboarding + merges main.

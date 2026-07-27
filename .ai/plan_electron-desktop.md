# Plan: Electron desktop app (DMG) + "Download Desktop App" entry in modules overlay

## Goal
Wrap the existing Vyso platform (https://vyso.co.za/app) in an Electron desktop app distributed as a macOS DMG, and add a visually distinct "Download Desktop App" section below the module list in the platform's hamburger-menu overlay. Do NOT modify or break the existing web platform behaviour.

## Acceptance criteria
- `desktop/` contains a self-contained Electron project that builds a DMG via `npm run dist`.
- DMG uses the Finch/Vyso Mobile app icon (`/Users/joshuamoreira/Developer/Vyso/Software/Vyso Mobile/assets/icon.png`, 1254×1254 PNG).
- App loads `https://vyso.co.za/app`; external links open in the default browser.
- DMG uploaded to a GitHub Release on `joshua-vyso/Vyso-Website` (public repo) so `https://github.com/joshua-vyso/Vyso-Website/releases/latest/download/Vyso-Desktop.dmg` resolves.
- ModulesOverlay shows a separate "Download Desktop App" area BELOW the modules grid.
- `npm run build` for the Next.js site still passes (checked in final validation; keep your edits type-safe).

## Files to create
- `desktop/package.json` — private pkg `vyso-desktop`, `productName: "Vyso"`, version `1.0.0`, `main: "main.js"`, devDeps: `electron` (latest stable), `electron-builder` (latest). Scripts: `"start": "electron ."`, `"dist": "electron-builder --mac dmg"`.
  - `build` config: `appId: "za.co.vyso.desktop"`, `productName: "Vyso"`, `mac: { category: "public.app-category.business", icon: "build/icon.icns", identity: null }` (skip code signing — no signing identity available), `dmg` target arm64 (host arch), `artifactName: "Vyso-Desktop.dmg"`, `directories: { output: "dist", buildResources: "build" }`, `files: ["main.js"]`.
- `desktop/main.js` — plain JS (no TS). BrowserWindow 1440×900, min 1080×700, `webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }`, `loadURL('https://vyso.co.za/app')`. `setWindowOpenHandler`: URLs on host `vyso.co.za` → allow (or load in window); anything else → `shell.openExternal`, deny. Also intercept `will-navigate` to block navigation off `vyso.co.za` (open externally instead). Standard macOS lifecycle: re-create window on `activate`, quit on `window-all-closed` except darwin.
- `desktop/build/icon.icns` — generate from the mobile icon:
  1. `mkdir -p desktop/build/icon.iconset`
  2. Use `sips` to resize `/Users/joshuamoreira/Developer/Vyso/Software/Vyso Mobile/assets/icon.png` into the iconset sizes (16,32,64,128,256,512,1024 with @2x variants, macOS iconset naming).
  3. `iconutil -c icns desktop/build/icon.iconset -o desktop/build/icon.icns`; delete the iconset dir afterwards.
- `desktop/.gitignore` — `node_modules/`, `dist/`.

## Files to modify
- `tsconfig.json` (repo root): add `"desktop"` to the `exclude` array so Next's typecheck ignores the Electron project.
- `components/platform/ModulesOverlay.tsx`: insert new section after the modules grid closes (currently line 179 `</div>`) and before the panel's closing `</div>` (line 180). Structure:
  - `mt-6` container with a top border separator (`border-t border-[#EEF1F5] pt-5`).
  - Left: small heading `text-[13px] font-semibold text-[#171A17]` — "Vyso for desktop" — plus one-line desc `text-[12px] text-[#9BA0A8]` — e.g. "Run your modules in a dedicated app on your Mac."
  - Right: an `<a>` styled as a button: `href="https://github.com/joshua-vyso/Vyso-Website/releases/latest/download/Vyso-Desktop.dmg"`, label **"Download Desktop App"**, classes consistent with platform palette: `inline-flex items-center gap-2 rounded-[11px] bg-[#1F5FA8] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#174C87]`. Add a small inline download SVG icon (stroke currentColor). Layout: `flex items-center justify-between gap-4` (stack on small screens: `flex-col sm:flex-row sm:items-center`, left block `text-left`).
  - Keep it visually distinct from module cards (no card border grid styling; it sits in its own separated strip).
- Root `.gitignore` (if desktop/.gitignore alone is insufficient — verify root .gitignore exists; add `desktop/node_modules/` and `desktop/dist/` there too for safety).

## Constraints / do not touch
- Do not modify `proxy.ts`, auth flows, `next.config.ts`, `vercel.json`, or any marketing pages.
- Do not commit `node_modules` or the DMG to git. DO NOT run `git add`/`git commit` at all — the working tree has unrelated WIP.
- Do not add the DMG to `public/` (too large for git/Vercel); hosting is via GitHub Release only.
- Other agents are editing marketing files concurrently — touch ONLY the files listed above.
- Repo rule (AGENTS.md): this Next.js version (16.2.7) has breaking changes; if you need Next specifics, read `node_modules/next/dist/docs/`. For this task you shouldn't need any Next API changes.

## Ordered steps
1. Scaffold `desktop/` (package.json, main.js, .gitignore).
2. Generate `desktop/build/icon.icns` from the mobile icon (sips + iconutil).
3. `cd desktop && npm install` (expect a large Electron download).
4. `npm run dist` → verify `desktop/dist/Vyso-Desktop.dmg` exists; run `hdiutil verify` on it; report file size.
5. Smoke-test: `hdiutil attach -nobrowse -readonly` the DMG, confirm `Vyso.app` present, detach. (Do not launch the GUI.)
6. Edit `components/platform/ModulesOverlay.tsx` per spec above.
7. Edit `tsconfig.json` exclude.
8. Create GitHub release: `gh release create desktop-v1.0.0 "desktop/dist/Vyso-Desktop.dmg#Vyso-Desktop.dmg" --repo joshua-vyso/Vyso-Website --title "Vyso Desktop 1.0.0" --notes "First release of the Vyso desktop app — a macOS wrapper around the Vyso platform. Unsigned build: on first launch, right-click the app and choose Open."` Then verify the latest/download URL returns 200/302: `curl -sIL -o /dev/null -w '%{http_code}' https://github.com/joshua-vyso/Vyso-Website/releases/latest/download/Vyso-Desktop.dmg`.
9. Run `npx tsc --noEmit` at repo root to confirm the overlay/tsconfig edits type-check (full site build happens in final validation).

## Edge cases
- Unsigned app: Gatekeeper will warn. Note this in the release notes (done above) and in `.ai/implementation.md`.
- electron-builder may try to sign; `identity: null` prevents it. If it still attempts notarization, set `CSC_IDENTITY_AUTO_DISCOVERY=false` env for the dist run.
- Icon has no alpha channel — acceptable; do not add rounding masks.
- If `gh release create` fails because tag exists, use a new tag `desktop-v1.0.1`.

## Verification commands
- `ls -la desktop/dist/*.dmg && hdiutil verify desktop/dist/Vyso-Desktop.dmg`
- `curl -sIL -o /dev/null -w '%{http_code}\n' https://github.com/joshua-vyso/Vyso-Website/releases/latest/download/Vyso-Desktop.dmg` → expect 200
- `cd "/Users/joshuamoreira/Developer/Vyso/Software/Vyso Website" && npx tsc --noEmit`

## Output
Write results, DMG size, release URL, and any deviations to `.ai/implementation_electron-desktop.md`.

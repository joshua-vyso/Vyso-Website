# Implementation: Electron desktop app (DMG) + "Download Desktop App" entry

Executed per `.ai/plan_electron-desktop.md` on 2026-07-27.

## Files created
- `desktop/package.json` — `vyso-desktop`, `productName: "Vyso"`, `main.js`, `electron`/`electron-builder` devDeps (installed as latest: electron-builder 26.15.3, Electron 43.2.0). Scripts: `start` (`electron .`), `dist` (`electron-builder --mac dmg`).
- `desktop/main.js` — plain JS, BrowserWindow 1440x900 (min 1080x700), `contextIsolation: true` / `nodeIntegration: false` / `sandbox: true`, loads `https://vyso.co.za/app`. `setWindowOpenHandler` and `will-navigate` both restrict navigation to `vyso.co.za` (and subdomains), everything else opens via `shell.openExternal` and is denied/prevented in-window. Standard macOS lifecycle (`activate` re-creates window, `window-all-closed` quits except on darwin).
- `desktop/build/icon.icns` — generated from `Vyso Mobile/assets/icon.png` (1254x1254 source, confirmed via `sips -g`) via a full iconset (16 through 1024 + @2x) and `iconutil -c icns`. iconset dir removed after.
- `desktop/.gitignore` — `node_modules/`, `dist/`.

## Files modified
- `tsconfig.json` (repo root) — added `"desktop"` to `exclude`.
- `components/platform/ModulesOverlay.tsx` — added a "Vyso for desktop" strip below the modules grid (after the grid's closing `</div>`, inside the panel), separated by a top border, with heading, one-line description, and a "Download Desktop App" button linking to the GitHub Releases `latest/download` asset URL, per the spec's classes/layout (`flex-col sm:flex-row`, blue button, inline download icon).
- Root `.gitignore` — added `desktop/node_modules/` and `desktop/dist/` for defense in depth alongside `desktop/.gitignore`.

## Build / verification results
- `npm install` in `desktop/`: succeeded, 284 packages (pre-existing electron-builder deprecation/audit warnings only, no errors).
- `npm run dist` (with `CSC_IDENTITY_AUTO_DISCOVERY=false` set defensively): succeeded. electron-builder skipped code signing (`identity explicitly is set to null`), built `dist/Vyso-Desktop.dmg` for `arm64`.
- **DMG size: 121,823,198 bytes (≈ 116 MiB / 128 MB on disk).**
- `hdiutil verify desktop/dist/Vyso-Desktop.dmg` → `VALID` (CRC32 checksums all verified).
- Smoke test: `hdiutil attach -nobrowse -readonly` mounted the DMG at `/Volumes/Vyso 1.0.0-arm64`; `Vyso.app` present alongside an `Applications` symlink; detached cleanly. GUI was not launched, per plan.
- GitHub release: created tag `desktop-v1.0.0` on `joshua-vyso/Vyso-Website` via `gh release create`, title "Vyso Desktop 1.0.0", uploaded `Vyso-Desktop.dmg`, unsigned-build note included in release notes.
  - **Release URL: https://github.com/joshua-vyso/Vyso-Website/releases/tag/desktop-v1.0.0**
  - **Download URL verified: `curl -sIL -o /dev/null -w '%{http_code}' https://github.com/joshua-vyso/Vyso-Website/releases/latest/download/Vyso-Desktop.dmg` → `200`.**
- `npx tsc --noEmit` at repo root: exit code 0, no errors/output. Confirms the `ModulesOverlay.tsx` edit and `tsconfig.json` exclude are type-safe and desktop/ (plain JS, non-TS) doesn't get pulled into the Next typecheck.
- Full `npm run build` for the Next.js site was left for the caller's final validation pass, as noted in the plan (acceptance criteria says checked in final validation) — not run here to avoid interfering with the other concurrent agents' in-flight edits to marketing files.
- No `git add`/`git commit` was run, per instructions. `git status --porcelain` confirms only the intended files changed/untracked: `.gitignore` (M), `components/platform/ModulesOverlay.tsx` (M), `tsconfig.json` (M), `desktop/` (untracked, ignored by root .gitignore).

## Deviations from the plan
1. **`dmg` build config shape**: the plan's spec (`dmg: target arm64`) doesn't map to a literal electron-builder config key — `dmg` itself has no `target`/`arch` field. Implemented the equivalent correctly-typed config instead: `mac.target: [{ target: "dmg", arch: ["arm64"] }]`. Functionally matches the plan's intent (single-arch arm64 DMG, host arch) and worked on the first build.
2. Ran `npm run dist` with `CSC_IDENTITY_AUTO_DISCOVERY=false` proactively (the plan lists this only as a fallback "if it still attempts notarization"). Since `identity: null` alone was sufficient (build log shows signing was skipped cleanly), this env var was likely unnecessary but is harmless and matches the plan's own suggested mitigation.
3. Did not run the full Next.js `npm run build` — the plan's acceptance criteria explicitly defers that to "final validation," and running it here risked colliding with three other concurrent agents editing marketing files in the same working tree.

## Known caveats (carried into release notes)
- App is unsigned/unnotarized. Gatekeeper will warn on first launch; users must right-click → Open. This is called out in the GitHub release notes.
- Icon source has no alpha channel; no rounding mask was added, per plan.

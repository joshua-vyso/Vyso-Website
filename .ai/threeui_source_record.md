# ThreeUI source & licence record — redesign/agency-2026

**Date:** 2026-09-01. All four mandatory bundles fetched from the public registry and extracted byte-exact into the repo. Registered files are **never edited**; all app logic lives in wrappers under `components/site/three/`.

## Retrieval
| Bundle | URL | HTTP |
|---|---|---|
| AnimatedTopDock | https://threeui.com/source-code/animated-top-dock.json | 200 |
| Halftone Flow | https://threeui.com/source-code/halftone-flow.json | 200 |
| Plasma Button | https://threeui.com/source-code/plasma-button.json | 200 |
| Flow Field | https://threeui.com/source-code/flow-field.json | 200 |
| fragment-mono.woff2 | https://threeui.com/assets/fragment-mono-DI4ZVuWr.woff2 (site-hashed asset; bundle JSON carries path+sha only) | 200, font/woff2, 15 176 B |

## SHA-256 verification — ALL PASS (computed with `shasum -a 256` semantics via Python hashlib on exact bytes)
| File | SHA-256 | Result |
|---|---|---|
| src/shaders/animated-top-dock/AnimatedTopDock.tsx | 50ddbba7ebc81565f42bd14dda34efb45e7b18c1aa47e97f196256ffedb4478f | ✅ |
| src/shaders/animated-top-dock/topDockController.ts | 506ab23d4d42cf1b5bc89131e7714586ee107381bb18d9b0302766e9a1dee2bd | ✅ |
| src/shaders/animated-top-dock/retroPixelField.ts | 54f0469be51dfce2da7ce37c952d42c583cc7996794bf96d1ea0b2bb35d94115 | ✅ |
| src/shaders/animated-top-dock/glassParticleField.ts | bc9f07ae6da33b28f82303ea937095806f8e3a2ab08bd1301ae8457aaf0c3464 | ✅ |
| src/shaders/threeui.css (shared; identical in all 4 bundles, copied ONCE) | efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf | ✅ |
| src/shaders/fonts/fragment-mono.woff2 (15 176 B) | 4f4dc27f4a770c0d02fde800daa836c8adc0d1e423b28da74baaf0d1cc3ab96c | ✅ |
| src/shaders/neuform-isolated/NeuformCraftEffects.tsx | 0a1680c3c119dba8c61d946322afa0b64d36dfd80956fb5e7c3fd017d7bfa450 | ✅ |
| src/shaders/neuform-isolated/sources/nexus-unified-flow.html | fa1a015ae407dc2091c3c96239d28107e973cbc03aa7abef37dd5da791d5428b | ✅ |
| src/shaders/neuform-isolated/NeuformIsolatedEffects.tsx | fe9856234253bc3c1a13b3afb84f3d84644dfa6d578e7203bb3e1dd5eced1b75 | ✅ |
| src/shaders/neuform-isolated/sources/aetheris-labs.html | eea617fe0e37a79be7aee44f00a53ec3ae41e006e771a8aad53acce3648147e0 | ✅ |
| src/shaders/neuform-isolated/NeuformBatchEffects.tsx | dc68c51bea26b922965de44b4fb8d6c432607508fb2b61e16ed60d245da1a69f | ✅ |
| src/shaders/neuform-isolated/sources/flow-field.html | 78eaf8ce34317bb66c44b72069ff36c622987ef61d3e703e8ea5800e089eb0b2 | ✅ |
| src/shaders/neuform-isolated/sources/gateway-flow.html (ConstellationField "gateway-flow", bundle https://threeui.com/source-code/gateway-flow.json, fetched 2026-09-01) | c5a1de43138ffba96b9f0ecdcf3c054ae251ec94344e88c6ad502bae362b17d0 | ✅ |

Verification script: scratchpad `threeui/extract_verify.py` (session artifact; hashes re-checkable any time with `shasum -a 256` over the files above).

## Label adapter (user-directed, 2026-09-01)
The plasma control's on-screen label is changed to "BOOK A FREE AUDIT" at Josh's explicit direction. The registered `aetheris-labs.html` stays **byte-exact on disk** (hash above still passes); the swap happens in the module pipeline via `scripts/vyso-plasma-label.loader.cjs` (wired for both bundlers in `next.config.ts`), a no-op for every other source.

## Licence
ThreeUI Terms of Use ("Commercial use and licenses" → "Community materials"): *"Community package code is available under the license included with that code, currently the MIT License. Any item-specific attribution or third-party notice remains required."* The four bundles were served from the unauthenticated community `/source-code/` registry (the Pro API `/api/pro-components` requires auth and was **not** used). → The project may use, copy and ship these sources commercially under MIT. Third-party notices inside the registered files are preserved verbatim (files are unmodified by policy).

## Runtime arrangement (r128 / r134)
Documented in `.ai/handoff_agency_redesign_2026.md` § "r128/r134 runtime arrangement".

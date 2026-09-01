/* QA screenshot rig: scripted Chrome shots of the local dev site.
   Usage: node shoot.mjs <url> <outPrefix> [--width=1440] [--height=900]
          [--scrolls=0,900,1800] [--reduced] [--mobile] [--fullpage] [--dark] */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const url = args[0];
const prefix = args[1] ?? "shot";
const opt = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const width = Number(opt("width", flag("mobile") ? 390 : 1440));
const height = Number(opt("height", flag("mobile") ? 844 : 900));
const scrolls = opt("scrolls", "0").split(",").map(Number);

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--hide-scrollbars", "--mute-audio", ...(flag("nogl") ? ["--disable-webgl", "--disable-webgl2"] : [])],
});
const page = await browser.newPage();
await page.setViewport({ width, height, isMobile: flag("mobile"), hasTouch: flag("mobile"), deviceScaleFactor: flag("mobile") ? 2 : 1 });
const features = [];
if (flag("reduced")) features.push({ name: "prefers-reduced-motion", value: "reduce" });
if (flag("dark")) features.push({ name: "prefers-color-scheme", value: "dark" });
if (features.length) await page.emulateMediaFeatures(features);

page.on("console", (msg) => {
  if (["error", "warning"].includes(msg.type())) console.log(`[console.${msg.type()}]`, msg.text().slice(0, 300));
});
page.on("pageerror", (err) => console.log("[pageerror]", String(err).slice(0, 300)));

await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
await new Promise((r) => setTimeout(r, 2500));
mkdirSync(dirname(resolve(`${prefix}-0.png`)), { recursive: true });

if (flag("fullpage")) {
  await page.screenshot({ path: `${prefix}-full.png`, fullPage: true });
  console.log(`wrote ${prefix}-full.png`);
} else {
  for (const y of scrolls) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: `${prefix}-${y}.png` });
    console.log(`wrote ${prefix}-${y}.png`);
  }
}
const metrics = await page.evaluate(() => ({
  docH: document.documentElement.scrollHeight,
  overflowX: document.documentElement.scrollWidth > window.innerWidth,
  title: document.title,
}));
console.log(JSON.stringify(metrics));
await browser.close();

import puppeteer from "puppeteer-core";

const out = "/private/tmp/claude-501/-Users-joshuamoreira-Developer/12b299d4-0ada-4569-9ce5-16bbe8271559/scratchpad/shots";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--hide-scrollbars", "--mute-audio"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on("pageerror", (err) => console.log("[pageerror]", String(err).slice(0, 300)));
await page.goto("http://localhost:8080/", { waitUntil: "networkidle2", timeout: 45000 });
await new Promise((r) => setTimeout(r, 2500));
await page.click(".vx-nav-menu");
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: `${out}/menu-open.png` });
await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 1000));
// Preloader on a fresh session
const p2 = await browser.newPage();
await p2.setViewport({ width: 1440, height: 900 });
await p2.goto("http://localhost:8080/about", { waitUntil: "domcontentloaded" });
await p2.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
await new Promise((r) => setTimeout(r, 700));
await p2.screenshot({ path: `${out}/preloader.png` });
// Mobile menu
const m = await browser.newPage();
await m.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await m.goto("http://localhost:8080/", { waitUntil: "networkidle2", timeout: 45000 });
await new Promise((r) => setTimeout(r, 2000));
await m.click(".vx-nav-menu");
await new Promise((r) => setTimeout(r, 1500));
await m.screenshot({ path: `${out}/menu-mobile.png` });
console.log("done");
await browser.close();

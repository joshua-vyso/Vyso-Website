/* Capture an authorised still of the running Halftone Flow field (exact
   registered component) as the reduced-motion / no-WebGL hero poster. */
import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--hide-scrollbars"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle2", timeout: 45000 });
// Let the flow develop character before the still.
await new Promise((r) => setTimeout(r, 9000));
// Hide everything over the field so the capture is the component alone.
await page.addStyleTag({
  content: ".vy-hero-scrim, .vy-hero-content, .vy-dockframe, .vy-mobilebar { visibility: hidden !important; }",
});
await new Promise((r) => setTimeout(r, 300));
const field = await page.$(".vy-hero-field");
await field.screenshot({ path: process.argv[2] ?? "halftone-poster.png" });
console.log("captured");
await browser.close();

/* Logs into the platform as the demo org and screenshots product pages for
   the "what we built" evidence on /automations. Usage:
   node scripts/qa-platform-shots.mjs <outDir> [base=http://localhost:8080]
   Credentials come from env DEMO_EMAIL / DEMO_PASSWORD. */
import puppeteer from "puppeteer-core";
import { mkdirSync } from "node:fs";

const out = process.argv[2];
const base = process.argv[3] ?? "http://localhost:8080";
const email = process.env.DEMO_EMAIL;
const password = process.env.DEMO_PASSWORD;
if (!out || !email || !password) {
  console.error("usage: DEMO_EMAIL=… DEMO_PASSWORD=… node scripts/qa-platform-shots.mjs <outDir> [base]");
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--hide-scrollbars", "--mute-audio"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
page.on("pageerror", (err) => console.log("[pageerror]", String(err).slice(0, 200)));

await page.goto(`${base}/login`, { waitUntil: "networkidle2", timeout: 60000 });
await page.type("#email", email, { delay: 10 });
await page.type("#password", password, { delay: 10 });
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 }).catch(() => {}),
  page.keyboard.press("Enter"),
]);
await new Promise((r) => setTimeout(r, 2500));
console.log("after login:", page.url());

const ROUTES = process.argv.slice(4).length
  ? process.argv.slice(4)
  : [
      "/app/stock",
      "/app/stock/levels",
      "/app/stock/market",
      "/app/stock/suppliers",
      "/app/review",
      "/app/docu",
      "/app/docu/upload",
      "/app/sales",
      "/app/orderflow",
      "/app/serviceden",
      "/app/serviceden/invoices",
      "/app/serviceden/leads",
      "/app/serviceden/sales",
      "/app/serviceden/outreach",
    ];

for (const route of ROUTES) {
  try {
    await page.goto(`${base}${route}`, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2500));
    const file = `${out}/${route.replace(/^\/app\//, "").replace(/\//g, "-") || "root"}.png`;
    await page.screenshot({ path: file });
    console.log("wrote", file, "→", page.url());
  } catch (err) {
    console.log("fail", route, String(err).slice(0, 120));
  }
}
await browser.close();

/* Keyboard + console QA probe: tabs through a page, records the focus order
   and whether each stop has a visible outline, and collects console errors. */
import puppeteer from "puppeteer-core";

const url = process.argv[2] ?? "http://localhost:3000/";
const tabs = Number(process.argv[3] ?? 14);

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text().slice(0, 160));
});
page.on("pageerror", (err) => errors.push("pageerror: " + String(err).slice(0, 160)));
await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
await new Promise((r) => setTimeout(r, 2000));

const stops = [];
for (let i = 0; i < tabs; i += 1) {
  await page.keyboard.press("Tab");
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const style = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      text: (el.textContent ?? "").trim().slice(0, 34) || el.getAttribute("aria-label") || "",
      href: el.getAttribute("href") ?? undefined,
      outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
    };
  });
  stops.push(info);
}
console.log(JSON.stringify({ stops, errors }, null, 1));
await browser.close();

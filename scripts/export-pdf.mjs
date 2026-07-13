import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, "../public/exports/Chris-Rosenau-Resume.pdf");
const url = process.env.RESUME_URL || "http://localhost:3000/";

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  colorScheme: "dark",
});

// YouTube iframes keep network busy — skip them for PDF export
await page.route("**/*youtube.com/**", (route) => route.abort());
await page.route("**/*youtu.be/**", (route) => route.abort());
await page.route("**/*googlevideo.com/**", (route) => route.abort());

await page.emulateMedia({ media: "screen", colorScheme: "dark" });
await page.goto(url, { waitUntil: "load", timeout: 60000 });
await page.waitForTimeout(2000);

// Force site ink background for the PDF page box
await page.addStyleTag({
  content: `
    html, body {
      background: #071018 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  `,
});

const height = await page.evaluate(() =>
  Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
);

await page.pdf({
  path: out,
  printBackground: true,
  preferCSSPageSize: false,
  width: "1280px",
  height: `${Math.ceil(height)}px`,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});

await browser.close();
console.log("Wrote", out, "height", height);

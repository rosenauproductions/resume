// Regenerate the per-lens resume PDFs from the /print page.
//   npm run pdf                                   (needs `npm run dev` on :3000)
//   RESUME_URL=https://resume-rho-taupe.vercel.app npm run pdf   (from live, after reseed)
// Writes public/resume/Chris-Rosenau-Resume-{AI-Developer,Learning-Media,UI-Design}.pdf
// (names must match RESUME_PDF_PATHS in src/components/print/ResumeDocument.tsx).
import { chromium } from "playwright";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../public/resume");
const base = (process.env.RESUME_URL || "http://localhost:3000").replace(/\/$/, "");
const LENSES = [
  ["media", "Chris-Rosenau-Resume-Learning-Media.pdf"],
  ["ai", "Chris-Rosenau-Resume-AI-Developer.pdf"],
  ["ui", "Chris-Rosenau-Resume-UI-Design.pdf"],
];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [lens, file] of LENSES) {
  await page.goto(`${base}/print?lens=${lens}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.emulateMedia({ media: "print" });
  const out = path.join(outDir, file);
  await page.pdf({ path: out, format: "Letter", preferCSSPageSize: true, printBackground: true });
  console.log("wrote", path.relative(process.cwd(), out));
}
await browser.close();

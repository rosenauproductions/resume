/**
 * One-shot: update applications.location from a curated export.
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/update-locations.ts
 */
import { listApplications, updateApplication } from "../src/lib/db/applications";
import { dbConfigured } from "../src/lib/db";

type LocExport = { company: string; role: string; location: string };

const EXPORT: LocExport[] = [
  {
    company: "Lawrence Livermore National Laboratory",
    role: "Instructional Designer / Web-Based Training Developer",
    location: "Livermore, CA",
  },
  { company: "LMI", role: "Multimedia Developer", location: "Remote, US" },
  {
    company: "Chewy",
    role: "Instructional Designer",
    location: "Remote / Location-Restricted",
  },
  {
    company: "SRS Distribution",
    role: "Learning & Development Instructional Designer",
    location: "McKinney, TX",
  },
  {
    company: "Capital Title of Texas & Affiliates",
    role: "Instructional Designer",
    location: "Plano, TX",
  },
  {
    company: "Endurance Warranty Services",
    role: "Learning & Development Facilitator",
    location: "Remote, US",
  },
  {
    company: "ABC Legal",
    role: "Instructional Design / Learning Role",
    location: "Not specified",
  },
  {
    company: "CEC Companies",
    role: "Instructional Designer / Learning & Development",
    location: "Not specified",
  },
  { company: "KBS", role: "Instructional Designer", location: "Remote, US" },
  {
    company: "Sacred Heart Schools, Atherton",
    role: "Multimedia Content Producer",
    location: "Atherton, CA",
  },
  { company: "SAIC", role: "Multimedia Specialist", location: "Remote, NC" },
  {
    company: "JPMorgan Chase",
    role: "Leadership Learning Designer – Video & Digital Content",
    location: "Plano, TX",
  },
  { company: "Instructure", role: "Learning Consultant", location: "Remote, US" },
  { company: "Equinix", role: "Instructional Designer", location: "Dallas, TX" },
  { company: "AAA", role: "Instructional Designer", location: "Coppell, TX" },
  {
    company: "American Airlines",
    role: "Flight Service Training / Program Development",
    location: "Fort Worth, TX",
  },
  {
    company: "Hallmark Health Care Solutions",
    role: "Product Trainer – Physician Enterprise Implementation",
    location: "Dallas, TX",
  },
  {
    company: "Cogstate",
    role: "Associate, Instructional Design",
    location: "Remote, US",
  },
  { company: "ACU", role: "Instructional Design Specialist", location: "Remote, US" },
  {
    company: "Associa",
    role: "Instructional Designer #26380",
    location: "Not specified",
  },
  {
    company: "Internal Software Platform",
    role: "Instructional Designer",
    location: "Not specified",
  },
  {
    company: "Peyton Resource Group",
    role: "Instructional Designer",
    location: "Remote, US",
  },
  { company: "InStride Health", role: "LMS Coordinator", location: "Not specified" },
  { company: "McKesson", role: "Instructional Designer", location: "Not specified" },
  {
    company: "Acentra Health",
    role: "Instructional Design & Trainer, Associate",
    location: "Not specified",
  },
  { company: "Banner", role: "LMS Coordinator", location: "Not specified" },
  {
    company: "Harbor Freight Tools",
    role: "Instructional Designer",
    location: "Remote, US",
  },
  {
    company: "Creative Instructional Designer",
    role: "Instructional Designer",
    location: "Remote, US",
  },
  {
    company: "Gainwell",
    role: "Professional Instructional Designer",
    location: "Not specified",
  },
  {
    company: "Ryder",
    role: "Instructional Designer I",
    location: "Remote / Austin, TX",
  },
  { company: "Xyleme", role: "Instructional Designer", location: "Not specified" },
  { company: "Embry-Riddle", role: "Instructional Design", location: "Not specified" },
  { company: "Purple", role: "Multimedia Designer", location: "Not specified" },
  {
    company: "Vasculitis Foundation",
    role: "Multimedia Content Manager",
    location: "Not specified",
  },
  {
    company: "Transfr",
    role: "Professional Learning Facilitator",
    location: "Texas",
  },
];

/** Normalize company for fuzzy match. */
function normCompany(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function companyTokens(raw: string): string[] {
  const stop = new Set([
    "the",
    "and",
    "of",
    "inc",
    "llc",
    "ltd",
    "co",
    "company",
    "companies",
    "group",
    "national",
    "laboratory",
    "labs",
    "employer",
  ]);
  return normCompany(raw)
    .split(" ")
    .filter((t) => t.length > 1 && !stop.has(t));
}

/** Explicit aliases: export key → substrings that identify the DB company. */
const COMPANY_ALIASES: Record<string, string[]> = {
  "lawrence livermore national laboratory": [
    "lawrence livermore",
    "llnl",
  ],
  aaa: ["aaa", "american automobile"],
  "creative instructional designer": [
    "creative instructional designer",
  ],
  "sacred heart schools atherton": ["sacred heart"],
  "embry riddle": ["embry riddle"],
  "jpmorgan chase": ["jpmorgan", "jp morgan"],
  "american airlines": ["american airlines"],
  "capital title of texas and affiliates": ["capital title"],
  "srs distribution": ["srs distribution", "srs"],
  "hallmark health care solutions": ["hallmark"],
  "harbor freight tools": ["harbor freight"],
  "peyton resource group": ["peyton"],
  "endurance warranty services": ["endurance"],
  "internal software platform": ["internal software"],
  "vasculitis foundation": ["vasculitis"],
  "abc legal": ["abc legal"],
  "cec companies": ["cec"],
  "acu": ["acu", "abilene christian"],
};

function companiesMatch(exportCompany: string, dbCompany: string): boolean {
  const e = normCompany(exportCompany);
  const d = normCompany(dbCompany);
  if (!e || !d) return false;
  if (e === d) return true;
  if (d.includes(e) || e.includes(d)) return true;

  const aliases = COMPANY_ALIASES[e] ?? [];
  for (const a of aliases) {
    if (d.includes(a) || a.includes(d)) return true;
  }

  // Short codes (LMI, AAA, KBS, SAIC, ACU) — token equality
  const eTokens = companyTokens(exportCompany);
  const dTokens = companyTokens(dbCompany);
  if (eTokens.length === 1 && eTokens[0].length <= 5) {
    return dTokens.includes(eTokens[0]) || d.startsWith(eTokens[0] + " ");
  }

  // Overlap of significant tokens
  if (eTokens.length >= 2) {
    const overlap = eTokens.filter((t) => dTokens.includes(t) || d.includes(t));
    if (overlap.length >= Math.min(2, eTokens.length)) return true;
  }

  return false;
}

function normRole(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[–—-]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roleScore(exportRole: string, dbTitle: string): number {
  const e = normRole(exportRole);
  const d = normRole(dbTitle);
  if (!e || !d) return 0;
  if (e === d) return 100;
  if (d.includes(e) || e.includes(d)) return 80;
  const eWords = new Set(e.split(" ").filter((w) => w.length > 2));
  const dWords = d.split(" ").filter((w) => w.length > 2);
  let hit = 0;
  for (const w of dWords) if (eWords.has(w)) hit += 1;
  if (!eWords.size) return 0;
  return Math.round((hit / eWords.size) * 60);
}

function normalizeLocation(loc: string): string {
  const t = (loc || "").trim();
  if (!t || /^not\s+specified$/i.test(t)) return "";
  return t;
}

function employmentHint(location: string): string | undefined {
  const n = location.toLowerCase();
  if (!n) return undefined;
  if (n.includes("remote") && (n.includes("austin") || n.includes("hybrid"))) {
    return "Remote / Hybrid";
  }
  if (n.startsWith("remote") || n.includes("remote,") || n.includes("remote /")) {
    return "Remote";
  }
  return undefined;
}

async function main() {
  if (!dbConfigured()) {
    throw new Error("DATABASE_URL missing — check .env.local");
  }

  const apps = await listApplications();
  console.log(`Loaded ${apps.length} applications from DB`);

  const usedExport = new Set<number>();
  const usedApp = new Set<string>();
  const updates: {
    id: string;
    company: string;
    title: string;
    from: string;
    to: string;
    exportCompany: string;
  }[] = [];
  const unmatchedExport: LocExport[] = [];

  // Prefer best company+role match; company is primary when roles differ
  for (let ei = 0; ei < EXPORT.length; ei++) {
    const exp = EXPORT[ei];
    const candidates = apps
      .map((app, ai) => ({
        app,
        ai,
        cMatch: companiesMatch(exp.company, app.company),
        rScore: roleScore(exp.role, app.title),
      }))
      .filter((c) => c.cMatch && !usedApp.has(c.app.id));

    if (!candidates.length) {
      unmatchedExport.push(exp);
      continue;
    }

    candidates.sort((a, b) => b.rScore - a.rScore);
    const best = candidates[0];
    usedExport.add(ei);
    usedApp.add(best.app.id);

    const to = normalizeLocation(exp.location);
    const from = best.app.location || "";
    if (from === to) {
      console.log(
        `SKIP (same) ${best.app.company} | ${best.app.title} → "${to || "(empty)"}"`,
      );
      continue;
    }

    updates.push({
      id: best.app.id,
      company: best.app.company,
      title: best.app.title,
      from,
      to,
      exportCompany: exp.company,
    });
  }

  let updated = 0;
  for (const u of updates) {
    const partial: { location: string; employmentType?: string } = {
      location: u.to,
    };
    const hint = employmentHint(u.to);
    const app = apps.find((a) => a.id === u.id);
    if (hint && app && !app.employmentType) {
      partial.employmentType = hint;
    }
    await updateApplication(u.id, partial);
    updated += 1;
    console.log(
      `UPDATED ${u.company} | ${u.title}\n  "${u.from || "(empty)"}" → "${u.to || "(empty)"}" (export: ${u.exportCompany})`,
    );
  }

  // DB companies with no export match (informational)
  const unmatchedDb = apps
    .filter((a) => !usedApp.has(a.id))
    .map((a) => `${a.company} | ${a.title} | loc="${a.location || ""}"`);

  console.log("\n=== SUMMARY ===");
  console.log(`Rows updated: ${updated}`);
  console.log(`Export entries matched (incl. same-location skips): ${usedExport.size}`);
  console.log(`Export unmatched: ${unmatchedExport.length}`);
  if (unmatchedExport.length) {
    for (const e of unmatchedExport) {
      console.log(`  - ${e.company} | ${e.role}`);
    }
  }
  console.log(`DB apps without export match: ${unmatchedDb.length}`);
  for (const line of unmatchedDb) {
    console.log(`  - ${line}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

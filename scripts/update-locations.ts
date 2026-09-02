/**
 * One-shot: update applications.location (+ remote employmentType / notes)
 * from curated HQ vs job-location export.
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/update-locations.ts
 */
import { listApplications, updateApplication } from "../src/lib/db/applications";
import { dbConfigured } from "../src/lib/db";
import { normalizeWorkType } from "../src/lib/jobs/types";

type LocExport = {
  company: string;
  role: string;
  /** Clean City, ST (or Remote, US) for geocode */
  location: string;
  /** Ensure employmentType parses as remote (green fill at HQ pin) */
  remote?: boolean;
  /** Append to notes if missing */
  note?: string;
};

/**
 * Policy:
 * - Job location → City, ST (onsite/hybrid pin)
 * - Company HQ + remote job → City, ST + remote employmentType (green at HQ)
 * - Pure remote, no useful city → Remote, US (Mexico cluster)
 */
const EXPORT: LocExport[] = [
  { company: "AAA", role: "Instructional Designer", location: "Coppell, TX" },
  {
    company: "ABC Legal",
    role: "Instructional Design",
    location: "Seattle, WA",
    remote: true,
  },
  {
    company: "Acentra Health",
    role: "Instructional Design",
    location: "McLean, VA",
    remote: true,
  },
  {
    company: "ACU",
    role: "Instructional Design Specialist",
    location: "Abilene, TX",
    remote: true,
  },
  {
    company: "American Airlines",
    role: "Flight Service Training",
    location: "Fort Worth, TX",
  },
  {
    company: "Ashby",
    role: "Customer Education Program Manager",
    location: "San Francisco, CA",
    remote: true,
  },
  {
    company: "Associa",
    role: "Instructional Designer",
    location: "Richardson, TX",
  },
  {
    company: "Banner",
    role: "LMS Coordinator",
    location: "Phoenix, AZ",
    remote: true,
  },
  {
    company: "Baylor College of Medicine",
    role: "Instructional Technology Associate",
    location: "Houston, TX",
  },
  {
    company: "CEC Companies",
    role: "Instructional Designer",
    location: "Moon Township, PA",
    remote: true,
  },
  {
    company: "Capital Title of Texas & Affiliates",
    role: "Instructional Designer",
    location: "Plano, TX",
  },
  {
    company: "Chewy",
    role: "Instructional Designer",
    location: "Richardson, TX",
  },
  {
    company: "Cogstate",
    role: "Associate, Instructional Design",
    location: "Remote, US",
    remote: true,
    note: "HQ Melbourne, Australia — US Albers map uses Remote, US cluster.",
  },
  {
    company: "Creative Instructional Designer",
    role: "Instructional Designer",
    location: "Middleton, WI",
    remote: true,
  },
  {
    company: "Embry-Riddle",
    role: "Instructional Design",
    location: "Daytona Beach, FL",
    remote: true,
  },
  {
    company: "Endurance Warranty Services",
    role: "Learning & Development Facilitator",
    location: "Northbrook, IL",
    remote: true,
  },
  {
    company: "Equinix",
    role: "Instructional Designer",
    location: "Dallas, TX",
  },
  {
    company: "Gainwell",
    role: "Professional Instructional Designer",
    location: "Dallas, TX",
    remote: true,
  },
  {
    company: "Hallmark Health Care Solutions",
    role: "Product Trainer",
    location: "Dallas, TX",
  },
  {
    company: "Harbor Freight Tools",
    role: "Instructional Designer",
    location: "Calabasas, CA",
    remote: true,
  },
  {
    company: "InStride Health",
    role: "LMS Coordinator",
    location: "Boston, MA",
    remote: true,
  },
  {
    company: "Instructure",
    role: "Learning Consultant",
    location: "Salt Lake City, UT",
    remote: true,
  },
  {
    company: "Internal Software Platform",
    role: "Instructional Designer",
    location: "Middleton, WI",
    remote: true,
  },
  {
    company: "JPMorgan Chase",
    role: "Leadership Learning Designer",
    location: "Plano, TX",
  },
  {
    company: "KBS",
    role: "Instructional Designer",
    location: "Remote, US",
    remote: true,
  },
  {
    company: "LMI",
    role: "Multimedia Developer",
    location: "Remote, US",
    remote: true,
  },
  {
    company: "Lawrence Livermore National Laboratory",
    role: "Instructional Designer",
    location: "Livermore, CA",
  },
  {
    company: "McKesson",
    role: "Instructional Designer",
    location: "Fort Worth, TX",
  },
  {
    company: "Peyton Resource Group",
    role: "Instructional Designer",
    location: "Irving, TX",
    remote: true,
  },
  {
    company: "Purple",
    role: "Multimedia Designer",
    location: "Lehi, UT",
    remote: true,
  },
  {
    company: "Sacred Heart Schools, Atherton",
    role: "Multimedia Content Producer",
    location: "Atherton, CA",
  },
  {
    company: "SAIC",
    role: "Multimedia Specialist",
    location: "Raleigh, NC",
    remote: true,
  },
  {
    company: "SRS Distribution",
    role: "Learning & Development Instructional Designer",
    location: "McKinney, TX",
  },
  {
    company: "Vasculitis Foundation",
    role: "Multimedia Content Manager",
    location: "Kansas City, MO",
  },
  {
    company: "Xyleme",
    role: "Instructional Designer",
    location: "New Brunswick, NJ",
  },
];

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

const COMPANY_ALIASES: Record<string, string[]> = {
  "lawrence livermore national laboratory": ["lawrence livermore", "llnl"],
  aaa: ["aaa", "american automobile"],
  "creative instructional designer": ["creative instructional designer"],
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
  acu: ["acu", "abilene christian"],
  ashby: ["ashby"],
  associa: ["associa"],
  chewy: ["chewy"],
  "acentra health": ["acentra"],
  gainwell: ["gainwell"],
  "instride health": ["instride"],
  "baylor college of medicine": ["baylor"],
  banner: ["banner"],
  purple: ["purple"],
  saic: ["saic"],
  xyleme: ["xyleme"],
  mckesson: ["mckesson"],
  cogstate: ["cogstate"],
  instructure: ["instructure"],
  kbs: ["kbs"],
  lmi: ["lmi"],
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

  const eTokens = companyTokens(exportCompany);
  const dTokens = companyTokens(dbCompany);
  if (eTokens.length === 1 && eTokens[0].length <= 5) {
    return dTokens.includes(eTokens[0]) || d.startsWith(eTokens[0] + " ");
  }

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

function ensureRemoteEmployment(existing: string): string {
  if (normalizeWorkType(existing) === "remote") return existing;
  const t = (existing || "").trim();
  if (!t) return "Remote";
  if (/\bremote\b/i.test(t)) return t;
  return `${t} · Remote`;
}

function appendNote(existing: string, note: string): string {
  const e = (existing || "").trim();
  if (!note) return e;
  if (e.toLowerCase().includes(note.toLowerCase().slice(0, 40))) return e;
  return e ? `${e}\n${note}` : note;
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
    fromLoc: string;
    toLoc: string;
    fromEmp: string;
    toEmp: string | undefined;
    toNotes: string | undefined;
    exportCompany: string;
  }[] = [];
  const unmatchedExport: LocExport[] = [];

  for (let ei = 0; ei < EXPORT.length; ei++) {
    const exp = EXPORT[ei];
    const candidates = apps
      .map((app) => ({
        app,
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

    const toLoc = exp.location.trim();
    const toEmp = exp.remote
      ? ensureRemoteEmployment(best.app.employmentType)
      : undefined;
    const toNotes = exp.note
      ? appendNote(best.app.notes, exp.note)
      : undefined;

    const locSame = (best.app.location || "") === toLoc;
    const empSame = !toEmp || best.app.employmentType === toEmp;
    const notesSame = !toNotes || best.app.notes === toNotes;

    if (locSame && empSame && notesSame) {
      console.log(
        `SKIP (same) ${best.app.company} | ${best.app.title} → "${toLoc}"`,
      );
      continue;
    }

    updates.push({
      id: best.app.id,
      company: best.app.company,
      title: best.app.title,
      fromLoc: best.app.location || "",
      toLoc,
      fromEmp: best.app.employmentType || "",
      toEmp: empSame ? undefined : toEmp,
      toNotes: notesSame ? undefined : toNotes,
      exportCompany: exp.company,
    });
  }

  let updated = 0;
  for (const u of updates) {
    const partial: {
      location: string;
      employmentType?: string;
      notes?: string;
    } = { location: u.toLoc };
    if (u.toEmp !== undefined) partial.employmentType = u.toEmp;
    if (u.toNotes !== undefined) partial.notes = u.toNotes;

    await updateApplication(u.id, partial);
    updated += 1;
    const empBit =
      u.toEmp !== undefined
        ? ` | emp "${u.fromEmp || "(empty)"}" → "${u.toEmp}"`
        : "";
    const noteBit = u.toNotes !== undefined ? " | notes+" : "";
    console.log(
      `UPDATED ${u.company} | ${u.title}\n  loc "${u.fromLoc || "(empty)"}" → "${u.toLoc}"${empBit}${noteBit} (export: ${u.exportCompany})`,
    );
  }

  const unmatchedDb = apps
    .filter((a) => !usedApp.has(a.id))
    .map((a) => `${a.company} | ${a.title} | loc="${a.location || ""}"`);

  console.log("\n=== SUMMARY ===");
  console.log(`Rows updated: ${updated}`);
  console.log(
    `Export entries matched (incl. same-location skips): ${usedExport.size}`,
  );
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

/**
 * Import historical resume visits parsed from ntfy screenshots into Neon.
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/import-ntfy-visits.ts
 *
 * Dedupes against existing rows (occurred_at ±30s + city + screen [+ timezone if set]).
 * Reuses suggestAssociation; Livermore + smartrecruiters → LLNL; Hallmark override when flagged.
 */
import { and, gte, lte, sql } from "drizzle-orm";
import { dbConfigured, getDb } from "../src/lib/db";
import { appendApplicationNote, listApplications } from "../src/lib/db/applications";
import { visits } from "../src/lib/db/schema";
import { suggestAssociation, type LinkConfidence } from "../src/lib/db/visits";
import { extractCityKey, lookupCity } from "../src/lib/pipeline/geo-cities";

type SeedVisit = {
  /** Local America/Chicago wall time: YYYY-MM-DD HH:mm */
  whenCt: string;
  city: string;
  region: string;
  country: string;
  device: string;
  path?: string;
  timezone?: string;
  language?: string;
  screen: string;
  referrer?: string;
  /** Force link to Hallmark when screenshot showed Suggested Hallmark */
  forceHallmark?: boolean;
};

/**
 * Curated from IMG_6950–6973 ntfy screenshots (exact When/Where/Device/Screen/TZ/From).
 * Near-dupes with distinct timezone/device/screen kept as separate rows.
 */
const SEED: SeedVisit[] = [
  // IMG_6952 / 6953
  {
    whenCt: "2026-07-31 17:04",
    city: "Washington",
    region: "VA",
    country: "US",
    device: "Windows",
    timezone: "America/Los_Angeles",
    language: "en-US",
    screen: "1920×1080",
  },
  {
    whenCt: "2026-07-31 17:05",
    city: "Washington",
    region: "VA",
    country: "US",
    device: "Windows",
    timezone: "America/Los_Angeles",
    language: "en-US",
    screen: "1920×1080",
  },
  // IMG_6953 / 6954
  {
    whenCt: "2026-08-02 16:24",
    city: "Plano",
    region: "TX",
    country: "US",
    device: "iOS",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "390×844",
  },
  {
    whenCt: "2026-08-02 16:28",
    city: "Plano",
    region: "TX",
    country: "US",
    device: "iOS",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "390×844",
  },
  {
    whenCt: "2026-08-02 17:45",
    city: "Bethesda",
    region: "MD",
    country: "US",
    device: "Windows",
    timezone: "America/New_York",
    language: "en-US",
    screen: "1536×864",
  },
  // IMG_6955
  {
    whenCt: "2026-08-05 15:31",
    city: "Des Moines",
    region: "IA",
    country: "US",
    device: "Windows",
    timezone: "America/Los_Angeles",
    language: "en-US",
    screen: "1920×1080",
  },
  {
    whenCt: "2026-08-05 18:03",
    city: "Nevada",
    region: "TX",
    country: "US",
    device: "Windows",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "1920×1080",
  },
  // IMG_6956
  {
    whenCt: "2026-08-06 18:12",
    city: "New York",
    region: "NY",
    country: "US",
    device: "Windows",
    timezone: "UTC",
    language: "en-US@posix",
    screen: "1600×1200",
  },
  {
    whenCt: "2026-08-06 19:10",
    city: "Bethesda",
    region: "MD",
    country: "US",
    device: "Windows",
    timezone: "America/New_York",
    language: "en-US",
    screen: "1536×864",
  },
  // IMG_6957–6960 (Aug 10–11 DFW cluster)
  {
    whenCt: "2026-08-10 20:43",
    city: "Wylie",
    region: "TX",
    country: "US",
    device: "iOS",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "440×956",
  },
  {
    whenCt: "2026-08-10 20:57",
    city: "Wylie",
    region: "TX",
    country: "US",
    device: "iOS",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "393×852",
  },
  {
    whenCt: "2026-08-10 20:59",
    city: "Wylie",
    region: "TX",
    country: "US",
    device: "iOS",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "393×852",
  },
  {
    whenCt: "2026-08-10 21:00",
    city: "Dallas",
    region: "TX",
    country: "US",
    device: "iOS",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "414×896",
  },
  {
    whenCt: "2026-08-10 21:00",
    city: "Wylie",
    region: "TX",
    country: "US",
    device: "iOS",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "393×852",
  },
  {
    whenCt: "2026-08-10 21:36",
    city: "Dallas",
    region: "TX",
    country: "US",
    device: "iOS",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "414×896",
  },
  {
    whenCt: "2026-08-11 08:11",
    city: "Dallas",
    region: "TX",
    country: "US",
    device: "iOS",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "393×852",
  },
  {
    whenCt: "2026-08-11 08:18",
    city: "Wylie",
    region: "TX",
    country: "US",
    device: "iOS",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "440×956",
  },
  {
    whenCt: "2026-08-11 09:09",
    city: "Dallas",
    region: "TX",
    country: "US",
    device: "iOS",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "393×852",
  },
  {
    whenCt: "2026-08-11 09:10",
    city: "Dallas",
    region: "TX",
    country: "US",
    device: "iOS",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "393×852",
  },
  {
    whenCt: "2026-08-11 09:59",
    city: "Irving",
    region: "TX",
    country: "US",
    device: "iOS",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "440×956",
  },
  {
    whenCt: "2026-08-11 10:52",
    city: "Irving",
    region: "TX",
    country: "US",
    device: "iOS",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "440×956",
  },
  // IMG_6966
  {
    whenCt: "2026-08-13 20:01",
    city: "San Jose",
    region: "CA",
    country: "US",
    device: "Windows",
    timezone: "UTC",
    language: "en-US@posix",
    screen: "1600×1200",
  },
  {
    whenCt: "2026-08-14 08:26",
    city: "Boydton",
    region: "VA",
    country: "US",
    device: "Windows",
    timezone: "America/Los_Angeles",
    language: "en-US",
    screen: "1920×1080",
  },
  // IMG_6967 / 6968
  {
    whenCt: "2026-08-18 15:11",
    city: "Jacksonville",
    region: "FL",
    country: "US",
    device: "Windows",
    timezone: "America/New_York",
    language: "en-US",
    screen: "1536×864",
  },
  {
    whenCt: "2026-08-19 07:02",
    city: "",
    region: "",
    country: "US",
    device: "Desktop / other",
    timezone: "America/Los_Angeles",
    language: "en-US",
    screen: "1024×1024",
  },
  {
    whenCt: "2026-08-19 07:02",
    city: "",
    region: "",
    country: "US",
    device: "Android",
    timezone: "America/Los_Angeles",
    language: "en-US",
    screen: "412×732",
  },
  {
    whenCt: "2026-08-28 12:31",
    city: "Anaheim",
    region: "CA",
    country: "US",
    device: "iOS",
    timezone: "America/Los_Angeles",
    language: "en-US",
    screen: "440×956",
  },
  // IMG_6969–6971
  {
    whenCt: "2026-08-31 14:09",
    city: "Wylie",
    region: "TX",
    country: "US",
    device: "Mac",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "1512×982",
  },
  {
    whenCt: "2026-08-31 14:51",
    city: "Livermore",
    region: "CA",
    country: "US",
    device: "Windows",
    timezone: "America/Los_Angeles",
    language: "en-US",
    screen: "1707×960",
    referrer: "https://www.smartrecruiters.com/",
  },
  {
    whenCt: "2026-08-31 14:52",
    city: "Council Bluffs",
    region: "IA",
    country: "US",
    device: "Windows",
    timezone: "UTC",
    language: "en-US",
    screen: "800×600",
  },
  {
    whenCt: "2026-08-31 14:52",
    city: "Council Bluffs",
    region: "IA",
    country: "US",
    device: "Windows",
    timezone: "Etc/Unknown",
    language: "en-US",
    screen: "800×600",
  },
  {
    whenCt: "2026-08-31 17:22",
    city: "Tampa",
    region: "FL",
    country: "US",
    device: "Windows",
    timezone: "America/New_York",
    language: "en-US",
    screen: "5120×1440",
  },
  {
    whenCt: "2026-08-31 18:33",
    city: "Queens",
    region: "NY",
    country: "US",
    device: "Mac",
    timezone: "America/Chicago",
    language: "en-US",
    screen: "1920×1080",
  },
  // IMG_6972 / 6950
  {
    whenCt: "2026-09-01 11:52",
    city: "Livermore",
    region: "CA",
    country: "US",
    device: "Windows",
    timezone: "America/Los_Angeles",
    language: "en-US",
    screen: "1707×960",
    referrer: "https://www.smartrecruiters.com/",
  },
  {
    whenCt: "2026-09-01 18:02",
    city: "Council Bluffs",
    region: "IA",
    country: "US",
    device: "Windows",
    timezone: "Etc/Unknown",
    language: "en-US",
    screen: "800×600",
  },
  {
    whenCt: "2026-09-02 11:55",
    city: "Livermore",
    region: "CA",
    country: "US",
    device: "Windows",
    timezone: "America/Los_Angeles",
    language: "en-US",
    screen: "1536×960",
    referrer: "https://www.smartrecruiters.com/",
  },
  // IMG_6973 Dallas Mac Suggested Hallmark — When scrolled off; skip inventing time.
  // Live Neon visit should already exist if recorded after visit persistence shipped.
];

/** Parse America/Chicago wall clock → Date (UTC instant). */
function centralToUtc(whenCt: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(whenCt.trim());
  if (!m) throw new Error(`Bad whenCt: ${whenCt}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  // CDT (UTC-5) is correct for Jul–Sep; iterate to be DST-safe.
  let utcMs = Date.UTC(y, mo - 1, d, h + 5, mi, 0);
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(utcMs))
        .filter((p) => p.type !== "literal")
        .map((p) => [p.type, p.value]),
    ) as Record<string, string>;
    const asLocal = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour === "24" ? "0" : parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const wanted = Date.UTC(y, mo - 1, d, h, mi, 0);
    utcMs += wanted - asLocal;
  }
  return new Date(utcMs);
}

function locationLabel(city: string, region: string, country: string) {
  return [city, region, country].filter(Boolean).join(", ") || "Unknown location";
}

function visitNoteLine(occurredAt: Date, label: string, suggested: boolean) {
  const when = occurredAt.toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `Resume view ${when} CT · ${label}${suggested ? " (suggested)" : ""}`;
}

function normScreen(s: string) {
  return (s || "").replace(/[x×]/gi, "x").toLowerCase();
}

function normCity(s: string) {
  return (s || "").trim().toLowerCase();
}

async function findExistingNear(
  occurredAt: Date,
  city: string,
  screen: string,
  timezone: string,
): Promise<boolean> {
  const db = getDb();
  // ±30s catches re-import / clock skew without collapsing distinct ntfy pings 1 min apart
  const lo = new Date(occurredAt.getTime() - 30_000);
  const hi = new Date(occurredAt.getTime() + 30_000);
  const rows = await db
    .select({
      city: visits.city,
      screen: visits.screen,
      timezone: visits.timezone,
      occurredAt: visits.occurredAt,
    })
    .from(visits)
    .where(and(gte(visits.occurredAt, lo), lte(visits.occurredAt, hi)));

  const c = normCity(city);
  const scr = normScreen(screen);
  const tz = (timezone || "").trim().toLowerCase();
  return rows.some((r) => {
    if (normCity(r.city) !== c || normScreen(r.screen) !== scr) return false;
    // Allow distinct ntfy near-dupes that only differ by Visitor TZ
    const rTz = (r.timezone || "").trim().toLowerCase();
    if (tz && rTz && tz !== rTz) return false;
    return true;
  });
}

async function resolveHallmarkId(): Promise<string | null> {
  const apps = await listApplications();
  const hits = apps.filter((a) => a.company.toLowerCase().includes("hallmark"));
  return hits.length === 1 ? hits[0].id : hits[0]?.id ?? null;
}

async function resolveLlnlId(): Promise<string | null> {
  const apps = await listApplications();
  const hits = apps.filter((a) => {
    const c = a.company.toLowerCase();
    return c.includes("lawrence livermore") || c.includes("llnl");
  });
  return hits.length >= 1 ? hits[0].id : null;
}

async function main() {
  if (!dbConfigured()) {
    throw new Error("DATABASE_URL missing — run vercel env pull / check .env.local");
  }

  const hallmarkId = await resolveHallmarkId();
  const llnlId = await resolveLlnlId();
  const db = getDb();

  let inserted = 0;
  let skippedDup = 0;
  let linked = 0;
  let cityOnly = 0;
  const unmatchedCities = new Set<string>();

  for (const seed of SEED) {
    const occurredAt = centralToUtc(seed.whenCt);
    const path = seed.path || "/";
    const referrer = seed.referrer || "";
    const city = seed.city || "";
    const region = seed.region || "";
    const country = seed.country || "";
    const screen = seed.screen || "";

    if (await findExistingNear(occurredAt, city, screen, seed.timezone || "")) {
      skippedDup += 1;
      continue;
    }

    let applicationId: string | null = null;
    let confidence: LinkConfidence = "none";
    let reason = "";

    const isLivermoreSmart =
      city.toLowerCase() === "livermore" &&
      /smartrecruiters/i.test(referrer);

    if (seed.forceHallmark && hallmarkId) {
      applicationId = hallmarkId;
      confidence = "suggested";
      reason = "location contains city: dallas → Hallmark Health Care Solutions";
    } else if (isLivermoreSmart && llnlId) {
      applicationId = llnlId;
      confidence = "suggested";
      reason = "smartrecruiters referrer + city alias: livermore → LLNL";
    } else {
      const suggestion = await suggestAssociation({ path, city });
      applicationId = suggestion.applicationId;
      confidence = suggestion.confidence;
      reason = suggestion.reason;
    }

    const insertedRows = await db
      .insert(visits)
      .values({
        occurredAt,
        path,
        city,
        region,
        country,
        device: seed.device || "",
        referrer,
        timezone: seed.timezone || "",
        language: seed.language || "",
        screen,
        sessionFingerprint: "ntfy-import",
        linkedApplicationId: applicationId,
        linkConfidence: confidence,
        linkReason: reason,
      })
      .returning();

    inserted += 1;
    const row = insertedRows[0];
    if (applicationId && confidence === "suggested") {
      linked += 1;
      await appendApplicationNote(
        applicationId,
        visitNoteLine(occurredAt, locationLabel(city, region, country), true),
      );
    } else {
      cityOnly += 1;
    }

    const label = locationLabel(city, region, country);
    const geoKey = extractCityKey(label) || extractCityKey(city);
    if (city || region) {
      if (!geoKey || !lookupCity(geoKey)) {
        unmatchedCities.add(label || city || "(empty)");
      }
    }

    console.log(
      `${confidence === "suggested" ? "LINK" : "CITY"} ${seed.whenCt} CT · ${label} · ${seed.device} · ${screen}` +
        (reason ? ` · ${reason}` : ""),
    );
    void row;
  }

  const total = await db.select({ n: sql<number>`count(*)::int` }).from(visits);

  console.log("\n--- import summary ---");
  console.log(`seed rows:        ${SEED.length}`);
  console.log(`inserted:         ${inserted}`);
  console.log(`skipped (dup):    ${skippedDup}`);
  console.log(`linked to job:    ${linked}`);
  console.log(`city-only:        ${cityOnly}`);
  console.log(
    `unmatched cities: ${
      unmatchedCities.size ? [...unmatchedCities].join("; ") : "(none)"
    }`,
  );
  console.log(`visits in db:     ${total[0]?.n ?? "?"}`);
  console.log(
    "note: Sep 2 Dallas Mac (Suggested Hallmark) omitted — When not visible in IMG_6973; likely already live-recorded.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * One-shot: import bundled tracker seed into Neon.
 * Usage: npx dotenv -e .env.local -- npx tsx scripts/seed-db.ts
 */
import { replaceAllApplications, countApplications } from "../src/lib/db/applications";
import { loadSeedJobs } from "../src/lib/jobs/seed";
import { dbConfigured } from "../src/lib/db";

async function main() {
  if (!dbConfigured()) {
    throw new Error("DATABASE_URL missing — run vercel env pull first");
  }
  const jobs = loadSeedJobs();
  const count = await replaceAllApplications(jobs);
  const total = await countApplications();
  console.log(`Seeded ${count} applications (db count=${total})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

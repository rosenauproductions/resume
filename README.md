# Chris Rosenau — Resume Site

Animated personal resume / portfolio site built with Next.js, Tailwind, and Motion. Deployed on Vercel.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Edit content

All copy lives in one place:

- [`src/content/resume.ts`](src/content/resume.ts) — name, about, experience, skills, work slots, contact

## Add images

1. Put files in [`public/images/`](public/images/)
2. Update paths / set `placeholder: false` in `src/content/resume.ts`

## Private job pipeline (`/pipeline`)

Password-gated tracker. **Neon Postgres** is the source of truth for applications + visit logs. **ntfy** still sends phone pings (dual-track).

### Neon

Provisioned as Vercel Marketplace resource `resume-pipeline-db`. Pull env locally:

```bash
npx vercel env pull .env.local --yes --scope rosenau-productions
npm run db:push   # after schema changes
```

Seed / re-seed from bundled JSON:

```bash
npx dotenv -e .env.local -- npx tsx scripts/seed-db.ts
```

In `/pipeline`: badge shows **Neon DB**. Use **Import Drive → DB** or **Import bundled** to load applications. **Visits** tab lists geo visits with Confirm / Ignore / Link. **Target map** pins jobs by `location` (curated city lookup); pure Remote listings stay unplaced.

### ChatGPT / Drive export

When re-exporting `job-tracker.json` for Drive, every application should include location from the posting only (never invent):

- `location` — `"City, ST"` (e.g. `"Plano, TX"`) or `"Remote"`
- `location_city` / `location_state` / `location_country` — optional structured parts
- `work_type` — `remote` | `hybrid` | `onsite` when the posting says so
- `employment_type` — Full-time / Part-time / 1099 (separate from `work_type`)

Copy the in-app prompt on `/pipeline` for the full export instructions.

### Env vars

```
JOB_TRACKER_SECRET=
DATABASE_URL=
VISIT_NOTIFY_NTFY_TOPIC=
VISIT_NOTIFY_NTFY_TOKEN=
VISIT_IGNORE_DEVICE_IDS=
JOB_TRACKER_DRIVE_FILE_ID=
```

`VISIT_IGNORE_DEVICE_IDS` is a comma-separated list of stable browser device IDs (not MACs — browsers cannot expose those). Matching visits skip ntfy/Discord but are still stored in Neon with reason `device ignore list`. Copy your ID from `/pipeline` → **Visits**.

## Deploy to Vercel

```bash
npx vercel --prod --scope rosenau-productions
```

Or connect GitHub — pushes to `main` deploy automatically.

## Visit notifications

ntfy/Discord pings still fire on resume opens (unless the device ID is in `VISIT_IGNORE_DEVICE_IDS`, or the path is `/pipeline`). The same request also writes a detailed row to Neon for `/pipeline` → Visits (city matching can suggest a job; status never auto-changes).

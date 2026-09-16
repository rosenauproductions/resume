# HANDOFF — Resume Site & Pipeline

Living status doc for this repo. Read this first in any new session before
touching code — it's the running memory that survives chat compaction.
**Update it whenever a task finishes or a decision gets made.** Keep entries
short; link to files/commits instead of re-explaining code.

Repo: `~/Documents/GitHub/resume` (local Mac path) · deployed on Vercel ·
live at https://resume-rho-taupe.vercel.app/

---

## Architecture quick reference

- **Dual "lens" resume**: `/` = AI lens (default), `/?lens=media` = Media/ID
  lens. Content model is `ResumeDocument v2` with `lenses.ai` / `lenses.media`.
- **Stack**: Next.js 16 App Router (has breaking changes vs. training data —
  read `node_modules/next/dist/docs` before writing App Router code),
  Vercel hosting, Neon Postgres + Drizzle ORM, Vercel AI Gateway for chat.
- **Contact form flow**: `Contact.tsx` → `POST /api/visit/identify` →
  `saveVisitorIdentification()` (`src/lib/db/visitor-identify.ts`) → creates
  or links a pipeline "website lead" application → fires
  `notifyVisitChannels()` (`src/lib/visit-notify.ts`) for
  Discord/ntfy/email. Notification `kind` values:
  `"visit" | "visit_ai" | "pipeline" | "identify" | "lead"` — email only
  fires on `kind === "lead"`.
- **Pipeline admin**: password-gated `/pipeline` (cookie session via
  `POST /api/pipeline/login`, password stored only in the trigger prompt —
  see below). Full CRUD at `/api/pipeline/jobs` (GET/POST/PUT/DELETE).
  **GOTCHA**: `PUT /api/pipeline/jobs` with `{job: {...}}` runs the body
  through `normalizeJob()` (`src/lib/jobs/types.ts` ~line 594), which
  returns a COMPLETE object — any field you omit gets defaulted/blanked.
  Always GET the full job, modify only the target field(s) in memory, PUT
  the whole object back. Never send a partial job object.
- **GoodWork**: a sub-project referenced in resume builds/role-fit/chat
  prompts (see commit `b509fa4`) — not yet documented in depth here; check
  that commit and surrounding files if it comes up. **Pending deletion** —
  Chris mentioned deleting the `goodwork` Vercel project; not yet actioned,
  needs his explicit go-ahead first (it's permanent).
- **Email-sync bot mailbox**: a Gmail draft ("🗒️ Email Assistant Log — DO
  NOT SEND", draftId `r-2547586641898269704`) is a shared, append-only
  notes channel between Chris/Claude and the hourly bot. Write a
  `[REQUEST]` entry to ask the bot to do something extra on its next run;
  it replies with `[DONE]`/`[BLOCKED]` and a `[RUN]` summary every time it
  fires. Read with Gmail `get_draft`, write with `update_draft` (full-body
  replace — always append to the existing text, never overwrite history).

- **Push notification addon**: Web Push (VAPID) support so the hourly bot
  can alert Chris's phone directly, not just via email/mailbox. New DB
  table `push_subscriptions` (`src/lib/db/schema.ts`). Client opt-in lives
  on the password-gated `/pipeline` page
  (`src/components/pipeline/PushNotifications.tsx`) — add the site to
  your phone's homescreen (`public/manifest.json`, `public/sw.js`,
  `public/icon-192.png` / `icon-512.png`), then hit "Enable
  notifications" there. Server side: `src/lib/push/subscriptions.ts` (DB
  CRUD), `src/lib/push/send.ts` (sends via `web-push`, auto-prunes dead
  subscriptions on 404/410). Two API routes, both gated by the same
  `requirePipelineAuth()` as the jobs API: `POST /api/push/subscribe`
  (browser calls this after granting permission), `POST /api/push/send`
  (bot/anyone with the pipeline cookie calls this — body
  `{title, body, url?}` — to push a notification to every enabled
  device). VAPID keys are in `.env.local` — **still need to be added to
  Vercel's env vars for production**, see status log below. Full API
  contract for the bot: `claude/notify-bot-handoff.md` in the claude.ai
  project.

Key files:
| Area | File |
|---|---|
| Contact form UI | `src/components/Contact.tsx` |
| Lead creation + notify dispatch | `src/lib/db/visitor-identify.ts` |
| Notification channels (Discord/ntfy/email) | `src/lib/visit-notify.ts` |
| Pipeline env-status pills | `src/lib/db/settings.ts`, `src/components/pipeline/PipelineSettings.tsx` |
| Pipeline job normalization | `src/lib/jobs/types.ts` |
| Pipeline API | `src/app/api/pipeline/jobs/route.ts` |
| Pipeline auth | `src/lib/jobs/auth.ts`, `src/lib/jobs/require-auth.ts` |

---

## Status log (most recent first)

### 2026-09-16 — Push notification addon built (Web Push / VAPID)
Added a full Web Push pipeline so the hourly email bot (or Chris/Claude
manually) can push a notification straight to Chris's phone, not just
leave a summary in Gmail — add the site to the homescreen from
`/pipeline`, enable notifications, and any `POST /api/push/send` call
(same pipeline-cookie auth as the jobs API) shows up as a real push
notification; tapping it opens `/pipeline`. New `push_subscriptions` DB
table (created directly via SQL, not `drizzle-kit push` — see gotcha
below). VAPID keypair generated and in `.env.local`; **still needs to be
added to Vercel's project env vars (Production + Preview) before it
works on the live site** — Chris has the exact values. Not yet
committed/pushed (bundling with the other pending local changes below).
See `claude/notify-bot-handoff.md` in the claude.ai project for the API
contract to hand the bot.

### 2026-09-15 — CONFIRMED: pipeline access fix verified end-to-end
Re-fired the hourly bot twice after the domain-allowlist fix to verify it,
not just interactive sessions. First re-fire (19:43) failed fast (~7s)
before writing to the mailbox — looks like an unrelated transient session
error, not a network block. The very next fire (20:44, ~31s, full run)
succeeded cleanly: pipeline login/GET worked via plain curl, pulled all 56
pipeline entries, checked them against the run's job-related threads with
no errors. Both interactive/cloud-sandbox access and the scheduled bot's
own access are now confirmed working end-to-end. If a future run hits the
old `403`/`connect_rejected` error, treat it as transient and retry once
before re-escalating.

### 2026-09-15 — RESOLVED: Claude's network egress was blocking the pipeline domain account-wide
Root cause: the Claude account's Capabilities → Domain allowlist was set to
"Package managers only," so every outbound call from any Claude session
(interactive or scheduled) to `resume-rho-taupe.vercel.app` was rejected at
Claude's own proxy (`403 blocked-by-allowlist` / `CONNECT tunnel failed`) —
it never reached Vercel at all. This was NOT a Vercel-side issue and NOT a
credentials problem. Fixed by adding domains at
**claude.ai → Settings → Capabilities → Domain allowlist → Additional
allowed domains**. Now allowlisted: `resume-rho-taupe.vercel.app`,
`familyflow.ashurose.com`, `skycal.hybridinstruction.com`,
`family-wall-calendar.vercel.app`, `www.ashurose.com`, `ashurose.com`,
`ashurose.vercel.app`, `hinterviewer-x.vercel.app`,
`family-feud-9paz.onrender.com`, `the-1-percent-club.onrender.com`
(everything except `goodwork`, pending deletion). Verified working again
via direct curl and by re-firing the hourly bot. **Takeaway: any new
personal domain needs to be added here before Claude sessions can reach
it** — otherwise it looks like a server-side rejection but isn't. The
`/pipeline` web UI stayed reachable the whole time via browser automation
(built-in browser / Claude in Chrome), since that runs on the real network
rather than through Claude's egress proxy — useful fallback for one-off
edits when a new domain isn't allowlisted yet.

### 2026-09-15 — Email-sync bot built and hardened
Hourly scheduled task (Claude Code Remote trigger, id
`trig_01EZhmemyygQVqgRcCBRgV8q`, cron `43 * * * *`, Gmail-connected,
push+email notifications on) reads new inbox mail, summarizes it, drafts
Gmail replies (never sends), and cross-references job-related mail against
`/api/pipeline/jobs` to auto-update status when confident. Also has the
shared-mailbox mechanism (see architecture section above).

**Bug found + fixed during verification**: first real test case (General
Assembly "phone screen availability" email) didn't get its pipeline status
updated, because the pipeline has *two* separate "General Assembly"
entries and the original prompt only matched by company name — it
silently gave up rather than guessing which one. Manually corrected that
entry (Applied → Screen, note added) and rewrote the trigger prompt to (a)
require matching by role/title too when a company has multiple entries,
(b) explicitly call out "needs manual check" in the summary instead of
silently skipping, (c) not treat "no draft created" for pure
scheduling-link emails as a failure (it's correct — nothing to draft).

Pipeline password used by the bot: `Onelove25($)` (also the `/pipeline`
UI login).

### 2026-09-15 — Email notifications on contact-form leads (Resend)
Investigated the contact form (`/` bottom form) — confirmed it works
correctly end-to-end, no bug, no lost submissions; the actual gap was "no
email notification channel existed." Added Resend-based email notify
(raw `fetch`, no new npm dependency) alongside existing
Discord/ntfy, firing only on `kind === "lead"`.

**Files changed, STILL UNCOMMITTED as of this writing** (local working
tree only — needs a decision from Chris on whether to commit/push):
- `src/lib/visit-notify.ts` — added `notifyEmail()` + `linesToHtml()`,
  wired into `notifyVisitChannels()`. Defaults: `emailTo`
  rosenauproductions@gmail.com, `emailFrom` "Resume Leads
  <onboarding@resend.dev>".
- `src/lib/db/settings.ts` — added `email` to `PipelineEnvStatus`.
- `src/components/pipeline/PipelineSettings.tsx` — added the "Email
  (Resend)" status pill.
- `.env.example` — documented `RESEND_API_KEY`,
  `VISIT_NOTIFY_EMAIL_TO`, `VISIT_NOTIFY_EMAIL_FROM`.

SMS/text notifications: decided to use **ntfy only**, not real SMS/Twilio
— simpler, no carrier gateway reliability issues.

**OPEN DECISION**: commit + push these changes, or keep iterating locally
first? Ask Chris if picking this back up.

### 2026-09-14/15 — Blended resume PDF
Built a custom HTML→PDF resume (Playwright/Chromium, not reportlab) that
blends the strongest framing from both the AI and Media lenses into one
document, with both portfolio links + GitHub
(https://github.com/rosenauproductions) in the sidebar. Sidebar background
now spans both PDF pages (CSS `position: fixed`) but its content
(photo/contact/portfolio/skills/certs/education) only renders on page 1
(CSS `position: absolute`, placed once in flow) — page 2 keeps the dark
sidebar color but no repeated content, with added top spacing so content
doesn't start too close to the page edge. This was a one-off deliverable
(sent via file, not committed to the repo) — the technique (fixed bg +
absolute content layering for print CSS) is worth remembering if the PDF
needs regenerating or a similar two-column print layout comes up
elsewhere.

---

## Conventions / gotchas (durable, not date-stamped)

- Next.js 16 has real breaking changes vs. training data — check
  `node_modules/next/dist/docs` before writing App Router code.
- Pipeline API PUT is whole-object replacement — see GOTCHA above. This
  has bitten both a human session and the automated email-sync bot; watch
  for it in any future pipeline-writing code or prompts.
- No push access to `rosenauproductions/resume` from the cloud sandbox
  (403 — not in the authorized repo set). Code changes to this repo get
  made locally on Chris's Mac via the device bridge, not from the cloud
  container.
- `device_bash` can't delete files in connected folders without an
  explicit `device_request_delete_permission` grant first.
- Any new personal domain (new Vercel/Render project, new custom domain)
  needs adding to claude.ai → Settings → Capabilities → Domain allowlist
  before Claude sessions can reach it, or expect a
  `403 blocked-by-allowlist` that looks like a server error but isn't.
- The Neon DB itself needs THREE hostnames on that same allowlist, not
  just the Vercel domain: the pooled host
  (`ep-*-pooler.c-10.us-east-1.aws.neon.tech`, from `DATABASE_URL`), the
  unpooled host (same minus `-pooler`), and a separate "data API" host
  Neon's JS driver derives by swapping the endpoint ID for `api.`
  (`api.c-10.us-east-1.aws.neon.tech`) — that third one isn't in any env
  var, it's constructed at runtime, easy to miss.
- `drizzle-kit push` hangs forever (not an error, just spins) when run
  from a Claude device_bash shell — its introspection step insists on a
  raw WebSocket connection, and Node's `fetch` (unlike `curl`) does NOT
  read `HTTPS_PROXY` automatically, so it tries a direct connection that
  never resolves through this environment's proxy. Workaround: skip
  drizzle-kit for one-off schema changes here — write the DDL by hand and
  run it with a plain Neon HTTP client script that explicitly wires up
  the proxy first: `require('undici').setGlobalDispatcher(new
  (require('undici').ProxyAgent)(process.env.HTTPS_PROXY))` before
  importing `@neondatabase/serverless`. Match existing column conventions
  (e.g. `gen_random_uuid()` default on uuid PKs) by querying
  `information_schema.columns` on a sibling table first.

# HANDOFF — Resume Site & Pipeline

Living status doc for this repo. Read this first in any new session before
touching code — it's the running memory that survives chat compaction.
**Update it whenever a task finishes or a decision gets made.** Keep entries
short; link to files/commits instead of re-explaining code.

Repo: `~/Documents/GitHub/resume` (local Mac path) · deployed on Vercel ·
live at https://resume-rho-taupe.vercel.app/

---

## Architecture quick reference

- **Triple "lens" resume**: `/` = AI lens (default), `/?lens=media` = Media/ID
  lens, `/?lens=ui` = UI/visual-design lens (added 2026-10-02). Content model
  is `ResumeDocument v2` with `lenses.ai` / `lenses.media` / `lenses.ui`, each
  a full `ResumeContent`. The UI lens is built by `buildUiResumeContent()` in
  `src/lib/resume/lens.ts` as a total content refocus of the media base (same
  pattern as `buildAiResumeContent()`) — positions Chris as a visual/UI
  design specialist who evaluates and directs design work (including
  AI-assisted output), not just produces it. Its flagship proof point is the
  "Light Cycle Arena" side project (an AI-agent-directed Tron-inspired game).
  All three lenses stay wired through `types.ts` (`RESUME_LENS_IDS`),
  `visit-lens.ts` (path/label/notify-title), `Nav.tsx` (`LensToggle`, now 3
  pills), `ChatWidget.tsx` + `system-prompt-ui.md` (lens-aware chat), and
  `ResumeEditor.tsx` (3-way CMS tab). When adding a 4th lens later, grep for
  `RESUME_LENS_IDS` usages and `(["ai","media"]`-style literals first.
- **Stack**: Next.js 16 App Router (has breaking changes vs. training data —
  read `node_modules/next/dist/docs` before writing App Router code),
  Vercel hosting, Neon Postgres + Drizzle ORM, Vercel AI Gateway for chat.
- **Contact form flow**: `Contact.tsx` → `POST /api/visit/identify` →
  `saveVisitorIdentification()` (`src/lib/db/visitor-identify.ts`) → creates
  or links a pipeline "website lead" application → fires
  `notifyVisitChannels()` (`src/lib/visit-notify.ts`) for
  Discord/ntfy/email. Notification `kind` values:
  `"visit" | "visit_ai" | "visit_ui" | "pipeline" | "identify" | "lead"` —
  email only fires on `kind === "lead"`.
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
  that commit and surrounding files if it comes up. The standalone
  `goodwork` Vercel project (`goodwork-two.vercel.app`) was **deleted
  2026-09-16** at Chris's request — it no longer exists.
- **Email-sync bot mailbox**: a Gmail draft ("🗒️ Email Assistant Log — DO
  NOT SEND", draftId `r-2547586641898269704`) is a shared, append-only
  notes channel between Chris/Claude and the hourly bot. Write a
  `[REQUEST]` entry to ask the bot to do something extra on its next run;
  it replies with `[DONE]`/`[BLOCKED]` and a `[RUN]` summary every time it
  fires. Read with Gmail `get_draft`, write with `update_draft` (full-body
  replace — always append to the existing text, never overwrite history).

- **Push notification addon — LIVE and verified end-to-end
  (2026-09-16)**: Web Push (VAPID) support so the hourly bot can alert
  Chris's phone directly, not just via email/mailbox. DB table
  `push_subscriptions` (`src/lib/db/schema.ts`). Client opt-in on the
  password-gated `/pipeline` page → Settings tab
  (`src/components/pipeline/PushNotifications.tsx`) — add the site to
  your phone's homescreen (`public/manifest.json`, `public/sw.js`,
  `public/icon-192.png` / `icon-512.png`), then "Enable notifications"
  there. Server side: `src/lib/push/subscriptions.ts` (DB CRUD),
  `src/lib/push/send.ts` (sends via `web-push`, auto-prunes dead
  subscriptions on 404/410). Two API routes, both gated by the same
  `requirePipelineAuth()` as the jobs API: `POST /api/push/subscribe`
  (browser calls this after granting permission), `POST /api/push/send`
  (bot/anyone with the pipeline cookie calls this — body
  `{title, body, url?}` — to push a notification to every enabled
  device). VAPID keys are set in Vercel (Production + Preview). STEP 4b
  in the hourly bot's trigger prompt calls this when something's worth
  an immediate alert. Full API contract: `claude/notify-bot-handoff.md`
  in the claude.ai project.
- **Pipeline Copilot (added 2026-09-24)**: `/pipeline` → Copilot tab
  (`src/components/pipeline/PipelineCopilot.tsx`). New `copilot_items` DB
  table (`src/lib/db/schema.ts`, helper `src/lib/db/copilot.ts`) is a
  unified feed of `kind: "flag"` rows (things the hourly bot noticed, one
  per email in the From Trisha / Job search / Boy Scouts / Events
  categories, plus one aggregate row per run for everything-else) and
  `kind: "request"` rows (instructions queued for the bot's next run,
  either typed in the copilot chat or a bot self-suggestion — currently
  `calendar_add` or `general`). API: `GET/POST /api/pipeline/copilot/items`,
  `PATCH /api/pipeline/copilot/items/[id]` (mark handled / done / blocked).
  The copilot chat itself is `POST /api/pipeline/copilot/chat` — a
  streaming `ai` SDK route (same Vercel AI Gateway pattern as the public
  resume chatbot) with a `queueRequest` tool the model calls only after
  Chris has clearly confirmed — never proactively. Push notifications
  (`src/lib/push/send.ts`, `/api/push/send`) now accept an optional
  `itemId`: when set, `public/sw.js` shows "Mark handled" / "View" action
  buttons on the notification itself (mark_handled PATCHes the item
  without opening the app — works because the service worker's fetch
  carries the httpOnly `pipeline_session` cookie automatically for
  same-origin requests, no extra auth wiring needed). The hourly bot's
  trigger prompt got a new **Step 0b** (checks
  `GET /api/pipeline/copilot/items?kind=request&status=pending`, creates
  Google Calendar events via its already-connected Calendar connector for
  `calendar_add` requests, then PATCHes each to done/blocked) and a new
  **Step 4b** (writes a flag row for every category item so the feed has
  something to show, before Step 4c sends the push).

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

**2026-10-09 — Media lens retargeted for AbbVie-style multimedia / learning-media roles.** Chris pasted a portfolio review (hiring manager: portfolio is the first screen; needs modern graphic design, QRGs/job aids, a polished AI software tutorial, a documented method, accessibility, one cohesive visual system). Done in code: `applyLearningMediaFocus()` in `src/lib/resume/lens.ts` (applied to Media only, after AI/UI are derived from the base) - title "Multimedia Learning Designer", new subtitle/tagline, section order hero > work > about > projects > experience > skills > fit > contact, Skills section enabled, "Expert" labels replaced ("Strong"/"Advanced"/"Proficient"), role-fit reordered with a new "Visual learning design" need first, MSC bullet for job aids (Chris: designs job aids per course material, inline in Rise or as PDF/PPT depending on training vs on-site use). Schema: `work.gallery` (WorkVisual items: image/alt/caption) and `work.study` (case study with steps/outcome), `WorkFeatured.tools`; normalizers in `defaults.ts`; CMS editor can edit all of them; `Gallery.tsx` renders featured videos > visual gallery > case study > cases; section kickers are now computed from visible order (`useSectionNumber`). Three demonstration pieces (quick reference guide, AI prompt recipe job aid, infographic; one visual system; footer reads "Sample" - Chris asked 2026-10-09 to drop the "fictional / demonstration" wording and will replace these with his own pieces later) live in `public/images/samples/`. First featured video is the Ednet intro (Chris: ~90% Synthesia + After Effects). **Bug found after deploy:** `Skills.tsx` imported skills/certifications/education from static `@/content/resume`, so every lens showed the same hard-coded skills and the CMS/lens skills data was ignored. Fixed to read `useResume()` (lens-specific skills now render on `/` and `/?lens=ui` too). `SkillsNetwork` (Network view) is still static. DB reset was run via `PUT /api/pipeline/resume {"reset":true}` after verifying no CMS drift (backup: scratchpad `stored-pre-reset.json`). **Needs Chris:** real screenshots/PDFs of his own job aids, PiStomp/StepBot screenshots, audience/results for the videos, and a check that the case-study wording is accurate. **Deploy note:** content lives in the DB, so after the push run the reset (CMS Reset button or `PUT /api/pipeline/resume {"reset": true}`). The AbbVie link must be `/?lens=media` (root `/` is the AI lens).

**2026-10-08 — Content "swap" check: DB already matches code (no reset needed).** Chris's Oct 7 commits (`ae84738`, `d4a06a4`) put ID Assist + "AI Learning Systems & Builds" into the code-defined AI lens, and after Grok's file-swap attempt he reported the DB was "taking over." Verified instead: a deep diff of `buildDefaultResumeDocument()` vs the live `site_settings.resume_content` row (via `GET /api/pipeline/resume`) showed **zero content differences** across media/ai/ui (only the randomly generated item ids differ) and live `/`, `/?lens=media`, `/?lens=ui` show the expected content. **How DB-vs-code works (durable gotcha):** `getResumeDocument()` returns the stored row if one exists (code defaults are only a fallback when there is no row); `repairAiLensContent` / `repairUiLensContent` only append missing projects/needs, they never overwrite stored text. So editing `lens.ts` / `resume.ts` does NOT change the live site by itself - re-seed with the Reset button in the CMS (or `PUT /api/pipeline/resume` with `{"reset": true}`, or `scripts/reset-resume-ai.ts`). A reset discards ALL CMS edits in all three lenses. `src/content/ai-learning-systems-content.ts` is not imported anywhere (dead file); its richer ID Assist / StepBot detail (tagline, role, tech, highlights, responsible-AI) is not rendered because project cards only have title/summary/tags/link.

### 2026-10-02 — UI lens refinement pass (UI/UX feedback)
Chris passed along UI/UX feedback on the new UI lens (headline casing, Higher
Ed Partners role title spacing, and — most substantively — promoting "Canvas
Visual UX Fixes" and "ProPricer Brand & Print" from `work.cases`-only into
full `sideProjects` cards, reordering Projects to lead with the strongest
UI/product work, dropping GoodWork from this lens's project list, adding a
new "LMS & Delivery UX" skills group, and retitling the top-skills sidebar
to Layout & Typography / Visual Hierarchy / CSS-iframe UX / AI Design
Critique / User Flow & Interfaces). All changes confined to
`buildUiResumeContent()` in `src/lib/resume/lens.ts` — no other files
touched. Verified with `tsc --noEmit` (clean), `eslint` (clean), and a
`tsx` round-trip checking every `roleFit` match's `projectId` still
resolves to a real project after the GoodWork removal (none broken).

### 2026-10-02 — Added a third "UI" resume lens
Chris wanted a toggle for a UI-designer-focused presentation, seeded from
resume feedback he got on a DataAnnotation "Mobile UI Designer" application
(a new visual-design-forward summary, 3 specific before/after bullet
rewrites for Medical Sales College / Higher Ed Partners / ProPricer, and
keywords: visual hierarchy, layout, typography, AI-assisted outputs, user
flow). He also had me add his "Light Cycle Arena" project (a Tron-inspired
game he directed two AI coding agents to build) as the flagship side
project for this lens — strong proof of directing + evaluating AI design
output, not just prompting.

Built `buildUiResumeContent()` in `src/lib/resume/lens.ts` (mirrors
`buildAiResumeContent()`'s total-refocus pattern: new theme `"slate"`,
summary/about, per-company experience rewrites, a `sideProjects` list led
by Light Cycle Arena, visual-design-focused `skills`, 7 `roleFit` needs,
and `work.cases`). Wired `"ui"` through: `types.ts` (`ResumeLensId`,
`RESUME_LENS_IDS`, `RESUME_LENS_LABELS`), `buildDefaultResumeDocument` /
`normalizeResumeDocument` (+ new `repairUiLensContent`) /
`commitLensEdit` in `lens.ts`, `visit-lens.ts` (path `/?lens=ui`, label,
notify title), `visit-notify.ts` (new `"visit_ui"` kind, violet color),
`api/visit/route.ts` (lens line + notify kind), `Nav.tsx` (3rd toggle pill,
violet active color, `LENS_HINT`), `Hero.tsx` (CTA text/href), `ChatWidget.tsx`
(3-way welcome/label text, `suggestLensFromText` UI cues, auto-switch),
`lens-intent.ts` (added `UI_CUES` regex, 3-way scoring), `ResumeEditor.tsx`
(3rd CMS tab), `PipelineApp.tsx` (visit badge, reset/save copy), and a new
`system-prompt-ui.md` for the on-site chat bot (`api/chat/route.ts` now
picks AI/Media/UI system prompt by `body.lens`).

Verified with `npx tsc --noEmit` (clean) and `npx eslint` (only
pre-existing, unrelated lint debt — confirmed via `git diff` that none of
the flagged lines were touched). Also round-trip tested
`buildDefaultResumeDocument()` → `normalizeResumeDocument()` →
`commitLensEdit()` → `materializeResume()` directly with `npx tsx` to
confirm the UI lens builds, survives a normalize round-trip, and
identity-syncs correctly across all three lenses.

Public URLs: `/` = AI, `/?lens=media` = Media, `/?lens=ui` = UI.

### 2026-09-24 — Built the pipeline Copilot (feed + chat + richer push)
Chris asked to enhance the pipeline into more of a copilot. Added: a
`copilot_items` DB table unifying bot-flagged items and queued requests;
a new Copilot tab on `/pipeline` with a category feed (mark handled) and
a chat box that can answer questions and queue instructions for the
hourly bot — including "add this to my calendar" (Chris confirmed he
wants the copilot to be conversational, still alert him proactively via
push, and be able to offer calendar adds); richer push notifications with
Mark handled / View action buttons wired to a specific feed item; and a
rewrite of the hourly bot's trigger prompt (new Step 0b resolves queued
copilot requests using its existing Google Calendar connector, new Step
4b writes a flag row per email so the feed has something to show). No new
env vars or OAuth needed — reused the bot's existing Gmail/Calendar/
pipeline connections and the site's existing AI Gateway wiring. `tsc
--noEmit` clean; eslint shows only pre-existing, already-deployed
`react-hooks/set-state-in-effect` findings unrelated to this change (same
pattern already lives in `PipelineChatTracker.tsx`).

### 2026-09-24 — Hourly bot expanded to full-inbox categorization
Chris asked for the bot to summarize all his email, not just job search,
organized around what matters to him. Rewrote the trigger prompt's
classification (categories: From Trisha, Job search, Boy Scouts, Events,
everything-else), push criteria (now covers Trisha/Scouts/Events too,
bundled into one push per run when multiple items are urgent), and
final-summary structure (organized under category headers). Prompt-only
change, effective immediately on the next hourly run.

### 2026-09-16 — Deleted the unused `goodwork` Vercel project
Chris confirmed the go-ahead ("delete `goodwork-two.vercel.app`"); deleted
via Vercel's dashboard (typed the two required confirmation strings —
project name and "delete my project" — and submitted). Verified: the
project no longer appears in the `rosenau-productions` team project list.
Closes out the last item from the push-notification build's task backlog.

### 2026-09-16 — Push notification addon fully verified end-to-end
Chris added the four VAPID env vars to Vercel, Claude committed + pushed
the code (commit `3cdeb7b`), Vercel deployed clean, Chris added the site
to his phone's homescreen and enabled notifications, and a real test push
(`POST /api/push/send`, sent directly from Claude) landed on his phone —
confirmed working. STEP 4b (push-on-something-worth-knowing) is now
wired into the live hourly bot trigger, not just documented. Walked
through one confirmed step at a time (env vars → deploy → homescreen/
enable → test push) per Chris's request to get explicit go/no-go on each
step rather than batching them.

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
(everything except `goodwork`, which has since been deleted). Verified working again
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
- Vercel's deployments list page defaults to whatever filter chips were
  last clicked (e.g. a stale "Status: Error" filter can hide the
  deployment you're actually looking for) — clear/toggle filter chips
  before concluding a deploy is missing or failed.
- The device_bash shell has no stored git credentials of its own
  (isolated VM, separate from Chris's Mac keychain) — `git push` from
  there fails with "could not read Username". `git commit` works fine
  (just needs `git config user.name`/`user.email` set once per repo,
  matching Chris's usual GitHub identity — check another of his repos'
  commit history via the GitHub API if unsure). For the actual push,
  hand it to Chris to run from his real Mac Terminal.
- Chris wants outstanding action items handed to him **one at a time**,
  waiting for his confirmation (or a reported issue) before giving the
  next one — not a batched list. Use the TaskCreate/TaskUpdate task list
  to track the full backlog, but only surface one item at a time in chat.
- Vercel's "Delete Project" confirmation dialog needs both fields typed
  *exactly*: the project name, then the literal phrase "delete my
  project" in the field mislabeled "Verification Code" (not an emailed
  code). A mismatched/stale value shows a red "does not match" alert
  under each field and the submit silently no-ops — re-check both fields
  (`form_input` is more reliable than coordinate-click-and-type when the
  browser pane is hidden) before clicking submit again.
- Push notification action buttons (Mark handled / View) work without any
  extra auth plumbing: a service worker's `fetch()` sends same-origin
  cookies by default, so `public/sw.js`'s `notificationclick` handler can
  PATCH `/api/pipeline/copilot/items/[id]` even though the app tab isn't
  open — it rides on whatever `pipeline_session` cookie is already in the
  browser (14-day TTL). If that cookie has expired, the mark_handled tap
  silently no-ops (caught, not surfaced) — the item just stays pending in
  the feed until Chris re-logs into `/pipeline`.
- The copilot chat's `queueRequest` tool is confirmation-gated by its
  system prompt only (it's told to never call the tool until Chris has
  clearly said yes), not by a separate UI confirm step — keep that in
  mind if the model ever seems to queue something too eagerly; tightening
  the system prompt is the fix, not adding new plumbing.

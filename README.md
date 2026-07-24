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

## Deploy to Vercel

```bash
npx vercel
```

Or connect the GitHub repo in the Vercel dashboard — every push to `main` deploys automatically.

## Visit notifications

Get a ping (with approximate location + time) when someone opens the site.

1. Create a **Discord webhook** (Server → Integrations → Webhooks → New Webhook → Copy URL), and/or
2. Install the free **[ntfy](https://ntfy.sh)** app and subscribe to a private topic (e.g. `chris-resume-visits-xyz123`).

Add either or both in Vercel → Project → Settings → Environment Variables:

```
VISIT_NOTIFY_DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
VISIT_NOTIFY_NTFY_TOPIC=your-private-topic
```

Redeploy after saving. Notifications fire once per browser session (not on every refresh).

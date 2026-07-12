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

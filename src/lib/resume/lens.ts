import { buildDefaultResumeContent, normalizeResumeContent } from "./defaults";
import {
  isResumeLensId,
  newId,
  type ResumeContent,
  type ResumeDocument,
  type ResumeLensId,
  type SideProject,
} from "./types";

const SHARED_SITE_KEYS = [
  "name",
  "location",
  "email",
  "phone",
  "phoneHref",
  "linkedin",
  "linkedinLabel",
] as const;

/** Copy identity + portraits from one variant onto another. */
export function syncSharedIdentity(from: ResumeContent, to: ResumeContent): ResumeContent {
  const site = { ...to.site };
  for (const key of SHARED_SITE_KEYS) {
    site[key] = from.site[key];
  }
  return {
    ...to,
    site,
    portraits: { ...from.portraits },
  };
}

export function resolveLens(raw: string | string[] | undefined | null): ResumeLensId {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return isResumeLensId(v) ? v : "media";
}

export function materializeResume(doc: ResumeDocument, lens: ResumeLensId): ResumeContent {
  return normalizeResumeContent(doc.lenses[lens]);
}

/** Build the AI lens as a total refocus of the media resume. */
export function buildAiResumeContent(mediaBase?: ResumeContent): ResumeContent {
  const media = normalizeResumeContent(mediaBase ?? buildDefaultResumeContent());
  const ai = structuredClone(media) as ResumeContent;

  ai.theme = "ocean";
  ai.site = {
    ...ai.site,
    title: "Learning Systems & AI Builder",
    subtitle: "TypeScript · LLMs · Canvas · LMS platforms",
    tagline:
      "I ship learning platforms and AI-assisted tools — Canvas/AWS delivery, LLM production workflows, and product-grade TypeScript apps — not just slide decks.",
  };

  ai.about = {
    heading: "About",
    lead: "LMS platform engineering, AI-assisted production, and shipped software — bots, PWAs, and this resume stack.",
    paragraphs: [
      "At Higher Ed Partners I treated Canvas as a delivery platform: AWS-hosted Rise content, CSS that fixed iframe UX, and a JavaScript language-embed layer so learners could switch languages inside the LMS. That stack — Canvas, AWS, CSS, and JS — is the systems work I want hiring teams to see first.",
      "At Medical Sales College I ran Canvas administration with custom programming, and accelerated production with LLM workflows (Claude, ChatGPT, Grok) for scripting and iteration. Synthesia avatar systems at HEP scaled AI video without traditional film cycles.",
      "Independently I build TypeScript and JavaScript products: StepBot (Canvas help bot), Pistomp-Mobile (PWA), multiplayer party games, Hinterviewer, lobe (macOS proximity radar), and this Next.js resume + Pipeline app with visit tracking, job linking, and an on-site AI chat. I’m open to roles in learning systems, AI-assisted product work, LMS engineering, and hands-on web development.",
    ],
  };

  ai.sectionOrder = [
    "hero",
    "about",
    "projects",
    "skills",
    "fit",
    "experience",
    "work",
    "contact",
  ];
  ai.sections = {
    ...ai.sections,
    work: { enabled: false, navLabel: "" },
    skills: { enabled: true, navLabel: "" },
    projects: { enabled: true, navLabel: "Builds" },
    fit: { enabled: true, navLabel: "" },
  };

  // Experience: AI/code bullets first; trim pure-media noise on ProPricer / Concordia
  ai.experience = ai.experience.map((job) => {
    const company = job.company.toLowerCase();
    if (company.includes("higher ed")) {
      return {
        ...job,
        role: "Multimedia Director & LMS Platform Design",
        highlights: [
          "Shipped a JavaScript language-embed / translation layer in Canvas so learners could view Rise content in their preferred language",
          "Enabled remote Rise updates via AWS hosting inside Canvas — CSS for iframe UX and delivery without repeated master-course propagations",
          "Built Synthesia avatar-video templates that replaced slow traditional filming and scaled AI video across courses",
          "Mapped delivery workflows across Canvas, AWS, and media teams to tighten handoffs",
        ],
      };
    }
    if (company.includes("medical sales")) {
      return {
        ...job,
        highlights: [
          "Accelerated production with LLM workflows (Claude, ChatGPT, Grok) for scripting, iteration, and polish",
          "Owned Canvas LMS operations: troubleshooting, custom programming, and instructor support",
          "Led hybrid migration with Rise/Storyline modules plus Canvas administration and custom enhancements",
          "Produced scenario and training video when the learning system needed it — secondary to platform work",
        ],
      };
    }
    if (company.includes("icode") || company.includes("intuit")) {
      return {
        ...job,
        highlights: [
          "Built Storyline templates and multimedia web modules with interactive objects for LMS delivery",
          "Drove course development end to end with ADDIE — scope, timelines, and stakeholder alignment",
          "Partnered with SMEs on videos, graphics, CBT modules, and storyboards",
        ],
      };
    }
    if (company.includes("propricer")) {
      return {
        ...job,
        enabled: true,
        highlights: [
          "Owned media projects end to end for two decades — foundation for systems thinking and delivery discipline",
          "Shipped training video and interactive media for digital distribution",
        ],
      };
    }
    if (company.includes("concordia")) {
      return {
        ...job,
        highlights: [
          "Assembled Storyline courses with Q&A, flow control, and assessment results",
          "Built animated course graphics and a 9-week series with custom character rigging",
        ],
      };
    }
    return job;
  });

  const projects: SideProject[] = [
    {
      id: newId("proj"),
      enabled: true,
      title: "Resume site + Pipeline",
      summary:
        "This site: Next.js/TypeScript resume with dual Media/AI lenses, Neon-backed job pipeline, visit tracking, visitor identify/link, JD ingest, and an on-site AI chat via Vercel AI Gateway.",
      href: "https://github.com/rosenauproductions/resume",
      linkLabel: "GitHub",
      tags: ["Next.js", "TypeScript", "AI chat", "Neon"],
    },
    {
      id: newId("proj"),
      enabled: true,
      title: "StepBot — Canvas LMS help bot",
      summary:
        "Embeddable Canvas help bot with multi-step guided answers, session memory, admin/creator tooling, and theming. Built for easy content management and multi-site deployment.",
      href: "https://github.com/rosenauproductions/StepBot-MSC",
      linkLabel: "GitHub",
      tags: ["Canvas", "JavaScript", "LMS", "Bot"],
    },
    {
      id: newId("proj"),
      enabled: true,
      title: "Pistomp-Mobile",
      summary:
        "Mobile-first TypeScript + Vite PWA for the open-source Pi-Stomp multi-effects platform — pedalboard control, A/B snapshots, and per-effect params over the MOD-UI API.",
      href: "https://github.com/rosenauproductions/Pistomp-Mobile",
      linkLabel: "GitHub",
      tags: ["TypeScript", "PWA", "Raspberry Pi"],
    },
    {
      id: newId("proj"),
      enabled: true,
      title: "Hinterviewer-X",
      summary:
        "Multi-client video resume portal (TypeScript) — public mirror for hiring workflows and client video delivery.",
      href: "https://github.com/rosenauproductions/Hinterviewer-X",
      linkLabel: "GitHub",
      tags: ["TypeScript", "Video", "Portal"],
    },
    {
      id: newId("proj"),
      enabled: true,
      title: "lobe",
      summary:
        "macOS Wi‑Fi/Bluetooth proximity radar with directional lobe calibration — map your antenna, find the signal.",
      href: "https://github.com/rosenauproductions/lobe",
      linkLabel: "GitHub",
      tags: ["macOS", "Hardware", "Swift/JS"],
    },
    {
      id: newId("proj"),
      enabled: true,
      title: "Party games — Family Feud & The 1% Club",
      summary:
        "Browser party games with projector/TV display, host controller, and phone contestant clients — real-time multi-device UI.",
      href: "https://github.com/rosenauproductions/family-feud",
      linkLabel: "GitHub",
      tags: ["JavaScript", "Multiplayer", "Realtime UI"],
    },
  ];

  ai.sideProjects = {
    heading: "Shipped builds",
    note: "Coding and AI-assisted products — LMS bots, PWAs, portals, and this pipeline. (BPMon and experiment toys omitted.)",
    projects,
  };

  ai.skills = {
    heading: "Skills & stack",
    top: ["TypeScript", "Canvas LMS", "LLM workflows", "Systems delivery"],
    groups: [
      {
        id: newId("sg"),
        enabled: true,
        label: "Programming",
        items: ["TypeScript", "JavaScript", "CSS / HTML", "Next.js", "Vite / PWA"],
      },
      {
        id: newId("sg"),
        enabled: true,
        label: "LMS platform",
        items: ["Canvas administration", "AWS-hosted Rise", "JS language embed", "CSS iframe UX"],
      },
      {
        id: newId("sg"),
        enabled: true,
        label: "AI",
        items: ["Claude / ChatGPT / Grok", "Synthesia", "AI chat / agents", "LLM production workflows"],
      },
      {
        id: newId("sg"),
        enabled: true,
        label: "Learning media (secondary)",
        items: ["Articulate Rise", "Storyline", "Vyond", "Premiere"],
      },
    ],
    also: {
      label: "Also in the toolbox",
      note: "Hardware-adjacent and studio experiments that keep systems skills sharp.",
      items: ["Raspberry Pi / MOD", "Canvas embedding", "Multi-device UI", "Neon / Postgres"],
    },
    meters: [
      { id: newId("meter"), enabled: true, name: "JavaScript / TypeScript / web", proficiency: "Advanced", width: 82 },
      { id: newId("meter"), enabled: true, name: "Canvas LMS + AWS delivery", proficiency: "Advanced", width: 85 },
      { id: newId("meter"), enabled: true, name: "AI tooling & LLM workflows", proficiency: "Advanced", width: 88 },
      { id: newId("meter"), enabled: true, name: "Synthesia AI video systems", proficiency: "Expert", width: 90 },
      { id: newId("meter"), enabled: true, name: "Articulate Rise & Storyline", proficiency: "Expert", width: 92 },
      { id: newId("meter"), enabled: true, name: "Next.js product / pipeline apps", proficiency: "Advanced", width: 78 },
    ],
  };

  const byTitle = (t: string) => projects.find((p) => p.title === t);

  ai.roleFit = {
    heading: "Role fit",
    note: "Select what you’re hiring for — mapped to LMS platform, AI, and shipped code.",
    needs: [
      {
        id: "lms-platform",
        enabled: true,
        label: "Canvas / LMS engineering",
        strength: "Advanced",
        summary: "Canvas as a delivery platform — AWS hosting, CSS/JS embeds, admin, and help bots.",
        matches: [
          {
            role: "Multimedia Director & LMS Platform Design",
            company: "Higher Ed Partners",
            proof: "AWS Rise hosting, CSS iframe UX, and JS language-embed in Canvas.",
          },
          {
            role: "Instructional Design Specialist (Media)",
            company: "Medical Sales College",
            proof: "Canvas admin, custom programming, and instructor support.",
          },
          {
            role: "StepBot — Canvas LMS help bot",
            company: "Side project",
            proof: "Embeddable Canvas help bot with guided flows and multi-site admin.",
            projectId: byTitle("StepBot — Canvas LMS help bot")?.id,
          },
        ],
      },
      {
        id: "ai-dev",
        enabled: true,
        label: "AI development / LLM workflows",
        strength: "Advanced",
        summary: "Day-to-day LLM production, AI video systems, and on-site AI product features.",
        matches: [
          {
            role: "Instructional Design Specialist (Media)",
            company: "Medical Sales College",
            proof: "Claude, ChatGPT, and Grok in production scripting and iteration.",
          },
          {
            role: "Multimedia Director & LMS Platform Design",
            company: "Higher Ed Partners",
            proof: "Synthesia avatar systems for scaled AI video.",
          },
          {
            role: "Resume site + Pipeline",
            company: "Side project",
            proof: "On-site AI chat, JD ingest, and visit→job linking on Neon/Next.js.",
            projectId: byTitle("Resume site + Pipeline")?.id,
          },
        ],
      },
      {
        id: "programming",
        enabled: true,
        label: "Programming / web product",
        strength: "Advanced",
        summary: "TypeScript/JS products — PWAs, multiplayer UI, portals, and full resume apps.",
        matches: [
          {
            role: "Pistomp-Mobile",
            company: "Side project",
            proof: "TypeScript + Vite PWA for Pi-Stomp control over MOD-UI.",
            projectId: byTitle("Pistomp-Mobile")?.id,
          },
          {
            role: "Resume site + Pipeline",
            company: "Side project",
            proof: "Next.js resume + job tracker with real visitor and chat systems.",
            projectId: byTitle("Resume site + Pipeline")?.id,
          },
          {
            role: "Party games — Family Feud & The 1% Club",
            company: "Side project",
            proof: "Projector + host + phone controllers — realtime multi-device UI.",
            projectId: byTitle("Party games — Family Feud & The 1% Club")?.id,
          },
          {
            role: "lobe",
            company: "Side project",
            proof: "macOS proximity radar with directional calibration.",
            projectId: byTitle("lobe")?.id,
          },
        ],
      },
      {
        id: "ai-video",
        enabled: true,
        label: "AI video / Synthesia",
        strength: "Expert",
        summary: "Template-driven AI video systems that replace slow film cycles at course scale.",
        matches: [
          {
            role: "Multimedia Director & LMS Platform Design",
            company: "Higher Ed Partners",
            proof: "Pioneered Synthesia avatar templates across courses.",
          },
        ],
      },
    ],
  };

  // Keep media work cases lightly available if re-enabled later; disable featured noise
  ai.work = {
    ...ai.work,
    heading: "Selected systems work",
    note: "LMS platform and AI delivery highlights — gallery media lives on the Media lens.",
    featured: ai.work.featured.map((f) => ({ ...f, enabled: false })),
    cases: [
      {
        id: newId("case"),
        enabled: true,
        title: "Canvas language embed + AWS Rise",
        detail:
          "JavaScript translation layer in Canvas, AWS-hosted Rise, and CSS iframe UX so learners get multilingual delivery without master-course churn.",
        tag: "LMS platform",
      },
      {
        id: newId("case"),
        enabled: true,
        title: "Synthesia AI video systems",
        detail: "Avatar templates that replaced traditional filming and scaled updates across courses.",
        tag: "AI video",
      },
      {
        id: newId("case"),
        enabled: true,
        title: "LLM production workflows",
        detail: "Claude, ChatGPT, and Grok wired into scripting and iteration at Medical Sales College.",
        tag: "AI workflows",
      },
    ],
  };

  return normalizeResumeContent(ai);
}

export function buildDefaultResumeDocument(): ResumeDocument {
  const media = buildDefaultResumeContent();
  const ai = syncSharedIdentity(media, buildAiResumeContent(media));
  return { version: 2, lenses: { media, ai } };
}

export function normalizeResumeDocument(raw: unknown): ResumeDocument {
  const fallback = buildDefaultResumeDocument();
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;

  // v2 document
  if (o.version === 2 && o.lenses && typeof o.lenses === "object") {
    const lenses = o.lenses as Record<string, unknown>;
    const media = normalizeResumeContent(lenses.media ?? fallback.lenses.media);
    let ai = normalizeResumeContent(lenses.ai ?? fallback.lenses.ai);
    // If AI looks like an empty/identical stub missing AI title, reseed once
    if (!lenses.ai || (ai.site.title === media.site.title && ai.theme === media.theme)) {
      // Only reseed when ai payload missing; if present and intentionally similar, keep
      if (!lenses.ai) {
        ai = syncSharedIdentity(media, buildAiResumeContent(media));
      }
    }
    ai = syncSharedIdentity(media, ai);
    return { version: 2, lenses: { media, ai } };
  }

  // v1 flat ResumeContent → dual document
  const media = normalizeResumeContent(raw);
  const ai = syncSharedIdentity(media, buildAiResumeContent(media));
  return { version: 2, lenses: { media, ai } };
}

/** After editing one lens, keep contact/portraits aligned across both. */
export function commitLensEdit(
  doc: ResumeDocument,
  lens: ResumeLensId,
  next: ResumeContent,
): ResumeDocument {
  const normalized = normalizeResumeContent(next);
  if (lens === "media") {
    return {
      version: 2,
      lenses: {
        media: normalized,
        ai: syncSharedIdentity(normalized, doc.lenses.ai),
      },
    };
  }
  // AI edit: shared identity still owned by media for consistency, unless user edited AI contact —
  // prefer media as source of truth for identity; pull AI title/tagline from edited AI.
  const media = syncSharedIdentity(normalized, doc.lenses.media);
  // If they changed contact on AI view, push to media
  const mediaSynced = {
    ...media,
    site: {
      ...media.site,
      name: normalized.site.name,
      location: normalized.site.location,
      email: normalized.site.email,
      phone: normalized.site.phone,
      phoneHref: normalized.site.phoneHref,
      linkedin: normalized.site.linkedin,
      linkedinLabel: normalized.site.linkedinLabel,
    },
    portraits: { ...normalized.portraits },
  };
  return {
    version: 2,
    lenses: {
      media: mediaSynced,
      ai: syncSharedIdentity(mediaSynced, normalized),
    },
  };
}

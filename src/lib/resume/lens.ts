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
  return isResumeLensId(v) ? v : "ai";
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
      "I design and ship AI-powered learning systems. ID Assist is a local instructional-design compiler that turns a brief into a pedagogy-gated outline (Bloom’s alignment + cost), then a live AI tutor grounded in the lesson content. StepBot is an embeddable Canvas help bot with multi-step guidance and session memory.",
      "At Higher Ed Partners I treated Canvas as a delivery platform: AWS-hosted Rise content, CSS that fixed iframe UX, and a JavaScript language-embed layer so learners could switch languages inside the LMS. At Medical Sales College I ran Canvas administration with custom programming and accelerated production with LLM workflows (Claude, ChatGPT, Grok).",
      "Independently I build TypeScript and JavaScript products: ID Assist, StepBot, GoodWork, Pistomp-Mobile, multiplayer party games, Hinterviewer, lobe, and this Next.js resume + Pipeline app. I’m open to roles as an AI Learning Architect, learning systems builder, LMS engineer, and hands-on web developer.",
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
      title: "ID Assist — Instructional Design Compiler + Live Tutor",
      summary:
        "Local-first instructional-design compiler: brief → Bloom’s-gated outline + cost → human approval → artifacts + live AI tutor grounded in the lesson. Adaptive SME interview, Ollama local mode, Electron desktop app. Solo-built architecture, prompt systems, and pedagogy rules.",
      href: "https://id-assist.vercel.app",
      linkLabel: "Live demo",
      tags: ["AI Learning", "Prompt Engineering", "Local LLM", "Instructional Design"],
    },
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
      title: "GoodWork",
      summary:
        "TypeScript + React + Vite app for a church youth service exchange — job requests, volunteer assignment, parent approval flow, family profiles, and fundraising milestones toward community goals. Demo: goodwork-two.vercel.app",
      href: "https://github.com/rosenauproductions/goodwork",
      linkLabel: "GitHub",
      tags: ["TypeScript", "React", "Vite", "Product UI"],
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
    heading: "AI Learning Systems & Builds",
    note: "Flagship AI learning tools first, then LMS bots, PWAs, and product apps.",
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
    note: "Select what you’re hiring for — AI/systems first, plus instructional design and media craft.",
    needs: [
      {
        id: "ai-learning-architect",
        enabled: true,
        label: "AI Learning Architect / Learning Systems",
        strength: "Advanced → Expert",
        summary: "Hands-on builder of AI-powered instructional tools, adaptive pathways, LMS integrations, and human-in-the-loop learning systems.",
        matches: [
          {
            role: "ID Assist",
            company: "Independent",
            proof: "Full instructional-design compiler + live AI tutor with Bloom’s gates, local LLM, and human approval workflow.",
            projectId: byTitle("ID Assist — Instructional Design Compiler + Live Tutor")?.id,
          },
          {
            role: "StepBot — Canvas LMS help bot",
            company: "Independent",
            proof: "Embeddable multi-step help system with session memory and zero-code admin tooling for Canvas.",
            projectId: byTitle("StepBot — Canvas LMS help bot")?.id,
          },
          {
            role: "Instructional Design Specialist (Media)",
            company: "Medical Sales College",
            proof: "LLM-accelerated production workflows + Canvas platform ownership.",
          },
        ],
      },
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
            role: "GoodWork",
            company: "Side project",
            proof:
              "React/TypeScript service-exchange UI — jobs, parent approval, volunteers, and fundraising progress.",
            projectId: byTitle("GoodWork")?.id,
          },
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
          {
            role: "Instructional Design Specialist (Media)",
            company: "Medical Sales College",
            proof: "AI-assisted learning video production with Claude, ChatGPT, and Grok.",
          },
        ],
      },
      {
        id: "instructional-design",
        enabled: true,
        label: "Instructional design",
        strength: "Expert",
        summary:
          "End-to-end course design with ADDIE, SME collaboration, assessments, and learner-centered media.",
        matches: [
          {
            role: "Instructional Design Specialist (Media)",
            company: "Medical Sales College",
            proof:
              "Hybrid migration, Rise/Storyline modules, scenario video, and Canvas support for instructors.",
          },
          {
            role: "Contractor — Instructional Designer",
            company: "iCode / Intuit",
            proof:
              "Managed scope, ADDIE workflow, Storyline templates, CBT modules, and instructor materials.",
          },
        ],
      },
      {
        id: "elearning",
        enabled: true,
        label: "eLearning development",
        strength: "Expert",
        summary:
          "Interactive web modules, storyboards, and media-rich courses built for LMS delivery.",
        matches: [
          {
            role: "Multimedia Director & LMS Platform Design",
            company: "Higher Ed Partners",
            proof:
              "Rise-on-AWS remote updates, Canvas UX enhancements, and scalable multimedia systems.",
          },
          {
            role: "E-Learning Designer",
            company: "Concordia University Irvine",
            proof:
              "Storyline courses with Q&A, flow control, and a 9-week animated history series.",
          },
        ],
      },
      {
        id: "articulate",
        enabled: true,
        label: "Articulate Rise / Storyline",
        strength: "Expert",
        summary:
          "Rise for modular cloud content; Storyline for branching, assessments, and templates.",
        matches: [
          {
            role: "Instructional Design Specialist (Media)",
            company: "Medical Sales College",
            proof: "Interactive Rise & Storyline courses converted from decks and PDFs.",
          },
          {
            role: "Multimedia Director & LMS Platform Design",
            company: "Higher Ed Partners",
            proof: "Centralized Rise content hosting with Canvas iframe delivery.",
          },
        ],
      },
      {
        id: "video-multimedia",
        enabled: true,
        label: "Video / multimedia production",
        strength: "Expert",
        summary:
          "End-to-end training video, motion graphics, and brand media — also on the Media lens.",
        matches: [
          {
            role: "Video Editor, Graphic Artist & E-Learning Designer",
            company: "ProPricer",
            proof:
              "Owned media projects end to end: storyboarding, effects, post-production, and delivery.",
          },
          {
            role: "E-Learning Designer",
            company: "Concordia University Irvine",
            proof: "Animated course graphics and a 9-week series with custom character rigging.",
          },
        ],
      },
    ],
  };

  // Keep media work cases lightly available if re-enabled later; disable featured noise
  ai.work = {
    ...ai.work,
    gallery: { ...ai.work.gallery, items: [] },
    study: { ...ai.work.study, enabled: false },
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

/** Build the UI-designer lens as a visual-design-forward refocus of the media resume. */
export function buildUiResumeContent(mediaBase?: ResumeContent): ResumeContent {
  const media = normalizeResumeContent(mediaBase ?? buildDefaultResumeContent());
  const ui = structuredClone(media) as ResumeContent;

  ui.theme = "slate";
  ui.site = {
    ...ui.site,
    title: "Visual & UI Design Specialist",
    subtitle: "Layout \u00b7 Typography \u00b7 Visual Hierarchy \u00b7 AI-Assisted Design",
    tagline:
      "I design and evaluate visual interfaces \u2014 layout, typography, motion, and AI-assisted outputs \u2014 judging what works and fixing what doesn\u2019t.",
  };

  ui.about = {
    heading: "About",
    lead: "Visual design and multimedia specialist with 20+ years of experience creating learning interfaces, motion graphics, presentation assets, marketing visuals, and interactive course content. Skilled at evaluating layout, typography, visual hierarchy, user flow, accessibility, and production quality across AI-assisted and traditional design workflows.",
    paragraphs: [
      "At Medical Sales College and Higher Ed Partners I moved past just producing media \u2014 I critiqued and refined it. I ran learning video and course visuals through Claude, ChatGPT, and Grok, then evaluated what came back against a professional standard: clarity, pacing, visual hierarchy, and fit to the brief, not just whether it technically worked.",
      "I\u2019ve spent two decades solving visual problems other people can see are wrong but can\u2019t always name \u2014 content overflow and cutoff in embedded Canvas course windows, broken layout and spacing, a confusing user flow through a module, ad and print layouts that need a clearer hierarchy. Fixing those is CSS and production work as much as it is design judgment.",
      "Most recently I directed two AI coding agents to build an original 3D game from scratch \u2014 writing the specs, reviewing every visual change from screenshots, and signing off on art, interface, and motion before anything shipped. That\u2019s the same skill set as evaluating AI-generated design work: knowing what\u2019s right, naming what\u2019s wrong, and directing the fix.",
    ],
  };

  ui.sectionOrder = [
    "hero",
    "about",
    "work",
    "skills",
    "fit",
    "projects",
    "experience",
    "contact",
  ];
  ui.sections = {
    ...ui.sections,
    work: { enabled: true, navLabel: "Visual work" },
    skills: { enabled: true, navLabel: "" },
    projects: { enabled: true, navLabel: "Projects" },
    fit: { enabled: true, navLabel: "" },
  };

  // Experience: visual-design-judgment bullets first, using the specific before/after rewrites
  ui.experience = ui.experience.map((job) => {
    const company = job.company.toLowerCase();
    if (company.includes("medical sales")) {
      return {
        ...job,
        highlights: [
          "Used Claude, ChatGPT, and Grok to accelerate scripting, iteration, and video polish while evaluating AI-assisted outputs for clarity, pacing, visual hierarchy, and fit to the learning brief",
          "Transformed Google Slides and PDFs into production-quality learning videos through graphic treatment and PowerPoint animation",
          "Led hybrid migration of instructor-led content into an accessible online format, with Canvas administration and custom enhancements",
          "Produced remote-instructor video and Vyond scenario content that simulated real patient cycles of care",
        ],
      };
    }
    if (company.includes("higher ed")) {
      return {
        ...job,
        role: "Multimedia Director & Visual / UX Design",
        highlights: [
          "Authored CSS fixes for AWS-hosted Canvas content, resolving iframe rendering issues, content display problems, and learner UX friction across embedded course experiences",
          "Stood up Synthesia avatar-video templates that scaled visual production across courses",
          "Enabled remote Rise updates via AWS hosting inside Canvas, improving user flow without repeated master-course propagation",
          "Shipped a JavaScript translation layer in Canvas so learners could view content in their preferred language",
        ],
      };
    }
    if (company.includes("propricer")) {
      return {
        ...job,
        enabled: true,
        highlights: [
          "Designed magazine ads, conference graphics, interactive media, and custom photo-shoot backgrounds with attention to layout, typography, visual hierarchy, and brand consistency",
          "Owned media projects end to end: storyboarding, effects, post-production, and final delivery formats",
          "Produced the EBS Texas PR announcement \u2014 script, drone/handheld film, narration, edit, and deployment",
        ],
      };
    }
    if (company.includes("icode") || company.includes("intuit")) {
      return {
        ...job,
        highlights: [
          "Built Storyline templates and multimedia web modules with interactive objects, attentive to layout and visual hierarchy for learner navigation",
          "Drove course development end to end with ADDIE \u2014 from scope and timelines through delivery",
          "Partnered with SMEs to produce videos, graphics, instructor manuals, CBT modules, and storyboards",
        ],
      };
    }
    if (company.includes("concordia")) {
      return {
        ...job,
        highlights: [
          "Built animated course graphics from scripts with narration and SRT subtitles (Vyond / After Effects), with close attention to visual pacing and typography",
          "Assembled Storyline courses with Q&A feedback, flow control, and assessment results",
          "Delivered a 9-week animated history series with custom character rigging and culturally resonant visual storytelling",
        ],
      };
    }
    return job;
  });

  const uiProjects: SideProject[] = [
    {
      id: newId("proj"),
      enabled: true,
      title: "Light Cycle Arena",
      summary:
        "Original Tron-inspired racing & combat game for a home console (Batocera Linux, C++17/SDL2/OpenGL), 1–6 player split-screen with Wii-remote tilt steering. Directed two AI coding agents (cloud + desktop, Git-tracked) to build it — wrote the specs, reviewed every visual change from screenshots, and ran separate beta/stable releases. Built a five-level story campaign, a phone-as-controller web companion, and a 3D cockpit (three.js) with lock-on targeting, plus the full 3D asset pipeline, textures, interface art, and audio.",
      href: "https://github.com/rosenauproductions",
      linkLabel: "GitHub profile",
      tags: ["Game design", "AI-directed dev", "3D / UI", "Asset pipeline"],
    },
    {
      id: newId("proj"),
      enabled: true,
      title: "Resume site + Pipeline",
      summary:
        "This site: Next.js/TypeScript resume with Media/AI/UI lenses, Neon-backed job pipeline, visit tracking, visitor identify/link, JD ingest, and an on-site AI chat via Vercel AI Gateway.",
      href: "https://github.com/rosenauproductions/resume",
      linkLabel: "GitHub",
      tags: ["Visual design", "Next.js", "Product UI"],
    },
    {
      id: newId("proj"),
      enabled: true,
      title: "Pistomp-Mobile",
      summary:
        "Mobile-first TypeScript + Vite PWA for the open-source Pi-Stomp multi-effects platform — pedalboard control, A/B snapshots, and per-effect params over the MOD-UI API, designed for phone use on the Pi’s Wi-Fi hotspot.",
      href: "https://github.com/rosenauproductions/Pistomp-Mobile",
      linkLabel: "GitHub",
      tags: ["UX", "Mobile UI", "PWA"],
    },
    {
      id: newId("proj"),
      enabled: true,
      title: "Party games — Family Feud & The 1% Club",
      summary:
        "Browser party games with projector/TV display, host controller, and phone contestant clients — real-time multi-device UI.",
      href: "https://github.com/rosenauproductions/family-feud",
      linkLabel: "GitHub",
      tags: ["Interactive UI", "Multiplayer", "Layout"],
    },
    {
      id: newId("proj"),
      enabled: true,
      title: "Canvas Visual UX Fixes",
      summary:
        "Diagnosed and fixed visual/UX failures inside embedded Canvas LMS course content at Higher Ed Partners and Medical Sales College — CSS fixes for iframe rendering, content overflow and cutoff, alignment and spacing, and confusing learner navigation flow.",
      href: "#work",
      linkLabel: "See case study",
      tags: ["UI fix", "Canvas", "CSS / iframe UX"],
    },
    {
      id: newId("proj"),
      enabled: true,
      title: "ProPricer Brand & Print",
      summary:
        "21 years of magazine ads, conference print graphics, interactive media, and custom photo-shoot backgrounds for ProPricer — consistent layout, typography, visual hierarchy, and brand identity across formats.",
      href: "#work",
      linkLabel: "See case study",
      tags: ["Print", "Layout", "Typography"],
    },
  ];

  ui.sideProjects = {
    heading: "Design & build portfolio",
    note: "Strongest UI / product work is here — much of it independent, since production roles didn’t always call for a shipped interface.",
    projects: uiProjects,
  };

  ui.skills = {
    heading: "Visual design & tools",
    top: ["Layout & Typography", "Visual Hierarchy", "CSS / iframe UX", "AI Design Critique", "User Flow & Interfaces"],
    groups: [
      {
        id: newId("sg"),
        enabled: true,
        label: "Visual / UI Design",
        items: ["Layout & composition", "Typography", "Visual hierarchy", "Brand consistency", "Accessibility"],
      },
      {
        id: newId("sg"),
        enabled: true,
        label: "LMS & Delivery UX",
        items: ["Canvas administration", "AWS-hosted Rise", "CSS / iframe UX", "Content delivery troubleshooting"],
      },
      {
        id: newId("sg"),
        enabled: true,
        label: "Motion & video design",
        items: ["Premiere", "After Effects", "Vyond", "PowerPoint animation", "Synthesia"],
      },
      {
        id: newId("sg"),
        enabled: true,
        label: "AI-assisted design",
        items: ["Claude / ChatGPT / Grok", "Directing AI coding agents", "Evaluating AI-assisted outputs", "Spec-and-review workflow"],
      },
      {
        id: newId("sg"),
        enabled: true,
        label: "Web & interactive",
        items: ["CSS", "JavaScript", "HTML", "Canvas embedding", "User flow"],
      },
    ],
    also: {
      label: "Also comfortable with",
      note: "Game and hardware-adjacent builds that keep 3D/UI and asset-pipeline skills sharp.",
      items: ["three.js", "glTF / GLB", "WebSockets", "Git", "Raspberry Pi / MOD"],
    },
    meters: [
      { id: newId("meter"), enabled: true, name: "Visual & UI design", proficiency: "Expert", width: 95 },
      { id: newId("meter"), enabled: true, name: "Motion graphics & video", proficiency: "Expert", width: 92 },
      { id: newId("meter"), enabled: true, name: "Typography & layout", proficiency: "Advanced", width: 88 },
      { id: newId("meter"), enabled: true, name: "AI-assisted design evaluation", proficiency: "Advanced", width: 85 },
      { id: newId("meter"), enabled: true, name: "Interactive / web (CSS, JS)", proficiency: "Advanced", width: 75 },
      { id: newId("meter"), enabled: true, name: "Canvas / LMS visual delivery", proficiency: "Advanced", width: 70 },
    ],
  };

  const byTitle = (t: string) => uiProjects.find((p) => p.title === t);

  ui.roleFit = {
    heading: "Role fit",
    note: "Select what you’re hiring for — visual design and AI-assisted critique first, plus motion and interactive craft.",
    needs: [
      {
        id: "visual-design-judgment",
        enabled: true,
        label: "Visual design & critique",
        strength: "Expert",
        summary: "Evaluating interfaces, layouts, and AI-assisted visual output against a professional standard.",
        matches: [
          {
            role: "Multimedia Director & Visual / UX Design",
            company: "Higher Ed Partners",
            proof: "CSS fixes for iframe rendering, content display, and learner UX friction across embedded course experiences.",
          },
          {
            role: "ProPricer Brand & Print",
            company: "Side project",
            proof: "Magazine ads, conference graphics, and photo-shoot backgrounds judged on layout, typography, and brand consistency.",
            projectId: byTitle("ProPricer Brand & Print")?.id,
          },
          {
            role: "Light Cycle Arena",
            company: "Side project",
            proof: "Reviewed every visual change from screenshots before approving it into the build.",
            projectId: byTitle("Light Cycle Arena")?.id,
          },
        ],
      },
      {
        id: "ai-assisted-design",
        enabled: true,
        label: "AI-assisted design & evaluation",
        strength: "Advanced",
        summary: "Directing AI tools and judging what they produce — not just prompting them.",
        matches: [
          {
            role: "Instructional Design Specialist (Media)",
            company: "Medical Sales College",
            proof: "Ran scripts through Claude, ChatGPT, and Grok, evaluating outputs for clarity, pacing, and visual hierarchy.",
          },
          {
            role: "Light Cycle Arena",
            company: "Side project",
            proof: "Directed two AI coding agents with written specs and a screenshot-review workflow, controlling beta vs. stable releases.",
            projectId: byTitle("Light Cycle Arena")?.id,
          },
          {
            role: "Resume site + Pipeline",
            company: "Side project",
            proof: "On-site AI chat and job-description ingest built and evaluated with AI-assisted workflows.",
            projectId: byTitle("Resume site + Pipeline")?.id,
          },
        ],
      },
      {
        id: "layout-typography",
        enabled: true,
        label: "Layout & typography",
        strength: "Expert",
        summary: "Print, digital, and interface layout — hierarchy, spacing, and typographic consistency.",
        matches: [
          {
            role: "ProPricer Brand & Print",
            company: "Side project",
            proof: "Magazine ads and conference print graphics designed with attention to layout and typography.",
            projectId: byTitle("ProPricer Brand & Print")?.id,
          },
          {
            role: "Light Cycle Arena",
            company: "Side project",
            proof: "Interface art and HUD layout for a 3D cockpit and multi-device control UI.",
            projectId: byTitle("Light Cycle Arena")?.id,
          },
        ],
      },
      {
        id: "motion-video",
        enabled: true,
        label: "Motion & video design",
        strength: "Expert",
        summary: "Full-cycle motion and video production — animation, pacing, sound design, and delivery.",
        matches: [
          {
            role: "Video Editor, Graphic Artist & E-Learning Designer",
            company: "ProPricer",
            proof: "21 years of end-to-end video, motion graphics, and training media delivery.",
          },
          {
            role: "E-Learning Designer",
            company: "Concordia University Irvine",
            proof: "Vyond + After Effects animation with narration, SRT subtitles, and custom character rigging.",
          },
        ],
      },
      {
        id: "ui-ux-interactive",
        enabled: true,
        label: "UI / interactive & product design",
        strength: "Advanced",
        summary: "Interfaces for real products — web apps, game UI, and multi-device control surfaces.",
        matches: [
          {
            role: "Light Cycle Arena",
            company: "Side project",
            proof: "3D cockpit UI with lock-on targeting and a phone-as-controller companion interface.",
            projectId: byTitle("Light Cycle Arena")?.id,
          },
          {
            role: "Party games — Family Feud & The 1% Club",
            company: "Side project",
            proof: "Realtime multi-device UI across a projector display, host controller, and phone clients.",
            projectId: byTitle("Party games — Family Feud & The 1% Club")?.id,
          },
          {
            role: "Pistomp-Mobile",
            company: "Side project",
            proof: "Mobile UI for pedalboard control, A/B snapshots, and per-effect parameters.",
            projectId: byTitle("Pistomp-Mobile")?.id,
          },
        ],
      },
      {
        id: "canvas-visual-delivery",
        enabled: true,
        label: "Canvas / LMS visual delivery",
        strength: "Advanced",
        summary: "Spotting and fixing visual failures inside embedded LMS course content.",
        matches: [
          {
            role: "Canvas Visual UX Fixes",
            company: "Side project",
            proof: "CSS fixes for AWS-hosted Canvas content — overflow, alignment, spacing, and user flow.",
            projectId: byTitle("Canvas Visual UX Fixes")?.id,
          },
          {
            role: "Instructional Design Specialist (Media)",
            company: "Medical Sales College",
            proof: "Canvas administration and custom programming to keep delivery usable as content grew.",
          },
        ],
      },
      {
        id: "instructional-design",
        enabled: true,
        label: "Instructional design (also see AI / Media lens)",
        strength: "Advanced",
        summary: "ADDIE, Canvas, Storyline, and accessibility — the AI and Media lenses lean harder into this.",
        matches: [
          {
            role: "Instructional Design Specialist (Media)",
            company: "Medical Sales College",
            proof: "Hybrid migration, Rise/Storyline modules, and Canvas support for instructors.",
          },
          {
            role: "Contractor — Instructional Designer",
            company: "iCode / Intuit",
            proof: "ADDIE workflow, Storyline templates, CBT modules, and instructor materials.",
          },
        ],
      },
    ],
  };

  ui.work = {
    ...ui.work,
    gallery: { ...ui.work.gallery, items: [] },
    study: { ...ui.work.study, enabled: false },
    heading: "Selected visual work",
    note: "Interfaces, motion, and print/digital design — proof of visual judgment across formats.",
    cases: [
      {
        id: newId("case"),
        enabled: true,
        title: "Canvas visual UX fixes",
        detail:
          "CSS fixes for AWS-hosted Canvas content — iframe rendering, content overflow/cutoff, alignment and spacing, and learner user flow.",
        tag: "UI fix · Canvas",
      },
      {
        id: newId("case"),
        enabled: true,
        title: "ProPricer brand & print system",
        detail:
          "Magazine ads, conference graphics, and custom photo-shoot backgrounds designed with consistent layout, typography, and brand hierarchy.",
        tag: "Print · Layout",
      },
      {
        id: newId("case"),
        enabled: true,
        title: "Light Cycle Arena — directed AI build",
        detail:
          "Directed two AI coding agents (cloud + desktop) to build an original 3D game — wrote specs, reviewed every visual change from screenshots, and controlled beta vs. stable releases.",
        tag: "AI-directed · 3D UI",
      },
    ],
  };

  return normalizeResumeContent(ui);
}

const LEARNING_SAMPLE_BASE = "/images/samples";

/**
 * Retarget the Media lens at multimedia / learning-media design roles (AbbVie-style):
 * lead with finished learning media, show visual job-aid evidence, document the method,
 * and let the work (not "Expert" labels) carry the level.
 */
export function applyLearningMediaFocus(mediaIn: ResumeContent): ResumeContent {
  const media = structuredClone(mediaIn) as ResumeContent;

  media.site = {
    ...media.site,
    title: "Multimedia Learning Designer",
    subtitle: "Learning video · Graphic design · AI media · Interactive learning",
    tagline:
      "I turn complex software and technical concepts into engaging videos, clear visual learning resources, and intuitive digital experiences.",
  };

  media.about = {
    ...media.about,
    lead: "Learning video, visual job aids, and AI-enabled media — built to be used, not just viewed.",
    paragraphs: [
      media.about.paragraphs[0],
      media.about.paragraphs[1],
      "My focus is the finished learning asset: video that explains why and when to use a feature, job aids and reference guides designed for how they will be used (inline in a course, as a PDF, or as a PowerPoint), and the interactive experiences around them. I’m open to roles in learning media, multimedia design, and instructional design.",
    ],
  };

  media.sectionOrder = ["hero", "work", "about", "projects", "experience", "skills", "fit", "contact"];
  media.sections = {
    ...media.sections,
    work: { enabled: true, navLabel: "Portfolio" },
    skills: { enabled: true, navLabel: "" },
    projects: { enabled: true, navLabel: "UI & builds" },
  };

  // Experience: surface the job-aid / visual work with the video work
  media.experience = media.experience.map((job) => {
    if (!job.company.toLowerCase().includes("medical sales")) return job;
    return {
      ...job,
      highlights: [
        job.highlights[1],
        "Designed job aids for each course’s material — placed inline in Rise, or delivered as PDFs or PowerPoints depending on use (training vs. on-site reference)",
        job.highlights[0],
        job.highlights[3],
        job.highlights[2],
        job.highlights[4],
      ],
    };
  });

  // Work section: finished learning media first
  const [ednet, ppt, reel] = media.work.featured;
  media.work = {
    ...media.work,
    heading: "Learning media portfolio",
    note: "Finished work first: AI-assisted video, animated training, and job aids built for how learners will use them.",
    featured: [
      {
        ...ednet,
        label: "AI-assisted platform tutorial — Ednet introduction",
        detail: "Software walkthrough built mostly with Synthesia avatar narration and After Effects motion graphics.",
        tools: "Synthesia · After Effects",
      },
      {
        ...ppt,
        label: "Animated training video (PowerPoint)",
        detail: "Source slides turned into production-quality learning video through graphic treatment and animation.",
        tools: "PowerPoint animation",
      },
      {
        ...reel,
        label: "Portfolio reel",
        detail: "Two-year overview of video and learning-media work.",
      },
    ],
    gallery: {
      heading: "Visual learning design: job aids, guides, graphics",
      note: "I design a job aid for each course’s material and deliver it inline in Rise, as a PDF, or as a PowerPoint depending on use — training or on site. The pieces below are demonstration pieces on a fictional application, shown as one consistent visual system.",
      items: [
        {
          id: newId("vis"),
          enabled: true,
          title: "Create a shared project board",
          tag: "Quick reference guide",
          caption: "Five numbered steps, a ‘when to use this’ callout, and a shortcut table — built to sit beside the task or print for on-site use.",
          image: `${LEARNING_SAMPLE_BASE}/sample-quick-reference-guide.png`,
          alt: "Quick reference guide titled Create a shared project board, with five numbered steps, a callout, and a keyboard shortcut table.",
        },
        {
          id: newId("vis"),
          enabled: true,
          title: "Turn meeting notes into action items",
          tag: "AI prompt recipe · job aid",
          caption: "Role, task, context, format, and limit laid out as a recipe, with a copy-ready prompt and a review-before-you-send checklist.",
          image: `${LEARNING_SAMPLE_BASE}/sample-ai-prompt-recipe.png`,
          alt: "AI prompt job aid with a five-row recipe table, a copy-and-fill prompt block, and a four-item review checklist.",
        },
        {
          id: newId("vis"),
          enabled: true,
          title: "From request to done: how work moves",
          tag: "Infographic",
          caption: "A four-stage process shown as a flow, with who owns each stage called out so learners see what happens next.",
          image: `${LEARNING_SAMPLE_BASE}/sample-infographic.png`,
          alt: "Infographic showing four stages — Request, Triage, Build, Review and done — with the people involved at each stage.",
        },
      ],
    },
    study: {
      enabled: true,
      tag: "Case study · video + job aids",
      title: "From dense source material to a matched set of learning assets",
      summary:
        "How a course topic becomes a video, in-course content, and a job aid that learners can use in training or on the job.",
      steps: [
        {
          id: newId("step"),
          label: "Source and learner need",
          detail: "Start from SME slides, PDFs, and instructor-led content. Decide what the learner must do, and whether they will need it while training or on site.",
        },
        {
          id: newId("step"),
          label: "Script and storyboard",
          detail: "Rework the content into a script and storyboard. LLM workflows (Claude, ChatGPT, Grok) speed drafting and iteration; a human review keeps it accurate.",
        },
        {
          id: newId("step"),
          label: "Produce the video",
          detail: "Graphic treatment and animation in PowerPoint, Premiere or After Effects when it needs more polish, or Synthesia avatars when narration scales better than filming.",
        },
        {
          id: newId("step"),
          label: "Design the job aid for its use",
          detail: "One job aid per course material: inline in Rise, or as a PDF or PowerPoint depending on whether it supports training or on-site work.",
        },
        {
          id: newId("step"),
          label: "Review and revise",
          detail: "SME and stakeholder review of script and visuals, then revisions before release, with change requests managed against the delivery date.",
        },
        {
          id: newId("step"),
          label: "Accessible delivery",
          detail: "Captions or SRT subtitles on video, readable layouts, and consistent hosting and delivery inside the LMS.",
        },
      ],
      outcome:
        "A matched set — video, in-course content, and job aid — that learners can use in training or at work.",
    },
    cases: [
      {
        id: newId("case"),
        enabled: true,
        title: "Job aids by use",
        detail:
          "Designed a job aid for each course’s material: inline in Rise, or as a PDF or PowerPoint depending on training vs. on-site use.",
        tag: "Visual design · Rise",
      },
      ...media.work.cases
        .filter((c) => c.title !== "Canvas delivery customizations")
        .reverse(),
      ...media.work.cases
        .filter((c) => c.title === "Canvas delivery customizations")
        .map((c) => ({ ...c, enabled: false })),
    ],
  };

  media.sideProjects = {
    ...media.sideProjects,
    heading: "Interactive UI & technical projects",
    note: "Supporting evidence of interface design, clear interaction, and working software — secondary to the learning media above.",
  };

  // Skills: multimedia + visual design first, no overstated labels
  const groupOrder = ["Video & animation", "Instructional design", "LMS & delivery", "AI & programming"];
  const visualGroup = {
    id: newId("sg"),
    enabled: true,
    label: "Graphic design & job aids",
    items: ["Job aids (inline Rise, PDF, PowerPoint)", "Layout & visual hierarchy", "Print & conference graphics", "Reference guides"],
  };
  const sortedGroups = [...media.skills.groups].sort(
    (a, b) => groupOrder.indexOf(a.label) - groupOrder.indexOf(b.label),
  );
  media.skills = {
    ...media.skills,
    top: ["Learning video", "Visual job aids", "AI-assisted media"],
    groups: [sortedGroups[0], visualGroup, ...sortedGroups.slice(1)],
    meters: [...media.skills.meters]
      .sort((a, b) => {
        const rank = (n: string) =>
          /Synthesia|PowerPoint|Premiere|Vyond/i.test(n) ? 0 : /Rise|Storyline/i.test(n) ? 1 : 2;
        return rank(a.name) - rank(b.name);
      })
      .map((m) => ({
        ...m,
        proficiency: m.proficiency === "Expert" ? "Advanced" : "Proficient",
      })),
  };

  // Role fit: lead with visual + AI video; "Strong" instead of "Expert"
  const visualNeed = {
    id: "visual-learning",
    enabled: true,
    label: "Visual learning design",
    strength: "Strong",
    summary:
      "Clean, scannable job aids, reference guides, and graphics designed for how they will be used — inline in the course, in print, or on site.",
    matches: [
      {
        role: "Instructional Design Specialist (Media)",
        company: "Medical Sales College",
        proof: "Designed a job aid for each course’s material, delivered inline in Rise, as a PDF, or as a PowerPoint depending on use.",
      },
      {
        role: "Video Editor, Graphic Artist & E-Learning Designer",
        company: "ProPricer",
        proof: "Magazine ads, conference print graphics, and training media across 20 years of graphic production.",
      },
      {
        role: "E-Learning Designer",
        company: "Concordia University Irvine",
        proof: "Animated course graphics built from scripts, with narration and SRT subtitles.",
      },
    ],
  };
  const needOrder = [
    "visual-learning",
    "ai-video",
    "ppt-video",
    "multimedia",
    "instructional-design",
    "elearning",
    "articulate",
    "hybrid",
    "canvas",
    "corporate",
    "ai-dev",
    "programming",
  ];
  const needs = [visualNeed, ...media.roleFit.needs].map((n) => ({
    ...n,
    strength: n.strength === "Expert" ? "Strong" : n.strength,
  }));
  needs.sort((a, b) => needOrder.indexOf(a.id) - needOrder.indexOf(b.id));
  media.roleFit = {
    ...media.roleFit,
    note: "Select what you’re hiring for. I’ll map it to matching roles, side projects, and short proof points.",
    needs,
  };

  return normalizeResumeContent(media);
}

export function buildDefaultResumeDocument(): ResumeDocument {
  const base = buildDefaultResumeContent();
  // AI and UI lenses are derived from the untouched base; Media is then retargeted.
  const ai = syncSharedIdentity(base, buildAiResumeContent(base));
  const ui = syncSharedIdentity(base, buildUiResumeContent(base));
  const media = applyLearningMediaFocus(base);
  return { version: 2, lenses: { media, ai, ui } };
}

/** Patch live AI CMS docs: drop BPMon note, ensure ID/media fit + GoodWork exist. */
function repairAiLensContent(ai: ResumeContent, media: ResumeContent): ResumeContent {
  const seeded = buildAiResumeContent(media);
  let note = ai.sideProjects.note || "";
  if (/BPMon|experiment toys omitted/i.test(note)) {
    note = seeded.sideProjects.note;
  }

  const haveProjects = new Set(
    ai.sideProjects.projects.map((p) => p.title.trim().toLowerCase()),
  );
  const extraProjects = seeded.sideProjects.projects.filter(
    (p) => !haveProjects.has(p.title.trim().toLowerCase()),
  );
  // Prefer inserting GoodWork near the top if newly added
  const projects =
    extraProjects.length > 0
      ? (() => {
          const gw = extraProjects.filter((p) => p.title === "GoodWork");
          const rest = extraProjects.filter((p) => p.title !== "GoodWork");
          if (!gw.length) return [...ai.sideProjects.projects, ...extraProjects];
          const resumeIdx = ai.sideProjects.projects.findIndex((p) =>
            /resume/i.test(p.title),
          );
          const base = [...ai.sideProjects.projects];
          const at = resumeIdx >= 0 ? resumeIdx + 1 : 0;
          base.splice(at, 0, ...gw);
          return [...base, ...rest];
        })()
      : ai.sideProjects.projects;

  const have = new Set(ai.roleFit.needs.map((n) => n.id));
  const extras = seeded.roleFit.needs.filter((n) => !have.has(n.id));
  let needs = extras.length > 0 ? [...ai.roleFit.needs, ...extras] : ai.roleFit.needs;

  // Ensure Programming fit cites GoodWork when the project exists
  const goodwork = projects.find((p) => p.title === "GoodWork");
  if (goodwork) {
    needs = needs.map((need) => {
      if (need.id !== "programming") return need;
      if (need.matches.some((m) => m.role === "GoodWork" || m.projectId === goodwork.id)) {
        return need;
      }
      return {
        ...need,
        matches: [
          {
            role: "GoodWork",
            company: "Side project",
            proof:
              "React/TypeScript service-exchange UI — jobs, parent approval, volunteers, and fundraising progress.",
            projectId: goodwork.id,
          },
          ...need.matches,
        ],
      };
    });
  }

  return {
    ...ai,
    sideProjects: { ...ai.sideProjects, note, projects },
    roleFit: {
      ...ai.roleFit,
      note:
        /instructional design and media/i.test(ai.roleFit.note || "")
          ? ai.roleFit.note
          : seeded.roleFit.note,
      needs,
    },
  };
}

/** Patch live UI CMS docs: ensure Light Cycle Arena + fit needs exist. */
function repairUiLensContent(ui: ResumeContent, media: ResumeContent): ResumeContent {
  const seeded = buildUiResumeContent(media);

  const haveProjects = new Set(
    ui.sideProjects.projects.map((p) => p.title.trim().toLowerCase()),
  );
  const extraProjects = seeded.sideProjects.projects.filter(
    (p) => !haveProjects.has(p.title.trim().toLowerCase()),
  );
  const projects =
    extraProjects.length > 0
      ? (() => {
          const lca = extraProjects.filter((p) => p.title === "Light Cycle Arena");
          const rest = extraProjects.filter((p) => p.title !== "Light Cycle Arena");
          const base = [...ui.sideProjects.projects];
          if (lca.length) base.splice(0, 0, ...lca);
          return [...base, ...rest];
        })()
      : ui.sideProjects.projects;

  const have = new Set(ui.roleFit.needs.map((n) => n.id));
  const extras = seeded.roleFit.needs.filter((n) => !have.has(n.id));
  const needs = extras.length > 0 ? [...ui.roleFit.needs, ...extras] : ui.roleFit.needs;

  return {
    ...ui,
    sideProjects: { ...ui.sideProjects, projects },
    roleFit: { ...ui.roleFit, needs },
  };
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
    if (!lenses.ai || (ai.site.title === media.site.title && ai.theme === media.theme)) {
      if (!lenses.ai) {
        ai = syncSharedIdentity(media, buildAiResumeContent(media));
      }
    }
    ai = repairAiLensContent(syncSharedIdentity(media, ai), media);

    let ui = normalizeResumeContent(lenses.ui ?? fallback.lenses.ui);
    if (!lenses.ui || (ui.site.title === media.site.title && ui.theme === media.theme)) {
      if (!lenses.ui) {
        ui = syncSharedIdentity(media, buildUiResumeContent(media));
      }
    }
    ui = repairUiLensContent(syncSharedIdentity(media, ui), media);

    const mediaRepaired = repairMediaSideProjects(media);
    return {
      version: 2,
      lenses: {
        media: mediaRepaired,
        ai: syncSharedIdentity(mediaRepaired, ai),
        ui: syncSharedIdentity(mediaRepaired, ui),
      },
    };
  }

  // v1 flat ResumeContent → triple document
  const media = repairMediaSideProjects(normalizeResumeContent(raw));
  const ai = syncSharedIdentity(media, buildAiResumeContent(media));
  const ui = syncSharedIdentity(media, buildUiResumeContent(media));
  return { version: 2, lenses: { media, ai, ui } };
}

function repairMediaSideProjects(media: ResumeContent): ResumeContent {
  const have = new Set(media.sideProjects.projects.map((p) => p.title.trim().toLowerCase()));
  if (have.has("goodwork")) return media;
  const goodwork = {
    id: newId("proj"),
    enabled: true,
    title: "GoodWork",
    summary:
      "TypeScript + React church youth service exchange — job requests, volunteer assignment, parent approval, family profiles, and fundraising milestones. Live: goodwork-two.vercel.app",
    href: "https://github.com/rosenauproductions/goodwork",
    linkLabel: "GitHub",
    tags: ["TypeScript", "React", "Vite", "Product UI"],
  };
  return {
    ...media,
    sideProjects: {
      ...media.sideProjects,
      projects: [goodwork, ...media.sideProjects.projects],
    },
  };
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
        ui: syncSharedIdentity(normalized, doc.lenses.ui),
      },
    };
  }
  // Non-media edit (ai or ui): shared identity still owned by media for consistency, unless user
  // edited contact on this lens — prefer media as source of truth for identity, but push through
  // any contact change the user made here, and keep the third lens's own content untouched.
  const media = syncSharedIdentity(normalized, doc.lenses.media);
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
  const other: ResumeLensId = lens === "ai" ? "ui" : "ai";
  return {
    version: 2,
    lenses: {
      media: mediaSynced,
      [lens]: normalized,
      [other]: syncSharedIdentity(mediaSynced, doc.lenses[other]),
    } as ResumeDocument["lenses"],
  };
}

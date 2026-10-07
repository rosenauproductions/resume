/**
 * AI Learning Systems section — drop this into src/content/resume.ts
 * (or import it and re-export from there)
 */

export const aiLearningSystems = {
  heading: "AI Learning Systems",
  note: "Hands-on systems that combine instructional design, generative AI, and LMS delivery. Built to ship, not just propose.",
  projects: [
    {
      title: "ID Assist — Instructional Design Compiler + Live Tutor",
      tagline: "Brief → pedagogy-gated outline → human approval → artifacts + adaptive AI tutor",
      summary:
        "Local-first instructional-design compiler that turns a course brief into a structured outline with Bloom’s alignment checks, quantity filters, and live cost/time estimates. After human approval it generates delivery artifacts and spins up a live AI tutor grounded in the lesson content. Supports adaptive SME interviews, team workspaces, and both cloud and fully local (Ollama) modes.",
      role: "Solo builder — architecture, prompt systems, pedagogy rules, UI, local LLM integration, and desktop packaging",
      tech: [
        "Next.js / TypeScript",
        "Ollama (local LLM + custom Modelfile)",
        "Prompt chains + structured output",
        "Bloom’s taxonomy gates",
        "Electron desktop wrapper",
        "Drizzle / Postgres",
      ],
      highlights: [
        "Pedagogy-first design: every outline must pass real Bloom’s-alignment and quantity rules before approval — no pure generative free-for-all",
        "Adaptive SME interview mode (live call or async link) that feeds the compiler",
        "Live tutor that auto-drafts concepts from the lesson’s own content and stays grounded",
        "Human-in-the-loop checkpoint before any artifacts are released",
        "Runs fully local via Ollama or in the cloud; Electron app for offline use",
      ],
      responsibleAI: [
        "Human review gate on every outline",
        "Local model option for privacy-sensitive content",
        "Transparent cost/time estimates so stakeholders stay in control",
      ],
      links: [
        { label: "Live demo", href: "https://id-assist.vercel.app" },
        { label: "GitHub", href: "https://github.com/rosenauproductions/id-assist" },
      ],
      tags: ["AI Learning", "Prompt Engineering", "RAG-style grounding", "Instructional Design", "Local LLM"],
    },
    {
      title: "StepBot — Canvas LMS Help Bot",
      tagline: "Embeddable multi-step guided help with session memory and admin creator tools",
      summary:
        "Standalone, themeable help bot designed to embed directly in Canvas LMS. Learners get guided multi-step answers with ticket-based session memory so they can resume across devices. Admins get a visual creator tool and theme generator for zero-code content updates and multi-site deployments.",
      role: "Solo builder — interaction design, content model, session memory, admin tooling, and Canvas embedding patterns",
      tech: [
        "Vanilla JavaScript",
        "Canvas LMS embedding",
        "Text-file + creator UI content model",
        "Session tickets + multi-device memory",
        "Theme system (colors, fonts, logo)",
      ],
      highlights: [
        "Parses learner questions and surfaces 2–6 related next steps",
        "Ticket-based memory so multi-step sessions survive page reloads and device switches",
        "Admin creator tool + theme generator — no code required for content or branding updates",
        "Multi-site friendly (subdirectory or GitHub-fork deployments)",
        "Built specifically for Canvas iframe delivery",
      ],
      responsibleAI: [
        "Deterministic content model (no open-ended generation in production)",
        "Clear separation of learner experience and admin controls",
      ],
      links: [
        { label: "Live demo", href: "https://step-bot-msc.vercel.app" },
        { label: "GitHub", href: "https://github.com/rosenauproductions/StepBot-MSC" },
      ],
      tags: ["Canvas LMS", "Learning Support", "Session Memory", "Admin Tooling"],
    },
  ],
} as const;

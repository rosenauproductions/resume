/**
 * Edit this file to update resume copy.
 * Portraits live in /public/images.
 */

export const site = {
  name: "Chris Rosenau",
  title: "Multimedia Designer & Learning Media Specialist",
  subtitle: "Graphic arts · Video · LMS · AI · Programming",
  location: "Dallas, Texas",
  email: "rosenauproductions@gmail.com",
  phone: "945-217-2211",
  phoneHref: "tel:9452172211",
  linkedin: "https://www.linkedin.com/in/christopherrosenau",
  linkedinLabel: "linkedin.com/in/christopherrosenau",
  tagline:
    "I build learning and brand media end to end — design, motion and video, LMS systems, and interactive experiences that actually scale.",
};

export const about = {
  heading: "About",
  lead: "Learning media, graphic arts, and systems that scale — not just slide decks.",
  paragraphs: [
    "At Medical Sales College, I led the move from instructor-led training to a hybrid online format. I converted source materials into Rise and Storyline modules, built animated training video (PowerPoint through Premiere and After Effects), and owned Canvas administration — including custom enhancements and instructor support — so the platform stayed usable as content grew.",
    "As Multimedia Director at Higher Ed Partners, I stood up Synthesia avatar-video templates, wrote CSS and JavaScript for Canvas delivery, and designed hosting workflows that let teams update Rise content without constant master-course churn. Earlier roles deepened the craft: video editing, motion graphics, print and digital design, and full production from storyboard to delivery.",
    "I work where multimedia design, graphic arts, instructional media, LMS management, and practical programming meet. I’m open to roles in multimedia production, visual design, eLearning development, Canvas administration, interactive product work, corporate training, and instructional design.",
  ],
};

export const experience = [
  {
    role: "Instructional Design Specialist (Media)",
    company: "Medical Sales College",
    dates: "Feb 2024 – July 2026",
    location: "Remote",
    highlights: [
      "Led hybrid migration of instructor-led content into an accessible online format — Rise/Storyline modules, animated training video, and Canvas administration with custom enhancements",
      "Transformed Google Slides and PDFs into production-quality learning videos through graphic treatment and PowerPoint animation",
      "Accelerated production with LLM workflows (Claude, ChatGPT, Grok) for scripting, iteration, and video polish",
      "Produced remote-instructor video and Vyond scenario content that simulated real patient cycles of care",
      "Owned Canvas LMS operations: troubleshooting, custom programming, and day-to-day instructor support",
    ],
  },
  {
    role: "Multimedia Director & E-Learning Design",
    company: "Higher Ed Partners",
    dates: "May 2022 – Dec 2023",
    location: "Dallas, Texas",
    highlights: [
      "Replaced slow traditional filming cycles with Synthesia avatar templates that scaled video production across courses",
      "Enabled remote Rise updates via AWS hosting inside Canvas — eliminating repeated master-course propagations",
      "Improved learner UX with CSS that fixed iframe rendering for AWS-hosted content",
      "Standardized Vimeo delivery for parallel multimedia updates and consistent accessibility",
      "Shipped a JavaScript translation layer in Canvas so learners could view content in their preferred language",
      "Mapped delivery workflows to expose process gaps and tighten handoffs across teams",
    ],
  },
  {
    role: "Contractor — Instructional Designer",
    company: "iCode School Franchise / Intuit",
    dates: "Dec 2021 – May 2022",
    location: "",
    highlights: [
      "Drove course development end to end with ADDIE — from scope and timelines through delivery",
      "Aligned stakeholders on requirements, goals, and milestones before build began",
      "Built Storyline templates and multimedia web modules with interactive objects for LMS delivery",
      "Partnered with SMEs to produce videos, graphics, instructor manuals, CBT modules, and storyboards",
    ],
  },
  {
    role: "Video Editor, Graphic Artist & E-Learning Designer",
    company: "ProPricer",
    dates: "Jan 2001 – Dec 2021",
    location: "Bedford, Texas",
    highlights: [
      "Owned media projects end to end: storyboarding, effects, post-production, and final delivery formats",
      "Delivered training videos for digital distribution with graphics, sound design, and music mix",
      "Produced the EBS Texas PR announcement — script, drone/handheld film, narration, edit, and deployment",
      "Created magazine ads, conference print graphics, and interactive media with custom photo backgrounds",
    ],
  },
  {
    role: "E-Learning Designer",
    company: "Concordia University Irvine",
    dates: "Feb 2016 – Oct 2020",
    location: "Irvine, California",
    highlights: [
      "Built animated course graphics from scripts with narration and SRT subtitles (Vyond / After Effects)",
      "Assembled Storyline courses with Q&A feedback, flow control, and assessment results",
      "Delivered Eastern History (HST301): a 9-week animated series with custom character rigging and culturally resonant storytelling",
      "Managed script-to-screen workflow and client change requests without derailing delivery dates",
    ],
  },
] as const;

export const skills = {
  heading: "Skills & tools",
  top: ["Course Design", "Training Material", "Overcome Obstacles"],
  groups: [
    {
      label: "Instructional design",
      items: ["Articulate Rise", "Articulate Storyline", "ADDIE", "CBT & storyboards"],
    },
    {
      label: "LMS & delivery",
      items: ["Canvas administration", "AWS-hosted Rise", "CSS / iframe UX", "JS translation layer"],
    },
    {
      label: "Video & animation",
      items: ["PowerPoint video", "Synthesia", "Vyond", "Premiere", "After Effects"],
    },
    {
      label: "AI & programming",
      items: ["Claude / ChatGPT / Grok", "JavaScript", "CSS", "HTML / web delivery"],
    },
  ],
  also: {
    label: "Also comfortable with",
    note: "Independent builds keep these sharp without crowding the core eLearning stack.",
    items: [
      "TypeScript",
      "Vite",
      "PWA",
      "Raspberry Pi / MOD ecosystem",
      "Canvas embedding",
      "Next.js",
    ],
  },
  meters: [
    { name: "Articulate Rise & Storyline", proficiency: "Expert", width: 95 },
    { name: "PowerPoint animation & video", proficiency: "Expert", width: 98 },
    { name: "Synthesia AI video", proficiency: "Expert", width: 90 },
    { name: "AI tooling & workflows", proficiency: "Advanced", width: 82 },
    { name: "JavaScript / CSS / web", proficiency: "Advanced", width: 72 },
    { name: "Canvas LMS", proficiency: "Advanced", width: 70 },
    { name: "Premiere / After Effects", proficiency: "Expert", width: 92 },
    { name: "Vyond / character animation", proficiency: "Expert", width: 92 },
  ],
};

/** Network / constellation view for Skills toggle (coords in 0–100 space) */
export const skillsNetwork = {
  nodes: [
    { id: "core", label: "Learning\nmedia", kind: "hub", x: 50, y: 48 },
    { id: "id", label: "Instructional\ndesign", kind: "hub", x: 18, y: 22 },
    { id: "lms", label: "LMS &\ndelivery", kind: "hub", x: 82, y: 22 },
    { id: "video", label: "Video &\nanimation", kind: "hub", x: 18, y: 78 },
    { id: "ai", label: "AI\ndevelopment", kind: "hub", x: 82, y: 78 },
    { id: "code", label: "Programming", kind: "hub", x: 50, y: 78 },
    { id: "rise", label: "Rise", kind: "skill", x: 8, y: 10 },
    { id: "storyline", label: "Storyline", kind: "skill", x: 26, y: 8 },
    { id: "addie", label: "ADDIE", kind: "skill", x: 10, y: 36 },
    { id: "canvas", label: "Canvas", kind: "skill", x: 92, y: 10 },
    { id: "aws", label: "AWS Rise", kind: "skill", x: 90, y: 36 },
    { id: "css", label: "CSS", kind: "skill", x: 68, y: 10 },
    { id: "js", label: "JavaScript", kind: "skill", x: 62, y: 88 },
    { id: "html", label: "HTML / web", kind: "skill", x: 38, y: 90 },
    { id: "ppt", label: "PPT video", kind: "skill", x: 6, y: 62 },
    { id: "vyond", label: "Vyond", kind: "skill", x: 10, y: 92 },
    { id: "ae", label: "AE / Premiere", kind: "skill", x: 28, y: 92 },
    { id: "synthesia", label: "Synthesia", kind: "skill", x: 94, y: 62 },
    { id: "llm", label: "LLMs", kind: "skill", x: 92, y: 92 },
    { id: "agents", label: "AI workflows", kind: "skill", x: 78, y: 92 },
    { id: "hybrid", label: "Hybrid\nmigration", kind: "duty", x: 50, y: 12 },
    { id: "sme", label: "SME\ncollab", kind: "duty", x: 36, y: 58 },
    { id: "templates", label: "Templates\n& scale", kind: "duty", x: 64, y: 50 },
    { id: "assess", label: "Assessments", kind: "duty", x: 36, y: 42 },
  ],
  edges: [
    ["core", "id"],
    ["core", "lms"],
    ["core", "video"],
    ["core", "ai"],
    ["core", "code"],
    ["core", "hybrid"],
    ["core", "sme"],
    ["core", "templates"],
    ["core", "assess"],
    ["id", "rise"],
    ["id", "storyline"],
    ["id", "addie"],
    ["id", "assess"],
    ["id", "hybrid"],
    ["lms", "canvas"],
    ["lms", "aws"],
    ["lms", "css"],
    ["lms", "templates"],
    ["lms", "code"],
    ["video", "ppt"],
    ["video", "vyond"],
    ["video", "ae"],
    ["video", "sme"],
    ["ai", "synthesia"],
    ["ai", "llm"],
    ["ai", "agents"],
    ["ai", "templates"],
    ["ai", "code"],
    ["code", "js"],
    ["code", "html"],
    ["code", "css"],
    ["rise", "aws"],
    ["storyline", "assess"],
    ["ppt", "llm"],
    ["synthesia", "templates"],
  ],
} as const;

export const portraits = {
  hero: "/images/portrait-hero.png",
  rim: "/images/portrait-rim.png",
  side: "/images/portrait-side.png",
  close: "/images/portrait-about.png",
  texture: "/images/texture-concrete.png",
};

/** Selected work — video reel + looping demo + short cases */
export const work = {
  heading: "Selected work",
  note: "Courses, video, and learning systems — with a few highlights that show range.",
  portfolioVideo: {
    href: "https://www.youtube.com/watch?v=ja7QZxXej7w",
    embed: "https://www.youtube.com/embed/ja7QZxXej7w",
    label: "Watch portfolio reel",
    detail: "2-year portfolio overview",
  },
  demoGif: {
    src: "/images/work-diagnostic-scope.mp4",
    title: "PPT Animation Samples",
    detail: "Animated training video built primarily in PowerPoint",
  },
  cases: [
    {
      title: "Hybrid course migration",
      detail:
        "Moved instructor-led Medical Sales College content online with Rise/Storyline modules, training video, and Canvas support for faculty.",
      tag: "LMS · Articulate",
    },
    {
      title: "Synthesia avatar systems",
      detail:
        "Template-driven AI video at Higher Ed Partners that replaced slow traditional filming and kept updates moving at course scale.",
      tag: "AI video",
    },
    {
      title: "Canvas delivery customizations",
      detail:
        "CSS for iframe UX and a JavaScript translation layer so learners could view hosted Rise content in their preferred language.",
      tag: "Programming · LMS",
    },
  ],
};

/** Independent builds that keep programming / UX / systems skills sharp */
export const sideProjects = {
  heading: "Selected Side Projects",
  note: "Beyond institutional work I build tools for learners, instructors, and musicians. These projects keep programming, UX, and systems skills sharp.",
  projects: [
    {
      title: "Pistomp-Mobile",
      summary:
        "Mobile-first companion web app for the open-source Pi-Stomp multi-effects platform. TypeScript + Vite PWA for pedalboard control, effect bypass, A/B snapshots, gain, and per-effect parameters over the MOD-UI API — optimized for phone use on the Pi’s Wi-Fi hotspot, with install and admin features.",
      href: "https://github.com/rosenauproductions/Pistomp-Mobile",
      linkLabel: "GitHub",
      tags: ["TypeScript", "PWA", "Raspberry Pi", "UX"],
    },
    {
      title: "StepBot — Canvas LMS help bot",
      summary:
        "Embeddable Canvas help bot with multi-step guided answers, session memory, admin/creator tooling, and theming. Built for easy content management and multi-site deployment.",
      href: "https://github.com/rosenauproductions/StepBot-MSC",
      linkLabel: "GitHub",
      tags: ["Canvas", "JavaScript", "LMS"],
    },
    {
      title: "Interactive party games & more",
      summary:
        "Browser-based Family Feud and The 1% Club with projector + host + phone controllers, plus family calendar tooling and other experiments in interactive media and rapid prototyping.",
      href: "https://github.com/rosenauproductions",
      linkLabel: "GitHub profile",
      tags: ["Interactive media", "Multiplayer UI"],
    },
  ],
};

export const education = [
  {
    school: "Graphic Arts",
    detail: "Graphic Arts studies",
    dates: "1999 – 2000",
  },
];

export const certifications = [
  "Instructional Design Essentials: Models of ID",
  "E-Learning Professional Learning Path — In Progress",
  "Synthesia Video Essentials Certification",
];

/**
 * Recruiter / hiring-manager fit checker.
 * Select needs → see matching roles + proof from the resume.
 */
export const roleFit = {
  heading: "Role fit",
  note: "Select what you’re hiring for. I’ll map it to matching roles and short proof points.",
  needs: [
    {
      id: "instructional-design",
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
      label: "eLearning development",
      strength: "Expert",
      summary:
        "Interactive web modules, storyboards, and media-rich courses built for LMS delivery.",
      matches: [
        {
          role: "Multimedia Director & E-Learning Design",
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
          role: "Multimedia Director & E-Learning Design",
          company: "Higher Ed Partners",
          proof: "Centralized Rise content hosting with Canvas iframe delivery.",
        },
      ],
    },
    {
      id: "canvas",
      label: "Canvas LMS",
      strength: "Advanced",
      summary:
        "Administration, instructor support, custom enhancements, and content delivery patterns.",
      matches: [
        {
          role: "Instructional Design Specialist (Media)",
          company: "Medical Sales College",
          proof: "LMS admin, troubleshooting, custom programming, and faculty support.",
        },
        {
          role: "Multimedia Director & E-Learning Design",
          company: "Higher Ed Partners",
          proof: "Remote Rise updates, CSS for iframes, and multilingual JS layer in Canvas.",
        },
      ],
    },
    {
      id: "ai-video",
      label: "AI video / Synthesia",
      strength: "Expert",
      summary:
        "Template systems and production workflows that replace slow traditional filming cycles.",
      matches: [
        {
          role: "Multimedia Director & E-Learning Design",
          company: "Higher Ed Partners",
          proof: "Pioneered Synthesia avatar templates to accelerate content production.",
        },
        {
          role: "Instructional Design Specialist (Media)",
          company: "Medical Sales College",
          proof: "AI-assisted learning video production with Claude, ChatGPT, and Grok.",
        },
      ],
    },
    {
      id: "ai-dev",
      label: "AI development",
      strength: "Advanced",
      summary:
        "AI-assisted production and build workflows — LLMs for content systems, automation, and faster iteration.",
      matches: [
        {
          role: "Instructional Design Specialist (Media)",
          company: "Medical Sales College",
          proof:
            "Used Claude, ChatGPT, and Grok in day-to-day production and development workflows.",
        },
        {
          role: "Multimedia Director & E-Learning Design",
          company: "Higher Ed Partners",
          proof: "Built AI avatar video systems and scalable content pipelines with Synthesia.",
        },
      ],
    },
    {
      id: "programming",
      label: "Programming / web",
      strength: "Advanced",
      summary:
        "Practical web programming for learning delivery — JavaScript, CSS, HTML, and LMS customizations.",
      matches: [
        {
          role: "Multimedia Director & E-Learning Design",
          company: "Higher Ed Partners",
          proof: "CSS for iframe UX and a JavaScript translation layer inside Canvas.",
        },
        {
          role: "Instructional Design Specialist (Media)",
          company: "Medical Sales College",
          proof: "Custom Canvas programming enhancements, troubleshooting, and faculty support.",
        },
      ],
    },
    {
      id: "ppt-video",
      label: "PowerPoint training video",
      strength: "Expert",
      summary:
        "Preferred tool for informative/training video — graphic enhancement, animation, and polish.",
      matches: [
        {
          role: "Instructional Design Specialist (Media)",
          company: "Medical Sales College",
          proof:
            "Turned Slides/PDFs into animated PowerPoint learning videos at production quality.",
        },
      ],
    },
    {
      id: "multimedia",
      label: "Multimedia / video production",
      strength: "Expert",
      summary:
        "Full-cycle production: script, film, edit, motion, audio, and delivery formats.",
      matches: [
        {
          role: "Video Editor, Graphic Artist & E-Learning Designer",
          company: "ProPricer",
          proof: "21 years of end-to-end video, graphics, and training media delivery.",
        },
        {
          role: "E-Learning Designer",
          company: "Concordia University Irvine",
          proof: "Vyond + After Effects animation with narration and SRT subtitles.",
        },
      ],
    },
    {
      id: "hybrid",
      label: "Hybrid / online migration",
      strength: "Expert",
      summary:
        "Moving instructor-led programs online without losing engagement or update speed.",
      matches: [
        {
          role: "Instructional Design Specialist (Media)",
          company: "Medical Sales College",
          proof: "Led in-person → hybrid transition with accessibility and flexibility gains.",
        },
        {
          role: "Multimedia Director & E-Learning Design",
          company: "Higher Ed Partners",
          proof: "Remote content update model that removed repeated Canvas master churn.",
        },
      ],
    },
    {
      id: "corporate",
      label: "Corporate training",
      strength: "Advanced",
      summary:
        "Training systems, SME collaboration, and materials that support consistent delivery.",
      matches: [
        {
          role: "Contractor — Instructional Designer",
          company: "iCode / Intuit",
          proof: "Course projects with manuals, CBT, storyboards, and clear scope control.",
        },
        {
          role: "Video Editor, Graphic Artist & E-Learning Designer",
          company: "ProPricer",
          proof: "Training videos and product media for national customer communication.",
        },
      ],
    },
  ],
} as const;

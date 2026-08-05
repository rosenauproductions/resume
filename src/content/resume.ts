/**
 * Edit this file to update resume copy.
 * Portraits live in /public/images.
 */

export const site = {
  name: "Chris Rosenau",
  title: "Instructional Media Specialist",
  subtitle: "Medical Sales College · E-Learning Professional",
  location: "Dallas, Texas",
  email: "rosenauproductions@gmail.com",
  phone: "945-217-2211",
  phoneHref: "tel:9452172211",
  linkedin: "https://www.linkedin.com/in/christopherrosenau",
  linkedinLabel: "linkedin.com/in/christopherrosenau",
  tagline:
    "I design learning experiences that move — interactive courses, training video, and media systems that scale.",
};

export const about = {
  heading: "About",
  paragraphs: [
    "At Medical Sales College, I contributed to migrating an in-person learning platform to a dynamic hybrid online format. I designed interactive courses using Articulate Rise & Storyline, built professional video content primarily with PowerPoint (my preferred tool for informative and training videos), managed Canvas LMS, and enhanced productions with Adobe Premiere and After Effects when needed.",
    "Previously, as Multimedia Director at Higher Ed Partners, I pioneered AI-driven avatar video using Synthesia. That approach dramatically improved content production efficiency and boosted learner engagement.",
    "I bring a strong combination of instructional design, creative video production, special effects, and technical skills — including Canvas administration. I’m currently open to new opportunities in instructional design, eLearning development, corporate training, or multimedia production.",
  ],
};

export const experience = [
  {
    role: "Instructional Design Specialist (Media)",
    company: "Medical Sales College",
    dates: "Feb 2024 – July 2026",
    location: "Remote",
    highlights: [
      "Spearheaded the transition from an in-person instructor-led platform to a hybrid online learning format, improving accessibility and flexibility for learners",
      "Converted Google Slides and PDFs into high-quality training materials — graphically enhanced and animated in PowerPoint into engaging learning videos",
      "Leveraged AI tools (Claude, ChatGPT, Grok, and others) alongside PowerPoint to rapidly produce professional learning videos",
      "Produced videos featuring remote instructor filming and created animated scenario-based content in Vyond to simulate real patient cycles of care",
      "Provided Canvas LMS administration, including custom programming enhancements, troubleshooting, and instructor support",
    ],
  },
  {
    role: "Multimedia Director & E-Learning Design",
    company: "Higher Ed Partners",
    dates: "May 2022 – Dec 2023",
    location: "Dallas, Texas",
    highlights: [
      "Spearheaded video template design in Synthesia, transitioning from traditional filming to AI avatar video for faster, more flexible production",
      "Implemented remote Rise content updates in Canvas via AWS/cloud hosting — eliminating repeated Canvas master propagations",
      "Authored CSS to improve iframe rendering of AWS-hosted content for a seamless learner experience",
      "Hosted all videos on Vimeo for parallel multimedia updates and consistent accessibility",
      "Collaborated on a JavaScript translation layer in Canvas so learners could view course content in their chosen language",
      "Mapped project process flows to surface gaps and strengthen delivery workflows",
    ],
  },
  {
    role: "Contractor — Instructional Designer",
    company: "iCode School Franchise / Intuit",
    dates: "Dec 2021 – May 2022",
    location: "",
    highlights: [
      "Managed course development from inception to completion using instructional design principles and the ADDIE model",
      "Determined and communicated project scope, requirements, goals, and timelines",
      "Designed Storyline templates and built web-based learning modules with multimedia and interactive objects",
      "Created original videos, graphics, instructor manuals, CBT modules, and storyboards with SME collaboration",
    ],
  },
  {
    role: "Video Editor, Graphic Artist & E-Learning Designer",
    company: "ProPricer",
    dates: "Jan 2001 – Dec 2021",
    location: "Bedford, Texas",
    highlights: [
      "Owned projects end-to-end: storyboarding, special effects, post-production, and final delivery formats",
      "Edited training videos for digital distribution — graphics, sound design, and music mix",
      "Produced the EBS Texas PR announcement video (script, drone/handheld filming, narration, edit, and deployment)",
      "Created magazine ads, conference print graphics, and interactive media including custom photo backgrounds",
    ],
  },
  {
    role: "E-Learning Designer",
    company: "Concordia University Irvine",
    dates: "Feb 2016 – Oct 2020",
    location: "Irvine, California",
    highlights: [
      "Created animated course graphics from scripts with audio narration and SRT subtitles (Vyond / After Effects)",
      "Assembled Storyline courses with Q&A feedback, flow control, and assessment results",
      "Delivered Eastern History (HST301): a 9-week animated series with custom character rigging and culturally resonant storytelling",
      "Managed project workflow and client change requests from script-to-screen",
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
      label: "AI & production",
      items: ["Claude / ChatGPT / Grok", "Remote instructor filming", "Vimeo hosting"],
    },
  ],
  meters: [
    { name: "Articulate Rise & Storyline", proficiency: "Expert", width: 95 },
    { name: "PowerPoint animation & video", proficiency: "Expert", width: 98 },
    { name: "Synthesia AI video", proficiency: "Expert", width: 90 },
    { name: "Canvas LMS", proficiency: "Advanced", width: 70 },
    { name: "Premiere / After Effects", proficiency: "Expert", width: 92 },
    { name: "Vyond / character animation", proficiency: "Expert", width: 92 },
  ],
};

/** Network / constellation view for Skills toggle (coords in 0–100 space) */
export const skillsNetwork = {
  nodes: [
    { id: "core", label: "Learning\nmedia", kind: "hub", x: 50, y: 48 },
    { id: "id", label: "Instructional\ndesign", kind: "hub", x: 22, y: 28 },
    { id: "lms", label: "LMS &\ndelivery", kind: "hub", x: 78, y: 28 },
    { id: "video", label: "Video &\nanimation", kind: "hub", x: 22, y: 72 },
    { id: "ai", label: "AI &\nproduction", kind: "hub", x: 78, y: 72 },
    { id: "rise", label: "Rise", kind: "skill", x: 10, y: 14 },
    { id: "storyline", label: "Storyline", kind: "skill", x: 28, y: 12 },
    { id: "addie", label: "ADDIE", kind: "skill", x: 14, y: 40 },
    { id: "canvas", label: "Canvas", kind: "skill", x: 90, y: 16 },
    { id: "aws", label: "AWS Rise", kind: "skill", x: 86, y: 40 },
    { id: "css", label: "CSS / JS", kind: "skill", x: 68, y: 14 },
    { id: "ppt", label: "PPT video", kind: "skill", x: 8, y: 62 },
    { id: "vyond", label: "Vyond", kind: "skill", x: 12, y: 86 },
    { id: "ae", label: "AE / Premiere", kind: "skill", x: 32, y: 88 },
    { id: "synthesia", label: "Synthesia", kind: "skill", x: 92, y: 62 },
    { id: "llm", label: "AI tools", kind: "skill", x: 88, y: 88 },
    { id: "hybrid", label: "Hybrid\nmigration", kind: "duty", x: 50, y: 16 },
    { id: "sme", label: "SME\ncollab", kind: "duty", x: 50, y: 84 },
    { id: "templates", label: "Templates\n& scale", kind: "duty", x: 62, y: 50 },
    { id: "assess", label: "Assessments", kind: "duty", x: 38, y: 50 },
  ],
  edges: [
    ["core", "id"],
    ["core", "lms"],
    ["core", "video"],
    ["core", "ai"],
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
    ["video", "ppt"],
    ["video", "vyond"],
    ["video", "ae"],
    ["video", "sme"],
    ["ai", "synthesia"],
    ["ai", "llm"],
    ["ai", "templates"],
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

/** Selected work — video reel + looping demo */
export const work = {
  heading: "Selected work",
  note: "A look at past courses, video, and learning media.",
  portfolioVideo: {
    href: "https://www.youtube.com/watch?v=ja7QZxXej7w",
    embed: "https://www.youtube.com/embed/ja7QZxXej7w",
    label: "Watch portfolio reel",
    detail: "2-year portfolio overview",
  },
  demoGif: {
    src: "/images/work-diagnostic-scope.mp4",
    title: "PPT Animation Samples",
    detail: "",
  },
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
  note: "Select what you’re hiring for. I’ll map it to the roles and proof points that match.",
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

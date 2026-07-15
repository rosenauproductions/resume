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

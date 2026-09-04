/** Editable resume CMS document (stored in site_settings). */

export type ResumeSectionId =
  | "hero"
  | "about"
  | "experience"
  | "work"
  | "projects"
  | "skills"
  | "fit"
  | "contact";

export const RESUME_SECTION_IDS: ResumeSectionId[] = [
  "hero",
  "about",
  "experience",
  "work",
  "projects",
  "skills",
  "fit",
  "contact",
];

export const RESUME_SECTION_LABELS: Record<ResumeSectionId, string> = {
  hero: "Hero",
  about: "About",
  experience: "Experience",
  work: "Selected work",
  projects: "Side projects",
  skills: "Skills & tools",
  fit: "Role fit",
  contact: "Contact",
};

export type ResumeSite = {
  name: string;
  title: string;
  subtitle: string;
  location: string;
  email: string;
  phone: string;
  phoneHref: string;
  linkedin: string;
  linkedinLabel: string;
  tagline: string;
};

export type ResumePortraits = {
  hero: string;
  rim: string;
  side: string;
  close: string;
  texture: string;
};

export type ExperienceJob = {
  id: string;
  enabled: boolean;
  role: string;
  company: string;
  dates: string;
  location: string;
  highlights: string[];
};

export type WorkFeatured = {
  id: string;
  enabled: boolean;
  kind: "youtube" | "video";
  href?: string;
  embed?: string;
  src?: string;
  label: string;
  detail: string;
};

export type WorkCase = {
  id: string;
  enabled: boolean;
  title: string;
  detail: string;
  tag: string;
};

export type SideProject = {
  id: string;
  enabled: boolean;
  title: string;
  summary: string;
  href: string;
  linkLabel: string;
  tags: string[];
};

export type SkillGroup = {
  id: string;
  enabled: boolean;
  label: string;
  items: string[];
};

export type SkillMeter = {
  id: string;
  enabled: boolean;
  name: string;
  proficiency: string;
  width: number;
};

export type EducationItem = {
  id: string;
  enabled: boolean;
  school: string;
  detail: string;
  dates: string;
};

export type RoleFitMatch = {
  role: string;
  company: string;
  proof: string;
};

export type RoleFitNeed = {
  id: string;
  enabled: boolean;
  label: string;
  strength: string;
  summary: string;
  matches: RoleFitMatch[];
};

export type ResumeSectionMeta = {
  enabled: boolean;
  /** Optional override for nav label */
  navLabel: string;
};

export type ResumeContent = {
  version: 1;
  /** Visual theme for the public resume site */
  theme: ResumeThemeId;
  site: ResumeSite;
  portraits: ResumePortraits;
  sectionOrder: ResumeSectionId[];
  sections: Record<ResumeSectionId, ResumeSectionMeta>;
  about: {
    heading: string;
    lead: string;
    paragraphs: string[];
  };
  experience: ExperienceJob[];
  work: {
    heading: string;
    note: string;
    featured: WorkFeatured[];
    cases: WorkCase[];
  };
  sideProjects: {
    heading: string;
    note: string;
    projects: SideProject[];
  };
  skills: {
    heading: string;
    top: string[];
    groups: SkillGroup[];
    also: { label: string; note: string; items: string[] };
    meters: SkillMeter[];
  };
  education: EducationItem[];
  certifications: { id: string; enabled: boolean; label: string }[];
  roleFit: {
    heading: string;
    note: string;
    needs: RoleFitNeed[];
  };
};

export type ResumeThemeId = "dark" | "light" | "ocean" | "warm" | "forest" | "slate";

export const RESUME_THEMES: {
  id: ResumeThemeId;
  label: string;
  hint: string;
}[] = [
  { id: "dark", label: "Dark teal", hint: "Current default" },
  { id: "light", label: "Light", hint: "Cream paper, dark type" },
  { id: "ocean", label: "Ocean", hint: "Deep blue + cyan" },
  { id: "warm", label: "Warm night", hint: "Charcoal + amber" },
  { id: "forest", label: "Forest", hint: "Ink + moss green" },
  { id: "slate", label: "Slate", hint: "Cool gray + steel" },
];

export function isResumeThemeId(value: unknown): value is ResumeThemeId {
  return (
    value === "dark" ||
    value === "light" ||
    value === "ocean" ||
    value === "warm" ||
    value === "forest" ||
    value === "slate"
  );
}

export function newId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}`;
}

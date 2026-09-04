import {
  about as aboutStatic,
  certifications as certificationsStatic,
  education as educationStatic,
  experience as experienceStatic,
  portraits as portraitsStatic,
  roleFit as roleFitStatic,
  sideProjects as sideProjectsStatic,
  site as siteStatic,
  skills as skillsStatic,
  work as workStatic,
} from "@/content/resume";
import {
  newId,
  RESUME_SECTION_IDS,
  isResumeThemeId,
  type ResumeContent,
  type ResumeSectionId,
} from "./types";

function defaultSections(): ResumeContent["sections"] {
  const sections = {} as ResumeContent["sections"];
  for (const id of RESUME_SECTION_IDS) {
    sections[id] = {
      enabled: id === "skills" ? false : true,
      navLabel: "",
    };
  }
  return sections;
}

/** Build editable CMS document from the static resume.ts seed. */
export function buildDefaultResumeContent(): ResumeContent {
  const projects = sideProjectsStatic.projects.map((p) => ({
    id: newId("proj"),
    enabled: true,
    title: p.title,
    summary: p.summary,
    href: p.href,
    linkLabel: p.linkLabel,
    tags: [...p.tags],
  }));

  return {
    version: 1,
    theme: "dark",
    site: { ...siteStatic },
    portraits: { ...portraitsStatic },
    sectionOrder: [...RESUME_SECTION_IDS],
    sections: defaultSections(),
    about: {
      heading: aboutStatic.heading,
      lead: aboutStatic.lead,
      paragraphs: [...aboutStatic.paragraphs],
    },
    experience: experienceStatic.map((job) => ({
      id: newId("job"),
      enabled: true,
      role: job.role,
      company: job.company,
      dates: job.dates,
      location: job.location,
      highlights: [...job.highlights],
    })),
    work: {
      heading: workStatic.heading,
      note: workStatic.note,
      featured: workStatic.featured.map((f) => ({
        id: newId("feat"),
        enabled: true,
        kind: f.kind,
        href: "href" in f ? f.href : undefined,
        embed: "embed" in f ? f.embed : undefined,
        src: "src" in f ? f.src : undefined,
        label: f.label,
        detail: f.detail,
      })),
      cases: workStatic.cases.map((c) => ({
        id: newId("case"),
        enabled: true,
        title: c.title,
        detail: c.detail,
        tag: c.tag,
      })),
    },
    sideProjects: {
      heading: sideProjectsStatic.heading,
      note: sideProjectsStatic.note,
      projects,
    },
    skills: {
      heading: skillsStatic.heading,
      top: [...skillsStatic.top],
      groups: skillsStatic.groups.map((g) => ({
        id: newId("sg"),
        enabled: true,
        label: g.label,
        items: [...g.items],
      })),
      also: {
        label: skillsStatic.also.label,
        note: skillsStatic.also.note,
        items: [...skillsStatic.also.items],
      },
      meters: skillsStatic.meters.map((m) => ({
        id: newId("meter"),
        enabled: true,
        name: m.name,
        proficiency: m.proficiency,
        width: m.width,
      })),
    },
    education: educationStatic.map((e) => ({
      id: newId("edu"),
      enabled: true,
      school: e.school,
      detail: e.detail,
      dates: e.dates,
    })),
    certifications: certificationsStatic.map((label) => ({
      id: newId("cert"),
      enabled: true,
      label,
    })),
    roleFit: {
      heading: roleFitStatic.heading,
      note: roleFitStatic.note,
      needs: roleFitStatic.needs.map((n) => ({
        id: n.id,
        enabled: true,
        label: n.label,
        strength: n.strength,
        summary: n.summary,
        matches: n.matches.map((m) => {
          const project =
            m.company === "Side project"
              ? projects.find((p) => p.title === m.role)
              : undefined;
          return {
            role: m.role,
            company: m.company,
            proof: m.proof,
            ...(project ? { projectId: project.id } : {}),
          };
        }),
      })),
    },
  };
}

export function isResumeSectionId(value: string): value is ResumeSectionId {
  return (RESUME_SECTION_IDS as string[]).includes(value);
}

/** Normalize / repair a stored document against defaults. */
export function normalizeResumeContent(raw: unknown): ResumeContent {
  const fallback = buildDefaultResumeContent();
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Partial<ResumeContent>;

  const sectionOrder = Array.isArray(o.sectionOrder)
    ? o.sectionOrder.filter(isResumeSectionId)
    : fallback.sectionOrder;
  const order =
    sectionOrder.length === RESUME_SECTION_IDS.length
      ? sectionOrder
      : [
          ...sectionOrder,
          ...RESUME_SECTION_IDS.filter((id) => !sectionOrder.includes(id)),
        ];

  const sections = { ...fallback.sections };
  if (o.sections && typeof o.sections === "object") {
    for (const id of RESUME_SECTION_IDS) {
      const s = (o.sections as Record<string, unknown>)[id];
      if (s && typeof s === "object") {
        const meta = s as { enabled?: unknown; navLabel?: unknown };
        sections[id] = {
          enabled: Boolean(meta.enabled ?? fallback.sections[id].enabled),
          navLabel: typeof meta.navLabel === "string" ? meta.navLabel : "",
        };
      }
    }
  }

  return {
    version: 1,
    theme: isResumeThemeId(o.theme) ? o.theme : fallback.theme,
    site: { ...fallback.site, ...(o.site || {}) },
    portraits: { ...fallback.portraits, ...(o.portraits || {}) },
    sectionOrder: order,
    sections,
    about: {
      heading: o.about?.heading ?? fallback.about.heading,
      lead: o.about?.lead ?? fallback.about.lead,
      paragraphs: Array.isArray(o.about?.paragraphs)
        ? o.about!.paragraphs.map(String)
        : fallback.about.paragraphs,
    },
    experience: Array.isArray(o.experience)
      ? o.experience.map((job, i) => ({
          id: job.id || newId("job"),
          enabled: job.enabled !== false,
          role: String(job.role ?? ""),
          company: String(job.company ?? ""),
          dates: String(job.dates ?? ""),
          location: String(job.location ?? ""),
          highlights: Array.isArray(job.highlights)
            ? job.highlights.map(String)
            : fallback.experience[i]?.highlights ?? [],
        }))
      : fallback.experience,
    work: {
      heading: o.work?.heading ?? fallback.work.heading,
      note: o.work?.note ?? fallback.work.note,
      featured: Array.isArray(o.work?.featured)
        ? o.work!.featured.map((f) => ({
            id: f.id || newId("feat"),
            enabled: f.enabled !== false,
            kind: f.kind === "video" ? "video" : "youtube",
            href: f.href,
            embed: f.embed,
            src: f.src,
            label: String(f.label ?? ""),
            detail: String(f.detail ?? ""),
          }))
        : fallback.work.featured,
      cases: Array.isArray(o.work?.cases)
        ? o.work!.cases.map((c) => ({
            id: c.id || newId("case"),
            enabled: c.enabled !== false,
            title: String(c.title ?? ""),
            detail: String(c.detail ?? ""),
            tag: String(c.tag ?? ""),
          }))
        : fallback.work.cases,
    },
    sideProjects: {
      heading: o.sideProjects?.heading ?? fallback.sideProjects.heading,
      note: o.sideProjects?.note ?? fallback.sideProjects.note,
      projects: Array.isArray(o.sideProjects?.projects)
        ? o.sideProjects!.projects.map((p) => ({
            id: p.id || newId("proj"),
            enabled: p.enabled !== false,
            title: String(p.title ?? ""),
            summary: String(p.summary ?? ""),
            href: String(p.href ?? ""),
            linkLabel: String(p.linkLabel ?? "Link"),
            tags: Array.isArray(p.tags) ? p.tags.map(String) : [],
          }))
        : fallback.sideProjects.projects,
    },
    skills: {
      heading: o.skills?.heading ?? fallback.skills.heading,
      top: Array.isArray(o.skills?.top) ? o.skills!.top.map(String) : fallback.skills.top,
      groups: Array.isArray(o.skills?.groups)
        ? o.skills!.groups.map((g) => ({
            id: g.id || newId("sg"),
            enabled: g.enabled !== false,
            label: String(g.label ?? ""),
            items: Array.isArray(g.items) ? g.items.map(String) : [],
          }))
        : fallback.skills.groups,
      also: {
        label: o.skills?.also?.label ?? fallback.skills.also.label,
        note: o.skills?.also?.note ?? fallback.skills.also.note,
        items: Array.isArray(o.skills?.also?.items)
          ? o.skills!.also!.items.map(String)
          : fallback.skills.also.items,
      },
      meters: Array.isArray(o.skills?.meters)
        ? o.skills!.meters.map((m) => ({
            id: m.id || newId("meter"),
            enabled: m.enabled !== false,
            name: String(m.name ?? ""),
            proficiency: String(m.proficiency ?? ""),
            width: Number(m.width) || 50,
          }))
        : fallback.skills.meters,
    },
    education: Array.isArray(o.education)
      ? o.education.map((e) => ({
          id: e.id || newId("edu"),
          enabled: e.enabled !== false,
          school: String(e.school ?? ""),
          detail: String(e.detail ?? ""),
          dates: String(e.dates ?? ""),
        }))
      : fallback.education,
    certifications: Array.isArray(o.certifications)
      ? o.certifications.map((c) =>
          typeof c === "string"
            ? { id: newId("cert"), enabled: true, label: c }
            : {
                id: c.id || newId("cert"),
                enabled: c.enabled !== false,
                label: String(c.label ?? ""),
              },
        )
      : fallback.certifications,
    roleFit: {
      heading: o.roleFit?.heading ?? fallback.roleFit.heading,
      note: o.roleFit?.note ?? fallback.roleFit.note,
      needs: Array.isArray(o.roleFit?.needs)
        ? o.roleFit!.needs.map((n) => ({
            id: n.id || newId("need"),
            enabled: n.enabled !== false,
            label: String(n.label ?? ""),
            strength: String(n.strength ?? ""),
            summary: String(n.summary ?? ""),
            matches: Array.isArray(n.matches)
              ? n.matches.map((m) => {
                  const projectId =
                    typeof m.projectId === "string" && m.projectId.trim()
                      ? m.projectId.trim()
                      : undefined;
                  return {
                    role: String(m.role ?? ""),
                    company: String(m.company ?? ""),
                    proof: String(m.proof ?? ""),
                    ...(projectId ? { projectId } : {}),
                  };
                })
              : [],
          }))
        : fallback.roleFit.needs,
    },
  };
}

"use client";

import { useState, type ReactNode } from "react";
import {
  newId,
  RESUME_SECTION_LABELS,
  type ExperienceJob,
  type ResumeContent,
  type ResumeSectionId,
  type ResumeSite,
  type RoleFitNeed,
  type SideProject,
  type SkillGroup,
  type SkillMeter,
  type WorkCase,
  type WorkFeatured,
} from "@/lib/resume/types";

const fieldClass =
  "mt-1 w-full rounded-lg border border-white/12 bg-black/35 px-3 py-2 text-sm text-[var(--cream)]";
const btnGhost =
  "rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-[var(--muted)] hover:border-white/25 hover:text-[var(--cream)] disabled:opacity-40";
const btnAccent =
  "rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-3 py-1.5 text-xs font-medium text-[var(--cream)] hover:bg-[var(--accent)]/25 disabled:opacity-50";

type Props = {
  content: ResumeContent;
  onChange: (next: ResumeContent) => void;
  onSave: () => void;
  onReset: () => void;
  onClose?: () => void;
  saving?: boolean;
  notice?: string;
};

function Label({ children }: { children: ReactNode }) {
  return <label className="block text-xs text-[var(--muted)]">{children}</label>;
}

function Text({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <Label>
      {label}
      <input type={type} className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </Label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <Label>
      {label}
      <textarea
        className={`${fieldClass} resize-y`}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Label>
  );
}

function ListEditor({
  label,
  items,
  onChange,
  placeholder = "Item",
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--muted)]">{label}</span>
        <button type="button" className={btnGhost} onClick={() => onChange([...items, ""])}>
          Add
        </button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            className={`${fieldClass} !mt-0`}
            value={item}
            placeholder={placeholder}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <button type="button" className={btnGhost} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function moveItem<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

function parseList(v: string) {
  return v
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function NestedCard({
  title,
  enabled,
  onEnabled,
  onRemove,
  onUp,
  onDown,
  canUp,
  canDown,
  children,
}: {
  title: string;
  enabled: boolean;
  onEnabled: (v: boolean) => void;
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
  canUp?: boolean;
  canDown?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-[var(--cream)]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabled(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          {title}
        </label>
        {onUp ? (
          <button type="button" className={btnGhost} disabled={!canUp} onClick={onUp}>
            ↑
          </button>
        ) : null}
        {onDown ? (
          <button type="button" className={btnGhost} disabled={!canDown} onClick={onDown}>
            ↓
          </button>
        ) : null}
        <button type="button" className={`${btnGhost} ml-auto`} onClick={onRemove}>
          Remove
        </button>
      </div>
      {children}
    </div>
  );
}

function SectionShell({
  id,
  label,
  enabled,
  navLabel,
  expanded,
  canUp,
  canDown,
  onToggleEnabled,
  onNavLabel,
  onExpand,
  onMove,
  children,
}: {
  id: ResumeSectionId;
  label: string;
  enabled: boolean;
  navLabel: string;
  expanded: boolean;
  canUp: boolean;
  canDown: boolean;
  onToggleEnabled: (v: boolean) => void;
  onNavLabel: (v: string) => void;
  onExpand: () => void;
  onMove: (dir: -1 | 1) => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[var(--panel)]" data-section={id}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
        <div className="flex gap-1">
          <button type="button" className={btnGhost} disabled={!canUp} onClick={() => onMove(-1)} aria-label="Move up">
            ↑
          </button>
          <button type="button" className={btnGhost} disabled={!canDown} onClick={() => onMove(1)} aria-label="Move down">
            ↓
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--cream)]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggleEnabled(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          {label}
        </label>
        <button type="button" className={`${btnGhost} ml-auto`} onClick={onExpand}>
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      {expanded ? (
        <div className="space-y-4 p-4">
          <Text label="Nav label (optional)" value={navLabel} onChange={onNavLabel} />
          {children}
        </div>
      ) : null}
    </section>
  );
}

function SiteFields({
  site,
  portraits,
  showPortraits,
  onSite,
  onPortraits,
}: {
  site: ResumeSite;
  portraits: ResumeContent["portraits"];
  showPortraits?: boolean;
  onSite: (patch: Partial<ResumeSite>) => void;
  onPortraits?: (patch: Partial<ResumeContent["portraits"]>) => void;
}) {
  const set = (key: keyof ResumeSite) => (v: string) => onSite({ [key]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Text label="Name" value={site.name} onChange={set("name")} />
      <Text label="Title" value={site.title} onChange={set("title")} />
      <Text label="Subtitle" value={site.subtitle} onChange={set("subtitle")} />
      <Text label="Location" value={site.location} onChange={set("location")} />
      <Text label="Email" value={site.email} onChange={set("email")} />
      <Text label="Phone" value={site.phone} onChange={set("phone")} />
      <Text label="Phone href" value={site.phoneHref} onChange={set("phoneHref")} />
      <Text label="LinkedIn URL" value={site.linkedin} onChange={set("linkedin")} />
      <Text label="LinkedIn label" value={site.linkedinLabel} onChange={set("linkedinLabel")} />
      <Text label="Tagline" value={site.tagline} onChange={set("tagline")} />
      {showPortraits && onPortraits
        ? (["hero", "rim", "side", "close", "texture"] as const).map((key) => (
            <Text
              key={key}
              label={`Portrait: ${key}`}
              value={portraits[key]}
              onChange={(v) => onPortraits({ [key]: v })}
            />
          ))
        : null}
    </div>
  );
}

function ExperienceEditor({ jobs, onChange }: { jobs: ExperienceJob[]; onChange: (n: ExperienceJob[]) => void }) {
  const patch = (i: number, partial: Partial<ExperienceJob>) => {
    const next = [...jobs];
    next[i] = { ...next[i], ...partial };
    onChange(next);
  };
  return (
    <div className="space-y-4">
      {jobs.map((job, i) => (
        <NestedCard
          key={job.id}
          title={`Job ${i + 1}`}
          enabled={job.enabled}
          onEnabled={(enabled) => patch(i, { enabled })}
          onRemove={() => onChange(jobs.filter((_, j) => j !== i))}
          onUp={() => onChange(moveItem(jobs, i, -1))}
          onDown={() => onChange(moveItem(jobs, i, 1))}
          canUp={i > 0}
          canDown={i < jobs.length - 1}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Role" value={job.role} onChange={(v) => patch(i, { role: v })} />
            <Text label="Company" value={job.company} onChange={(v) => patch(i, { company: v })} />
            <Text label="Dates" value={job.dates} onChange={(v) => patch(i, { dates: v })} />
            <Text label="Location" value={job.location} onChange={(v) => patch(i, { location: v })} />
          </div>
          <ListEditor
            label="Highlights"
            items={job.highlights}
            onChange={(highlights) => patch(i, { highlights })}
            placeholder="Highlight"
          />
        </NestedCard>
      ))}
      <button
        type="button"
        className={btnAccent}
        onClick={() =>
          onChange([
            ...jobs,
            { id: newId("job"), enabled: true, role: "", company: "", dates: "", location: "", highlights: [] },
          ])
        }
      >
        Add job
      </button>
    </div>
  );
}

function WorkEditor({
  work,
  onChange,
}: {
  work: ResumeContent["work"];
  onChange: (n: ResumeContent["work"]) => void;
}) {
  const patchFeatured = (i: number, partial: Partial<WorkFeatured>) => {
    const featured = [...work.featured];
    featured[i] = { ...featured[i], ...partial };
    onChange({ ...work, featured });
  };
  const patchCase = (i: number, partial: Partial<WorkCase>) => {
    const cases = [...work.cases];
    cases[i] = { ...cases[i], ...partial };
    onChange({ ...work, cases });
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Text label="Heading" value={work.heading} onChange={(v) => onChange({ ...work, heading: v })} />
        <Text label="Note" value={work.note} onChange={(v) => onChange({ ...work, note: v })} />
      </div>
      <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Featured</p>
      {work.featured.map((f, i) => (
        <NestedCard
          key={f.id}
          title={`Featured ${i + 1}`}
          enabled={f.enabled}
          onEnabled={(enabled) => patchFeatured(i, { enabled })}
          onRemove={() => onChange({ ...work, featured: work.featured.filter((_, j) => j !== i) })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Label>
              Kind
              <select
                className={fieldClass}
                value={f.kind}
                onChange={(e) => patchFeatured(i, { kind: e.target.value as "youtube" | "video" })}
              >
                <option value="youtube">youtube</option>
                <option value="video">video</option>
              </select>
            </Label>
            <Text label="Label" value={f.label} onChange={(v) => patchFeatured(i, { label: v })} />
            <Text label="Detail" value={f.detail} onChange={(v) => patchFeatured(i, { detail: v })} />
            <Text label="Href" value={f.href ?? ""} onChange={(v) => patchFeatured(i, { href: v })} />
            <Text label="Embed" value={f.embed ?? ""} onChange={(v) => patchFeatured(i, { embed: v })} />
            <Text label="Src" value={f.src ?? ""} onChange={(v) => patchFeatured(i, { src: v })} />
          </div>
        </NestedCard>
      ))}
      <button
        type="button"
        className={btnAccent}
        onClick={() =>
          onChange({
            ...work,
            featured: [
              ...work.featured,
              { id: newId("feat"), enabled: true, kind: "youtube", label: "", detail: "", href: "", embed: "", src: "" },
            ],
          })
        }
      >
        Add featured
      </button>
      <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Cases</p>
      {work.cases.map((c, i) => (
        <NestedCard
          key={c.id}
          title={`Case ${i + 1}`}
          enabled={c.enabled}
          onEnabled={(enabled) => patchCase(i, { enabled })}
          onRemove={() => onChange({ ...work, cases: work.cases.filter((_, j) => j !== i) })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Title" value={c.title} onChange={(v) => patchCase(i, { title: v })} />
            <Text label="Tag" value={c.tag} onChange={(v) => patchCase(i, { tag: v })} />
            <div className="sm:col-span-2">
              <TextArea label="Detail" value={c.detail} onChange={(v) => patchCase(i, { detail: v })} />
            </div>
          </div>
        </NestedCard>
      ))}
      <button
        type="button"
        className={btnAccent}
        onClick={() =>
          onChange({
            ...work,
            cases: [...work.cases, { id: newId("case"), enabled: true, title: "", detail: "", tag: "" }],
          })
        }
      >
        Add case
      </button>
    </div>
  );
}

function ProjectsEditor({
  sideProjects,
  onChange,
}: {
  sideProjects: ResumeContent["sideProjects"];
  onChange: (n: ResumeContent["sideProjects"]) => void;
}) {
  const patch = (i: number, partial: Partial<SideProject>) => {
    const projects = [...sideProjects.projects];
    projects[i] = { ...projects[i], ...partial };
    onChange({ ...sideProjects, projects });
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Text label="Heading" value={sideProjects.heading} onChange={(v) => onChange({ ...sideProjects, heading: v })} />
        <Text label="Note" value={sideProjects.note} onChange={(v) => onChange({ ...sideProjects, note: v })} />
      </div>
      {sideProjects.projects.map((p, i) => (
        <NestedCard
          key={p.id}
          title={`Project ${i + 1}`}
          enabled={p.enabled}
          onEnabled={(enabled) => patch(i, { enabled })}
          onRemove={() => onChange({ ...sideProjects, projects: sideProjects.projects.filter((_, j) => j !== i) })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Text label="Title" value={p.title} onChange={(v) => patch(i, { title: v })} />
            <Text label="Link label" value={p.linkLabel} onChange={(v) => patch(i, { linkLabel: v })} />
            <Text label="Href" value={p.href} onChange={(v) => patch(i, { href: v })} />
            <Text
              label="Tags (comma-separated)"
              value={p.tags.join(", ")}
              onChange={(v) => patch(i, { tags: parseList(v) })}
            />
            <div className="sm:col-span-2">
              <TextArea label="Summary" value={p.summary} onChange={(v) => patch(i, { summary: v })} />
            </div>
          </div>
        </NestedCard>
      ))}
      <button
        type="button"
        className={btnAccent}
        onClick={() =>
          onChange({
            ...sideProjects,
            projects: [
              ...sideProjects.projects,
              { id: newId("proj"), enabled: true, title: "", summary: "", href: "", linkLabel: "", tags: [] },
            ],
          })
        }
      >
        Add project
      </button>
    </div>
  );
}

function SkillsEditor({
  skills,
  onChange,
}: {
  skills: ResumeContent["skills"];
  onChange: (n: ResumeContent["skills"]) => void;
}) {
  const patchGroup = (i: number, partial: Partial<SkillGroup>) => {
    const groups = [...skills.groups];
    groups[i] = { ...groups[i], ...partial };
    onChange({ ...skills, groups });
  };
  const patchMeter = (i: number, partial: Partial<SkillMeter>) => {
    const meters = [...skills.meters];
    meters[i] = { ...meters[i], ...partial };
    onChange({ ...skills, meters });
  };
  return (
    <div className="space-y-5">
      <Text label="Heading" value={skills.heading} onChange={(v) => onChange({ ...skills, heading: v })} />
      <Text
        label="Top skills (comma-separated)"
        value={skills.top.join(", ")}
        onChange={(v) => onChange({ ...skills, top: parseList(v) })}
      />
      <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Groups</p>
      {skills.groups.map((g, i) => (
        <NestedCard
          key={g.id}
          title="Group"
          enabled={g.enabled}
          onEnabled={(enabled) => patchGroup(i, { enabled })}
          onRemove={() => onChange({ ...skills, groups: skills.groups.filter((_, j) => j !== i) })}
        >
          <Text label="Label" value={g.label} onChange={(v) => patchGroup(i, { label: v })} />
          <TextArea
            label="Items (newline or comma)"
            value={g.items.join("\n")}
            onChange={(v) => patchGroup(i, { items: parseList(v) })}
          />
        </NestedCard>
      ))}
      <button
        type="button"
        className={btnAccent}
        onClick={() =>
          onChange({
            ...skills,
            groups: [...skills.groups, { id: newId("sg"), enabled: true, label: "", items: [] }],
          })
        }
      >
        Add group
      </button>
      <div className="grid gap-3 sm:grid-cols-2">
        <Text
          label="Also label"
          value={skills.also.label}
          onChange={(v) => onChange({ ...skills, also: { ...skills.also, label: v } })}
        />
        <Text
          label="Also note"
          value={skills.also.note}
          onChange={(v) => onChange({ ...skills, also: { ...skills.also, note: v } })}
        />
        <div className="sm:col-span-2">
          <TextArea
            label="Also items (newline or comma)"
            value={skills.also.items.join("\n")}
            onChange={(v) => onChange({ ...skills, also: { ...skills.also, items: parseList(v) } })}
          />
        </div>
      </div>
      <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Meters</p>
      {skills.meters.map((m, i) => (
        <NestedCard
          key={m.id}
          title="Meter"
          enabled={m.enabled}
          onEnabled={(enabled) => patchMeter(i, { enabled })}
          onRemove={() => onChange({ ...skills, meters: skills.meters.filter((_, j) => j !== i) })}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Text label="Name" value={m.name} onChange={(v) => patchMeter(i, { name: v })} />
            <Text label="Proficiency" value={m.proficiency} onChange={(v) => patchMeter(i, { proficiency: v })} />
            <Text
              label="Width"
              type="number"
              value={String(m.width)}
              onChange={(v) => patchMeter(i, { width: Number(v) || 0 })}
            />
          </div>
        </NestedCard>
      ))}
      <button
        type="button"
        className={btnAccent}
        onClick={() =>
          onChange({
            ...skills,
            meters: [...skills.meters, { id: newId("meter"), enabled: true, name: "", proficiency: "", width: 50 }],
          })
        }
      >
        Add meter
      </button>
    </div>
  );
}

function FitEditor({
  roleFit,
  projects,
  onChange,
}: {
  roleFit: ResumeContent["roleFit"];
  projects: SideProject[];
  onChange: (n: ResumeContent["roleFit"]) => void;
}) {
  const enabledProjects = projects.filter((p) => p.enabled);
  const patchNeed = (i: number, partial: Partial<RoleFitNeed>) => {
    const needs = [...roleFit.needs];
    needs[i] = { ...needs[i], ...partial };
    onChange({ ...roleFit, needs });
  };

  function applyProject(needIndex: number, matchIndex: number, projectId: string) {
    const matches = [...roleFit.needs[needIndex].matches];
    if (!projectId) {
      matches[matchIndex] = {
        role: matches[matchIndex].role,
        company: matches[matchIndex].company,
        proof: matches[matchIndex].proof,
      };
      patchNeed(needIndex, { matches });
      return;
    }
    const project = enabledProjects.find((p) => p.id === projectId);
    if (!project) return;
    const prev = matches[matchIndex];
    matches[matchIndex] = {
      role: project.title,
      company: "Side project",
      proof: prev.proof?.trim() ? prev.proof : project.summary.slice(0, 160),
      projectId: project.id,
    };
    patchNeed(needIndex, { matches });
  }

  function addFromProject(needIndex: number, projectId: string) {
    const project = enabledProjects.find((p) => p.id === projectId);
    if (!project) return;
    const need = roleFit.needs[needIndex];
    patchNeed(needIndex, {
      matches: [
        ...need.matches,
        {
          role: project.title,
          company: "Side project",
          proof: project.summary.slice(0, 160),
          projectId: project.id,
        },
      ],
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Text label="Heading" value={roleFit.heading} onChange={(v) => onChange({ ...roleFit, heading: v })} />
        <Text label="Note" value={roleFit.note} onChange={(v) => onChange({ ...roleFit, note: v })} />
      </div>
      <p className="text-xs text-[var(--muted)]">
        Fit buttons appear in this order on the public resume. Rename with Button name; reorder with ↑ ↓.
      </p>
      {roleFit.needs.map((need, i) => (
        <NestedCard
          key={need.id}
          title={need.label.trim() ? need.label : `Fit button ${i + 1}`}
          enabled={need.enabled}
          onEnabled={(enabled) => patchNeed(i, { enabled })}
          onRemove={() => onChange({ ...roleFit, needs: roleFit.needs.filter((_, j) => j !== i) })}
          onUp={() => onChange({ ...roleFit, needs: moveItem(roleFit.needs, i, -1) })}
          onDown={() => onChange({ ...roleFit, needs: moveItem(roleFit.needs, i, 1) })}
          canUp={i > 0}
          canDown={i < roleFit.needs.length - 1}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Text
              label="Button name"
              value={need.label}
              onChange={(v) => patchNeed(i, { label: v })}
            />
            <Text label="Strength" value={need.strength} onChange={(v) => patchNeed(i, { strength: v })} />
            <div className="sm:col-span-2">
              <TextArea label="Summary" value={need.summary} onChange={(v) => patchNeed(i, { summary: v })} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[var(--muted)]">Matches</span>
              <div className="flex flex-wrap gap-2">
                {enabledProjects.length ? (
                  <select
                    className={`${fieldClass} mt-0 w-auto min-w-[12rem] py-1.5 text-xs`}
                    defaultValue=""
                    onChange={(e) => {
                      const id = e.target.value;
                      e.target.value = "";
                      if (id) addFromProject(i, id);
                    }}
                    aria-label="Add side project match"
                  >
                    <option value="">Add side project…</option>
                    {enabledProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => patchNeed(i, { matches: [...need.matches, { role: "", company: "", proof: "" }] })}
                >
                  Add match
                </button>
              </div>
            </div>
            {need.matches.map((m, mi) => (
              <div key={mi} className="space-y-2 rounded-lg border border-white/10 p-2">
                {enabledProjects.length ? (
                  <label className="block text-xs text-[var(--muted)]">
                    Side project
                    <select
                      className={fieldClass}
                      value={m.projectId ?? ""}
                      onChange={(e) => applyProject(i, mi, e.target.value)}
                    >
                      <option value="">None (job / custom)</option>
                      {enabledProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <Text
                    label="Role / title"
                    value={m.role}
                    onChange={(v) => {
                      const matches = [...need.matches];
                      matches[mi] = { ...matches[mi], role: v };
                      patchNeed(i, { matches });
                    }}
                  />
                  <Text
                    label="Company"
                    value={m.company}
                    onChange={(v) => {
                      const matches = [...need.matches];
                      matches[mi] = { ...matches[mi], company: v };
                      patchNeed(i, { matches });
                    }}
                  />
                  <Text
                    label="Proof"
                    value={m.proof}
                    onChange={(v) => {
                      const matches = [...need.matches];
                      matches[mi] = { ...matches[mi], proof: v };
                      patchNeed(i, { matches });
                    }}
                  />
                  <button
                    type="button"
                    className={`${btnGhost} self-end`}
                    onClick={() => patchNeed(i, { matches: need.matches.filter((_, j) => j !== mi) })}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </NestedCard>
      ))}
      <button
        type="button"
        className={btnAccent}
        onClick={() =>
          onChange({
            ...roleFit,
            needs: [
              ...roleFit.needs,
              { id: newId("need"), enabled: true, label: "", strength: "", summary: "", matches: [] },
            ],
          })
        }
      >
        Add fit button
      </button>
    </div>
  );
}

export function ResumeEditor({ content, onChange, onSave, onReset, onClose, saving, notice }: Props) {
  const [expanded, setExpanded] = useState<Partial<Record<ResumeSectionId, boolean>>>({});

  const setSite = (patch: Partial<ResumeSite>) => onChange({ ...content, site: { ...content.site, ...patch } });
  const setPortraits = (patch: Partial<ResumeContent["portraits"]>) =>
    onChange({ ...content, portraits: { ...content.portraits, ...patch } });
  const setMeta = (id: ResumeSectionId, patch: Partial<ResumeContent["sections"][ResumeSectionId]>) =>
    onChange({
      ...content,
      sections: { ...content.sections, [id]: { ...content.sections[id], ...patch } },
    });

  const renderBody = (id: ResumeSectionId) => {
    switch (id) {
      case "hero":
        return (
          <SiteFields
            site={content.site}
            portraits={content.portraits}
            showPortraits
            onSite={setSite}
            onPortraits={setPortraits}
          />
        );
      case "contact":
        return <SiteFields site={content.site} portraits={content.portraits} onSite={setSite} />;
      case "about":
        return (
          <div className="space-y-3">
            <Text
              label="Heading"
              value={content.about.heading}
              onChange={(v) => onChange({ ...content, about: { ...content.about, heading: v } })}
            />
            <TextArea
              label="Lead"
              value={content.about.lead}
              onChange={(v) => onChange({ ...content, about: { ...content.about, lead: v } })}
            />
            <ListEditor
              label="Paragraphs"
              items={content.about.paragraphs}
              onChange={(paragraphs) => onChange({ ...content, about: { ...content.about, paragraphs } })}
              placeholder="Paragraph"
            />
          </div>
        );
      case "experience":
        return (
          <ExperienceEditor jobs={content.experience} onChange={(experience) => onChange({ ...content, experience })} />
        );
      case "work":
        return <WorkEditor work={content.work} onChange={(work) => onChange({ ...content, work })} />;
      case "projects":
        return (
          <ProjectsEditor
            sideProjects={content.sideProjects}
            onChange={(sideProjects) => onChange({ ...content, sideProjects })}
          />
        );
      case "skills":
        return <SkillsEditor skills={content.skills} onChange={(skills) => onChange({ ...content, skills })} />;
      case "fit":
        return (
          <FitEditor
            roleFit={content.roleFit}
            projects={content.sideProjects.projects}
            onChange={(roleFit) => onChange({ ...content, roleFit })}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[var(--panel)] px-4 py-3">
        <h2 className="text-base font-medium text-[var(--cream)]">Resume content</h2>
        {notice ? <span className="text-xs text-[var(--muted)]">{notice}</span> : null}
        <div className="ml-auto flex flex-wrap gap-2">
          {onClose ? (
            <button type="button" className={btnGhost} onClick={onClose}>
              ← Back to pipeline
            </button>
          ) : null}
          <button type="button" className={btnGhost} onClick={onReset} disabled={saving}>
            Reset to defaults
          </button>
          <button type="button" className={btnAccent} onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {content.sectionOrder.map((id, index) => {
          const meta = content.sections[id];
          return (
            <SectionShell
              key={id}
              id={id}
              label={RESUME_SECTION_LABELS[id]}
              enabled={meta.enabled}
              navLabel={meta.navLabel}
              expanded={Boolean(expanded[id])}
              canUp={index > 0}
              canDown={index < content.sectionOrder.length - 1}
              onToggleEnabled={(enabled) => setMeta(id, { enabled })}
              onNavLabel={(navLabel) => setMeta(id, { navLabel })}
              onExpand={() => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))}
              onMove={(dir) => onChange({ ...content, sectionOrder: moveItem(content.sectionOrder, index, dir) })}
            >
              {renderBody(id)}
            </SectionShell>
          );
        })}
      </div>
    </div>
  );
}

import { Fragment } from "react";
import type { ResumeContent, ResumeLensId } from "@/lib/resume/types";

/**
 * Recruiter / ATS-friendly resume: one column, real text, no images or icons,
 * standard headings. Rendered by /print and used to build the static PDFs in
 * public/resume/. Pure component (no hooks) so scripts can render it too.
 */

export const PORTFOLIO_BASE = "https://resume-rho-taupe.vercel.app";

export function portfolioUrl(lens: ResumeLensId) {
  return lens === "ai" ? `${PORTFOLIO_BASE}/` : `${PORTFOLIO_BASE}/?lens=${lens}`;
}

export const RESUME_PDF_PATHS: Record<ResumeLensId, string> = {
  ai: "/resume/Chris-Rosenau-Resume-AI-Developer.pdf",
  media: "/resume/Chris-Rosenau-Resume-Learning-Media.pdf",
  ui: "/resume/Chris-Rosenau-Resume-UI-Design.pdf",
};

const PROJECT_HEADINGS: Record<ResumeLensId, string> = {
  ai: "Selected Software & AI Projects",
  media: "Selected Projects",
  ui: "Selected Design & Product Work",
};

function stripUrl(u: string) {
  return u.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Status tags ("Deployed", "Playable"...) read well; tech tags are covered by Skills. */
function statusTag(tags: string[]) {
  const t = tags[0] || "";
  return /deployed|production|playable|working|prototype|development|experimental|real families/i.test(t)
    ? t
    : "";
}

export function ResumeDocument({ content, lens }: { content: ResumeContent; lens: ResumeLensId }) {
  const { site } = content;
  const jobs = content.experience.filter((j) => j.enabled);
  const projects = content.sideProjects.projects
    .filter((p) => p.enabled)
    .slice(0, content.sideProjects.initialCount || (lens === "media" ? 4 : 5));
  const groups = content.skills.groups.filter((g) => g.enabled && g.items.length);
  const certs = content.certifications.filter((c) => c.enabled);
  const edu = content.education.filter((e) => e.enabled);
  const contact: { text: string; href?: string }[] = [
    { text: site.location },
    { text: site.phone, href: site.phoneHref || undefined },
    { text: site.email, href: site.email ? `mailto:${site.email}` : undefined },
    { text: site.linkedinLabel || stripUrl(site.linkedin), href: site.linkedin || undefined },
    { text: `Portfolio: ${stripUrl(portfolioUrl(lens))}`, href: portfolioUrl(lens) },
  ].filter((c) => c.text);

  return (
    <article className="rdoc">
      <header className="rdoc-head">
        <h1>{site.name}</h1>
        <p className="rdoc-title">{site.title}</p>
        <p className="rdoc-contact">
          {contact.map((c, i) => (
            <Fragment key={i}>
              {i ? " | " : null}
              <span className="rdoc-ci">{c.href ? <a href={c.href}>{c.text}</a> : c.text}</span>
            </Fragment>
          ))}
        </p>
      </header>

      <section>
        <h2>Summary</h2>
        <p>{site.tagline}</p>
        {site.openTo ? <p className="rdoc-muted">{site.openTo}</p> : null}
      </section>

      {groups.length ? (
        <section>
          <h2>Skills</h2>
          <ul className="rdoc-skills">
            {groups.map((g) => (
              <li key={g.id}>
                <strong>{g.label}:</strong> {g.items.join(", ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2>Experience</h2>
        {jobs.map((job) => (
          <div key={job.id} className="rdoc-job">
            <div className="rdoc-row">
              <h3>
                {job.role} <span className="rdoc-co">— {job.company}</span>
              </h3>
              <span className="rdoc-dates">
                {[job.dates, job.location].filter(Boolean).join(" · ")}
              </span>
            </div>
            <ul>
              {job.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {projects.length ? (
        <section>
          <h2>{PROJECT_HEADINGS[lens]}</h2>
          {projects.map((p) => {
            const status = statusTag(p.tags);
            return (
              <div key={p.id} className="rdoc-proj">
                <h3>
                  {p.title}
                  {status ? <span className="rdoc-co"> — {status}</span> : null}
                  {p.href ? (
                    <span className="rdoc-link">
                      {" · "}
                      <a href={p.href}>{stripUrl(p.href)}</a>
                    </span>
                  ) : null}
                </h3>
                <p>{p.summary}</p>
              </div>
            );
          })}
          <p className="rdoc-muted">
            More work, screenshots and demos: <a href={portfolioUrl(lens)}>{stripUrl(portfolioUrl(lens))}</a>
          </p>
        </section>
      ) : null}

      {certs.length || edu.length ? (
        <section>
          <h2>Education & Certifications</h2>
          <ul>
            {edu.map((e) => (
              <li key={e.id}>
                <strong>{e.school}</strong>
                {e.detail ? ` — ${e.detail}` : ""}
                {e.dates ? ` (${e.dates})` : ""}
              </li>
            ))}
            {certs.map((c) => (
              <li key={c.id}>{c.label}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

/** Styles for the document; screen preview looks like paper, print is Letter with margins. */
export const RESUME_DOC_CSS = `
.rdoc{font-family:Helvetica,Arial,"Liberation Sans",sans-serif;color:#111;font-size:10.2pt;line-height:1.38;max-width:7.5in;margin:0 auto;}
.rdoc h1{font-size:22pt;line-height:1.1;margin:0;letter-spacing:-0.01em;font-weight:700;}
.rdoc-title{font-size:12pt;margin:3pt 0 0;font-weight:600;color:#1f3a4d;}
.rdoc-contact{font-size:9pt;margin:4pt 0 0;color:#333;}
.rdoc-ci{white-space:nowrap;}
.rdoc a{color:inherit;text-decoration:none;}
.rdoc-link a{color:#1f3a4d;}
.rdoc-head{border-bottom:1.5pt solid #1f3a4d;padding-bottom:7pt;margin-bottom:6pt;}
.rdoc h2{font-size:10.5pt;text-transform:uppercase;letter-spacing:0.08em;color:#1f3a4d;margin:11pt 0 4pt;padding-bottom:2pt;border-bottom:0.6pt solid #c9d3db;font-weight:700;}
.rdoc h3{font-size:10.4pt;margin:0;font-weight:700;}
.rdoc p{margin:0 0 3pt;}
.rdoc ul{margin:2pt 0 0;padding-left:13pt;}
.rdoc li{margin:0 0 1.8pt;}
.rdoc-skills{list-style:none;padding-left:0 !important;}
.rdoc-co{font-weight:400;}
.rdoc-link{font-weight:400;color:#1f3a4d;}
.rdoc-row{display:flex;justify-content:space-between;align-items:baseline;gap:10pt;}
.rdoc-dates{font-size:9pt;color:#444;white-space:nowrap;}
.rdoc-job{margin:0 0 6pt;break-inside:avoid;}
.rdoc-proj{margin:0 0 5pt;break-inside:avoid;}
.rdoc-muted{color:#444;font-size:9.4pt;}
.rdoc section{break-inside:auto;}
.rdoc h2{break-after:avoid;}
`;

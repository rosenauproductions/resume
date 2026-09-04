import { Fragment } from "react";
import { About } from "@/components/About";
import { Contact } from "@/components/Contact";
import { Experience } from "@/components/Experience";
import { Gallery } from "@/components/Gallery";
import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { RoleFit } from "@/components/RoleFit";
import { SideProjects } from "@/components/SideProjects";
import { Skills } from "@/components/Skills";
import { ResumeProvider } from "@/components/resume/ResumeProvider";
import { ResumeThemeApplier } from "@/components/resume/ResumeThemeApplier";
import { dbConfigured } from "@/lib/db";
import { getResumeContent } from "@/lib/db/resume-content";
import { buildDefaultResumeContent } from "@/lib/resume/defaults";
import type { ResumeContent, ResumeSectionId } from "@/lib/resume/types";

export const dynamic = "force-dynamic";

const SECTION_RENDER: Record<Exclude<ResumeSectionId, "hero">, () => React.ReactNode> = {
  about: () => <About />,
  experience: () => <Experience />,
  work: () => <Gallery />,
  projects: () => <SideProjects />,
  skills: () => <Skills />,
  fit: () => <RoleFit />,
  contact: () => <Contact />,
};

export default async function Home() {
  let content: ResumeContent = buildDefaultResumeContent();
  if (dbConfigured()) {
    try {
      content = await getResumeContent();
    } catch {
      // keep defaults — identical to current static site
    }
  }

  const bodySections = content.sectionOrder.filter(
    (id): id is Exclude<ResumeSectionId, "hero"> =>
      id !== "hero" && content.sections[id]?.enabled !== false,
  );

  return (
    <ResumeProvider content={content}>
      <ResumeThemeApplier theme={content.theme ?? "dark"} />
      <Nav />
      <main className="flex-1">
        {content.sections.hero?.enabled !== false ? <Hero /> : null}
        {bodySections.map((id) => (
          <Fragment key={id}>{SECTION_RENDER[id]()}</Fragment>
        ))}
      </main>
    </ResumeProvider>
  );
}

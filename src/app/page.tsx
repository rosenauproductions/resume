import { Fragment, Suspense } from "react";
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
import { getResumeDocument } from "@/lib/db/resume-content";
import { buildDefaultResumeDocument, materializeResume, resolveLens } from "@/lib/resume/lens";
import type { ResumeSectionId } from "@/lib/resume/types";

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

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lens?: string | string[] }>;
}) {
  const params = await searchParams;
  const lens = resolveLens(params.lens);

  let content = materializeResume(buildDefaultResumeDocument(), lens);
  if (dbConfigured()) {
    try {
      const doc = await getResumeDocument();
      content = materializeResume(doc, lens);
    } catch {
      // keep defaults
    }
  }

  const bodySections = content.sectionOrder.filter(
    (id): id is Exclude<ResumeSectionId, "hero"> =>
      id !== "hero" && content.sections[id]?.enabled !== false,
  );

  return (
    <ResumeProvider content={content} lens={lens}>
      <ResumeThemeApplier theme={content.theme ?? "dark"} />
      <Suspense fallback={null}>
        <Nav />
      </Suspense>
      <main className="flex-1">
        {content.sections.hero?.enabled !== false ? <Hero /> : null}
        {bodySections.map((id) => (
          <Fragment key={id}>{SECTION_RENDER[id]()}</Fragment>
        ))}
      </main>
    </ResumeProvider>
  );
}

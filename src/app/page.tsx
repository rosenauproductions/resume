import { About } from "@/components/About";
import { Contact } from "@/components/Contact";
import { Experience } from "@/components/Experience";
import { Gallery } from "@/components/Gallery";
import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { RoleFit } from "@/components/RoleFit";
import { SideProjects } from "@/components/SideProjects";
import { Skills } from "@/components/Skills";
import { dbConfigured } from "@/lib/db";
import { getSkillsSectionSetting } from "@/lib/db/settings";

export default async function Home() {
  let showSkills = false;
  if (dbConfigured()) {
    try {
      showSkills = (await getSkillsSectionSetting()).enabled;
    } catch {
      showSkills = false;
    }
  }

  return (
    <>
      <Nav showSkills={showSkills} />
      <main className="flex-1">
        <Hero />
        <About />
        <Experience />
        <Gallery />
        <SideProjects />
        {showSkills ? <Skills /> : null}
        <RoleFit />
        <Contact />
      </main>
    </>
  );
}

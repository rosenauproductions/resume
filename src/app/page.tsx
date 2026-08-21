import { About } from "@/components/About";
import { Contact } from "@/components/Contact";
import { Experience } from "@/components/Experience";
import { Gallery } from "@/components/Gallery";
import { Hero } from "@/components/Hero";
import { Nav } from "@/components/Nav";
import { RoleFit } from "@/components/RoleFit";
import { SideProjects } from "@/components/SideProjects";
import { Skills } from "@/components/Skills";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />
        <About />
        <Experience />
        <Gallery />
        <SideProjects />
        <Skills />
        <RoleFit />
        <Contact />
      </main>
    </>
  );
}

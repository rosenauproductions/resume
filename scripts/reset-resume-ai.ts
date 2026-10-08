import { resetResumeContent } from "../src/lib/db/resume-content";

async function main() {
  const doc = await resetResumeContent();
  const ai = doc.lenses.ai;
  console.log("Reset complete.");
  console.log("AI heading:", ai.sideProjects.heading);
  console.log("AI projects:", ai.sideProjects.projects.map((p) => p.title).join(" | "));
  console.log("About lead:", ai.about.paragraphs[0].slice(0, 80) + "...");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

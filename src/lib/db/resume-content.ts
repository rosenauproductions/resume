import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { siteSettings } from "./schema";
import { buildDefaultResumeContent, normalizeResumeContent } from "@/lib/resume/defaults";
import type { ResumeContent } from "@/lib/resume/types";
import { getSkillsSectionSetting, setSkillsSectionEnabled } from "./settings";

export const SETTING_RESUME_CONTENT = "resume_content";

export async function getResumeContent(): Promise<ResumeContent> {
  const db = getDb();
  const rows = await db
    .select({ valueJson: siteSettings.valueJson })
    .from(siteSettings)
    .where(eq(siteSettings.key, SETTING_RESUME_CONTENT))
    .limit(1);

  if (!rows[0]) {
    const seeded = buildDefaultResumeContent();
    // Honor existing skills toggle if present
    try {
      const skills = await getSkillsSectionSetting();
      seeded.sections.skills.enabled = skills.enabled;
    } catch {
      // ignore
    }
    return seeded;
  }

  const content = normalizeResumeContent(rows[0].valueJson);
  return content;
}

export async function saveResumeContent(input: unknown): Promise<ResumeContent> {
  const content = normalizeResumeContent(input);
  const db = getDb();
  await db
    .insert(siteSettings)
    .values({
      key: SETTING_RESUME_CONTENT,
      valueJson: content as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        valueJson: content as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });

  // Keep legacy skills toggle in sync
  try {
    await setSkillsSectionEnabled(content.sections.skills.enabled);
  } catch {
    // ignore
  }

  return content;
}

export async function resetResumeContent(): Promise<ResumeContent> {
  return saveResumeContent(buildDefaultResumeContent());
}

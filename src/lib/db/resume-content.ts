import { eq } from "drizzle-orm";
import { getDb } from "./index";
import { siteSettings } from "./schema";
import {
  buildDefaultResumeDocument,
  materializeResume,
  normalizeResumeDocument,
} from "@/lib/resume/lens";
import type { ResumeContent, ResumeDocument, ResumeLensId } from "@/lib/resume/types";
import { getSkillsSectionSetting, setSkillsSectionEnabled } from "./settings";

export const SETTING_RESUME_CONTENT = "resume_content";

export async function getResumeDocument(): Promise<ResumeDocument> {
  const db = getDb();
  const rows = await db
    .select({ valueJson: siteSettings.valueJson })
    .from(siteSettings)
    .where(eq(siteSettings.key, SETTING_RESUME_CONTENT))
    .limit(1);

  if (!rows[0]) {
    const seeded = buildDefaultResumeDocument();
    try {
      const skills = await getSkillsSectionSetting();
      seeded.lenses.media.sections.skills.enabled = skills.enabled;
      // AI lens keeps skills on by default
    } catch {
      // ignore
    }
    return seeded;
  }

  return normalizeResumeDocument(rows[0].valueJson);
}

/** Materialized single-lens content for the public site. */
export async function getResumeContent(lens: ResumeLensId = "media"): Promise<ResumeContent> {
  const doc = await getResumeDocument();
  return materializeResume(doc, lens);
}

export async function saveResumeDocument(input: unknown): Promise<ResumeDocument> {
  const doc = normalizeResumeDocument(input);
  const db = getDb();
  await db
    .insert(siteSettings)
    .values({
      key: SETTING_RESUME_CONTENT,
      valueJson: doc as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        valueJson: doc as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      },
    });

  try {
    await setSkillsSectionEnabled(doc.lenses.media.sections.skills.enabled);
  } catch {
    // ignore
  }

  return doc;
}

/** Accepts v1 flat content or v2 document; always stores v2. */
export async function saveResumeContent(input: unknown): Promise<ResumeDocument> {
  return saveResumeDocument(input);
}

export async function resetResumeContent(): Promise<ResumeDocument> {
  return saveResumeDocument(buildDefaultResumeDocument());
}

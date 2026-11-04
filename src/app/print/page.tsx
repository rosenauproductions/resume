import type { Metadata } from "next";
import { ResumeDocument, RESUME_DOC_CSS, RESUME_PDF_PATHS } from "@/components/print/ResumeDocument";
import { PrintButton } from "@/components/print/PrintButton";
import { dbConfigured } from "@/lib/db";
import { getResumeDocument } from "@/lib/db/resume-content";
import { buildDefaultResumeDocument, materializeResume, resolveLens } from "@/lib/resume/lens";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chris Rosenau — Resume",
  robots: { index: false },
};

const PAGE_CSS = `
html, body { background: #e9edf1 !important; color: #111 !important; }
html:has(.rdoc) body::before { display: none !important; content: none !important; }
.rdoc-sheet { background: #fff; max-width: 8.5in; margin: 24px auto; padding: 0.6in 0.6in; box-shadow: 0 2px 18px rgba(0,0,0,0.12); }
.rdoc-bar { max-width: 8.5in; margin: 18px auto 0; display: flex; gap: 10px; justify-content: flex-end; font-family: Helvetica, Arial, sans-serif; font-size: 14px; padding: 0 8px; }
.rdoc-bar a, .rdoc-bar button { border: 1px solid #1f3a4d; color: #1f3a4d; background: #fff; border-radius: 999px; padding: 8px 16px; cursor: pointer; text-decoration: none; }
.rdoc-bar .primary { background: #1f3a4d; color: #fff; }
@media print {
  @page { size: Letter; margin: 0.55in 0.6in; }
  html, body { background: #fff !important; }
  .rdoc-sheet { margin: 0; padding: 0; box-shadow: none; max-width: none; }
  .rdoc-bar { display: none !important; }
}
${RESUME_DOC_CSS}
`;

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ lens?: string | string[] }>;
}) {
  const params = await searchParams;
  const lens = resolveLens(params.lens);
  let content = materializeResume(buildDefaultResumeDocument(), lens);
  if (dbConfigured()) {
    try {
      content = materializeResume(await getResumeDocument(), lens);
    } catch {
      // defaults
    }
  }
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <div className="rdoc-bar">
        <a href={lens === "ai" ? "/" : `/?lens=${lens}`}>← Portfolio</a>
        <a href={RESUME_PDF_PATHS[lens]} download>
          Download PDF
        </a>
        <PrintButton />
      </div>
      <div className="rdoc-sheet">
        <ResumeDocument content={content} lens={lens} />
      </div>
    </>
  );
}

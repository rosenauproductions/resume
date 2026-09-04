import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { authError, requirePipelineAuth } from "@/lib/jobs/require-auth";

export const runtime = "nodejs";

const MAX_BYTES = 12 * 1024 * 1024; // 12MB
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
]);

export async function POST(req: NextRequest) {
  const auth = await requirePipelineAuth();
  if (!auth.ok) return authError(auth);

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Blob storage not configured (BLOB_READ_WRITE_TOKEN)" },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be under 12MB" }, { status: 400 });
  }
  const type = file.type || "application/octet-stream";
  if (!ALLOWED.has(type)) {
    return NextResponse.json(
      { error: "Use JPEG, PNG, WebP, GIF, MP4, or WebM" },
      { status: 400 },
    );
  }

  const slot = String(form.get("slot") || "asset").replace(/[^a-z0-9_-]/gi, "");
  const ext =
    type === "image/jpeg"
      ? "jpg"
      : type === "image/png"
        ? "png"
        : type === "image/webp"
          ? "webp"
          : type === "image/gif"
            ? "gif"
            : type === "video/webm"
              ? "webm"
              : "mp4";

  try {
    const blob = await put(`resume/${slot}-${Date.now()}.${ext}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: type,
    });
    return NextResponse.json({ ok: true, url: blob.url, contentType: type });
  } catch (error) {
    console.error("resume upload failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

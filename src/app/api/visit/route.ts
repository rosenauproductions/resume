import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { isDeviceIgnored, recordVisit } from "@/lib/db/visits";
import { buildIdentifyPrompt } from "@/lib/db/visitor-identify";
import type { IdentifyPromptPayload } from "@/lib/visit-identify-types";
import { notifyVisitChannels, type VisitNotifyKind } from "@/lib/visit-notify";
import { resumeLensFromPath, visitNotifyTitleForPath } from "@/lib/resume/visit-lens";

export const runtime = "nodejs";

type VisitPayload = {
  path?: string;
  referrer?: string;
  language?: string;
  screen?: string;
  timezone?: string;
  fingerprint?: string;
  /** When true, still store the visit / identify payload, but skip Discord/ntfy. */
  skipNotify?: boolean;
  /** Explicit lens from client (`media` | `ai`); falls back to parsing path. */
  lens?: string;
};

function pickHeader(req: NextRequest, name: string) {
  return req.headers.get(name)?.trim() || "";
}

function summarizeUa(ua: string) {
  if (!ua) return "Unknown device";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Desktop / other";
}

function normalizeVisitPath(path: string, lensHint?: string): string {
  const raw = (path || "/").trim() || "/";
  const base = raw.split("?")[0] || "/";
  if (base === "/pipeline" || base.startsWith("/pipeline/")) return base;
  if (base === "/head-count" || base.startsWith("/head-count/")) return base;

  const fromPath = resumeLensFromPath(raw);
  const hint = lensHint === "ai" || lensHint === "media" ? lensHint : null;
  const lens = hint ?? fromPath ?? "ai";
  return lens === "media" ? "/?lens=media" : "/";
}

export async function POST(req: NextRequest) {
  let payload: VisitPayload = {};
  try {
    payload = (await req.json()) as VisitPayload;
  } catch {
    // ignore empty body
  }

  const city = pickHeader(req, "x-vercel-ip-city");
  const region = pickHeader(req, "x-vercel-ip-country-region");
  const country = pickHeader(req, "x-vercel-ip-country");
  const ua = pickHeader(req, "user-agent");
  const when = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const location =
    [decodeURIComponent(city || ""), region, country].filter(Boolean).join(", ") ||
    "Unknown location";

  const path = normalizeVisitPath(payload.path || "/", payload.lens);
  const lens = resumeLensFromPath(path);
  const device = summarizeUa(ua);
  const fingerprint = (payload.fingerprint || "").trim();
  const isPipeline = path === "/pipeline" || path.startsWith("/pipeline/");

  let deviceIgnored = false;
  if (fingerprint) {
    if (dbConfigured()) {
      try {
        deviceIgnored = await isDeviceIgnored(fingerprint);
      } catch (error) {
        console.error("visit ignore-list check failed", error);
        const raw = process.env.VISIT_IGNORE_DEVICE_IDS || "";
        deviceIgnored = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .includes(fingerprint);
      }
    } else {
      const raw = process.env.VISIT_IGNORE_DEVICE_IDS || "";
      deviceIgnored = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .includes(fingerprint);
    }
  }

  const lensLine =
    lens === "ai"
      ? "**Resume lens:** AI (coding / systems view)"
      : lens === "media"
        ? "**Resume lens:** Media (multimedia view)"
        : null;

  const lines = [
    `**When:** ${when} (Central)`,
    `**Where:** ${location}`,
    `**Device:** ${device}`,
    lensLine,
    `**Page:** ${path}`,
    payload.referrer ? `**From:** ${payload.referrer}` : null,
    payload.timezone ? `**Visitor TZ:** ${payload.timezone}` : null,
    payload.language ? `**Language:** ${payload.language}` : null,
    payload.screen ? `**Screen:** ${payload.screen}` : null,
  ].filter(Boolean) as string[];

  const title = visitNotifyTitleForPath(path);
  const notifyKind: VisitNotifyKind =
    lens === "ai" ? "visit_ai" : isPipeline ? "pipeline" : "visit";

  if (deviceIgnored) {
    return NextResponse.json({
      ok: true,
      stored: false,
      visitId: null,
      linkConfidence: null,
      notified: false,
      skippedNotify: "device_ignore",
      skippedTracking: true,
      identify: null,
    });
  }

  let visitId: string | null = null;
  let linkConfidence: string | null = null;
  let linkedApplicationId: string | null = null;
  let identify: IdentifyPromptPayload | null = null;

  if (dbConfigured()) {
    try {
      const visit = await recordVisit({
        path,
        city,
        region,
        country,
        device,
        referrer: payload.referrer || "",
        timezone: payload.timezone || "",
        language: payload.language || "",
        screen: payload.screen || "",
        sessionFingerprint: fingerprint,
        deviceIgnored: false,
      });
      visitId = visit.id;
      linkConfidence = visit.linkConfidence;
      linkedApplicationId = visit.linkedApplicationId;
      if (visit.linkConfidence === "suggested" && visit.linkReason) {
        lines.push(`**Suggested job:** ${visit.linkReason}`);
      }
    } catch (error) {
      console.error("visit db write failed", error);
    }

    if (visitId && fingerprint) {
      try {
        identify = await buildIdentifyPrompt({
          path,
          deviceId: fingerprint,
          visitId,
          linkedApplicationId,
          linkConfidence,
          deviceIgnored: false,
        });
      } catch (error) {
        console.error("identify prompt build failed", error);
      }
    }
  }

  if (isPipeline) {
    return NextResponse.json({
      ok: true,
      stored: Boolean(visitId),
      visitId,
      linkConfidence,
      notified: false,
      skippedNotify: "pipeline",
      identify,
    });
  }

  if (payload.skipNotify) {
    return NextResponse.json({
      ok: true,
      stored: Boolean(visitId),
      visitId,
      linkConfidence,
      notified: false,
      skippedNotify: "session",
      identify,
      lens,
    });
  }

  try {
    const notified = await notifyVisitChannels({
      title,
      lines,
      kind: notifyKind,
    });
    return NextResponse.json({
      ok: true,
      stored: Boolean(visitId),
      visitId,
      linkConfidence,
      notified,
      identify,
      lens,
    });
  } catch (error) {
    console.error("visit notify failed", error);
    return NextResponse.json(
      { ok: false, stored: Boolean(visitId), visitId, linkConfidence, identify },
      { status: 500 },
    );
  }
}

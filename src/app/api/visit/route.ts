import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { isDeviceIgnored, recordVisit } from "@/lib/db/visits";
import {
  buildIdentifyPrompt,
  hasVisitorIdentified,
} from "@/lib/db/visitor-identify";
import type { IdentifyPromptPayload } from "@/lib/visit-identify-types";
import { identifyDoneCookieHeaderValue } from "@/lib/identify-persistence";
import { notifyVisitChannels } from "@/lib/visit-notify";

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

function titleForPath(path: string) {
  if (path === "/pipeline" || path.startsWith("/pipeline/")) {
    return "Pipeline visited";
  }
  return "Resume site visit";
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

  const path = payload.path || "/";
  const device = summarizeUa(ua);
  const fingerprint = (payload.fingerprint || "").trim();
  const isPipeline =
    path === "/pipeline" || path.startsWith("/pipeline/");

  // Env VISIT_IGNORE_DEVICE_IDS still works; DB ignored_devices enables runtime button
  let deviceIgnored = false;
  if (fingerprint) {
    if (dbConfigured()) {
      try {
        deviceIgnored = await isDeviceIgnored(fingerprint);
      } catch (error) {
        console.error("visit ignore-list check failed", error);
        // Fall back to env-only if DB check fails
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

  const lines = [
    `**When:** ${when} (Central)`,
    `**Where:** ${location}`,
    `**Device:** ${device}`,
    `**Page:** ${path}`,
    payload.referrer ? `**From:** ${payload.referrer}` : null,
    payload.timezone ? `**Visitor TZ:** ${payload.timezone}` : null,
    payload.language ? `**Language:** ${payload.language}` : null,
    payload.screen ? `**Screen:** ${payload.screen}` : null,
  ].filter(Boolean) as string[];

  const title = titleForPath(path);

  let visitId: string | null = null;
  let linkConfidence: string | null = null;
  let linkedApplicationId: string | null = null;
  let identify: IdentifyPromptPayload | null = null;
  let reinforceIdentifiedCookie = false;

  // Dual-track: persist detailed visit even if notifications are off
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
        deviceIgnored,
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
        if (await hasVisitorIdentified(fingerprint)) {
          reinforceIdentifiedCookie = true;
        }
        identify = await buildIdentifyPrompt({
          path,
          deviceId: fingerprint,
          visitId,
          linkedApplicationId,
          linkConfidence,
          deviceIgnored,
          cookieHeader: req.headers.get("cookie"),
        });
      } catch (error) {
        console.error("identify prompt build failed", error);
      }
    }
  }

  const withIdentifyCookie = (res: NextResponse) => {
    if (reinforceIdentifiedCookie) {
      res.headers.append("Set-Cookie", identifyDoneCookieHeaderValue());
    }
    return res;
  };

  // Never ntfy/Discord for ignored home devices (still stored above as ignored)
  if (deviceIgnored) {
    return withIdentifyCookie(
      NextResponse.json({
        ok: true,
        stored: Boolean(visitId),
        visitId,
        linkConfidence,
        notified: false,
        skippedNotify: "device_ignore",
        identify,
      }),
    );
  }

  // Never ntfy/Discord for your own pipeline sessions
  if (isPipeline) {
    return withIdentifyCookie(
      NextResponse.json({
        ok: true,
        stored: Boolean(visitId),
        visitId,
        linkConfidence,
        notified: false,
        skippedNotify: "pipeline",
        identify,
      }),
    );
  }

  // Client already pinged this browser session — still store + return identify
  if (payload.skipNotify) {
    return withIdentifyCookie(
      NextResponse.json({
        ok: true,
        stored: Boolean(visitId),
        visitId,
        linkConfidence,
        notified: false,
        skippedNotify: "session",
        identify,
      }),
    );
  }

  try {
    const notified = await notifyVisitChannels({
      title,
      lines,
      kind: isPipeline ? "pipeline" : "visit",
    });
    return withIdentifyCookie(
      NextResponse.json({
        ok: true,
        stored: Boolean(visitId),
        visitId,
        linkConfidence,
        notified,
        identify,
      }),
    );
  } catch (error) {
    console.error("visit notify failed", error);
    return withIdentifyCookie(
      NextResponse.json(
        { ok: false, stored: Boolean(visitId), visitId, linkConfidence, identify },
        { status: 500 },
      ),
    );
  }
}

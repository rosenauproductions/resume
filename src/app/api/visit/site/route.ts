import { NextRequest, NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { isDeviceIgnored, recordVisit } from "@/lib/db/visits";
import { notifyVisitChannels } from "@/lib/visit-notify";
import { SITE_PATH_PREFIX, findTrackedSite } from "@/lib/visit-sites";

export const runtime = "nodejs";

/** Cross-site visit beacon used by /track.js on Chris's other sites. */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function header(req: NextRequest, name: string) {
  return req.headers.get(name)?.trim() || "";
}

function summarizeUa(ua: string) {
  if (!ua) return "Unknown device";
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Tizen|SMART-TV|SmartTV/i.test(ua)) return "Smart TV";
  if (/Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Desktop / other";
}

const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

export async function POST(req: NextRequest) {
  const ok = (body: Record<string, unknown>, status = 200) =>
    NextResponse.json(body, { status, headers: CORS });

  let payload: Record<string, unknown> = {};
  try {
    // sendBeacon posts text/plain to avoid a CORS preflight; parse either way.
    payload = JSON.parse((await req.text()) || "{}");
  } catch {
    return ok({ ok: false, error: "Invalid JSON" }, 400);
  }

  const site = findTrackedSite(clip(payload.site, 60).trim());
  if (!site) return ok({ ok: false, error: "Unknown site" }, 400);
  const origin = header(req, "origin");
  if (site.origins?.length && origin && !site.origins.includes(origin)) {
    return ok({ ok: false, error: "Origin not allowed" }, 403);
  }

  const ua = header(req, "user-agent");
  if (/bot|crawler|spider|preview|headless/i.test(ua)) return ok({ ok: true, stored: false, skipped: "bot" });

  const pagePath = clip(payload.path, 200).split("?")[0] || "/";
  const path = `${SITE_PATH_PREFIX}${site.slug}${pagePath.startsWith("/") ? pagePath : `/${pagePath}`}`;
  const city = header(req, "x-vercel-ip-city");
  const region = header(req, "x-vercel-ip-country-region");
  const country = header(req, "x-vercel-ip-country");
  const fingerprint = clip(payload.fingerprint, 80).trim();
  const device = summarizeUa(ua);

  if (!dbConfigured()) return ok({ ok: true, stored: false });
  if (fingerprint && (await isDeviceIgnored(fingerprint).catch(() => false))) {
    return ok({ ok: true, stored: false, skipped: "device_ignore" });
  }

  let stored = false;
  try {
    await recordVisit({
      path,
      city,
      region,
      country,
      device,
      referrer: clip(payload.referrer, 300),
      timezone: clip(payload.timezone, 60),
      language: clip(payload.language, 30),
      screen: clip(payload.screen, 30),
      sessionFingerprint: fingerprint ? `${site.slug}:${fingerprint}` : "",
    });
    stored = true;
  } catch (error) {
    console.error("site visit db write failed", error);
  }

  const location = [decodeURIComponent(city || ""), region, country].filter(Boolean).join(", ") || "Unknown location";
  const when = new Date().toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" });
  void notifyVisitChannels({
    title: `${site.label} visit`,
    kind: "visit",
    lines: [
      `**When:** ${when} (Central)`,
      `**Where:** ${location}`,
      `**Device:** ${device}`,
      `**Site:** ${site.label}`,
      `**Page:** ${pagePath}`,
      payload.referrer ? `**From:** ${clip(payload.referrer, 300)}` : null,
    ].filter(Boolean) as string[],
  }).catch(() => undefined);

  return ok({ ok: true, stored });
}

import { createHash, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "pipeline_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

export function getTrackerSecret() {
  return process.env.JOB_TRACKER_SECRET?.trim() || "";
}

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function verifyPassword(password: string) {
  const secret = getTrackerSecret();
  if (!secret || !password) return false;
  const a = Buffer.from(hashSecret(password));
  const b = Buffer.from(hashSecret(secret));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function makeSessionToken() {
  const secret = getTrackerSecret();
  if (!secret) return "";
  // Signed-ish token: hash(secret + day-bucket) rotated weekly via secret only
  return hashSecret(`${secret}:pipeline-v1`);
}

export function verifySessionToken(token: string | undefined) {
  if (!token) return false;
  const expected = makeSessionToken();
  if (!expected) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

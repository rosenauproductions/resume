import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken, getTrackerSecret } from "@/lib/jobs/auth";

export async function requirePipelineAuth() {
  if (!getTrackerSecret()) {
    return { ok: false as const, status: 503 as const, error: "Not configured" };
  }
  const jar = await cookies();
  if (!verifySessionToken(jar.get(SESSION_COOKIE)?.value)) {
    return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  }
  return { ok: true as const };
}

export function authError(auth: { ok: false; status: number; error: string }) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

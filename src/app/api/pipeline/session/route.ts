import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken, getTrackerSecret } from "@/lib/jobs/auth";

export async function GET() {
  if (!getTrackerSecret()) {
    return NextResponse.json({ authenticated: false, configured: false });
  }
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return NextResponse.json({
    authenticated: verifySessionToken(token),
    configured: true,
  });
}

import { NextResponse } from "next/server";
import {
  makeSessionToken,
  sessionCookieOptions,
  verifyPassword,
  getTrackerSecret,
  SESSION_COOKIE,
} from "@/lib/jobs/auth";

export async function POST(request: Request) {
  if (!getTrackerSecret()) {
    return NextResponse.json(
      { error: "JOB_TRACKER_SECRET is not configured on the server." },
      { status: 503 },
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!verifyPassword(body.password ?? "")) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, makeSessionToken(), sessionCookieOptions());
  return res;
}

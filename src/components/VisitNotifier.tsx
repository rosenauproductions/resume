"use client";

import { useEffect } from "react";

function sessionKeyForPath(pathname: string) {
  if (pathname === "/pipeline" || pathname.startsWith("/pipeline/")) {
    return "pipeline-visit-notified";
  }
  return "resume-visit-notified";
}

export function VisitNotifier() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;

    const path = window.location.pathname || "/";
    const sessionKey = sessionKeyForPath(path);
    if (sessionStorage.getItem(sessionKey)) return;

    sessionStorage.setItem(sessionKey, "1");

    const body = {
      path,
      referrer: document.referrer || "",
      language: navigator.language || "",
      screen: `${window.screen.width}×${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    };

    void fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      // non-blocking
    });
  }, []);

  return null;
}

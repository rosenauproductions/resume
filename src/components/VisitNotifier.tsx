"use client";

import { useEffect } from "react";

const SESSION_KEY = "resume-visit-notified";

export function VisitNotifier() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    sessionStorage.setItem(SESSION_KEY, "1");

    const body = {
      path: window.location.pathname,
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

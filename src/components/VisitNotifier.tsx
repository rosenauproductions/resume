"use client";

import { useEffect, useState } from "react";
import { getOrCreateDeviceId } from "@/lib/device-id";
import type { IdentifyPromptPayload } from "@/lib/visit-identify-types";
import {
  VisitorIdentifyModal,
  wasIdentifyDismissedThisSession,
} from "@/components/VisitorIdentifyModal";

function sessionKeyForPath(pathname: string) {
  if (pathname === "/pipeline" || pathname.startsWith("/pipeline/")) {
    return "pipeline-visit-notified";
  }
  return "resume-visit-notified";
}

export function VisitNotifier() {
  const [identifyPrompt, setIdentifyPrompt] = useState<IdentifyPromptPayload | null>(null);
  const [fingerprint, setFingerprint] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;

    const path = window.location.pathname || "/";
    if (path === "/head-count" || path.startsWith("/head-count/")) return;
    const sessionKey = sessionKeyForPath(path);
    if (sessionStorage.getItem(sessionKey)) return;

    sessionStorage.setItem(sessionKey, "1");

    const fp = getOrCreateDeviceId();
    setFingerprint(fp);

    const body = {
      path,
      referrer: document.referrer || "",
      language: navigator.language || "",
      screen: `${window.screen.width}×${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      fingerprint: fp,
    };

    void fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          identify?: IdentifyPromptPayload;
        };
        if (
          data.identify?.show &&
          !wasIdentifyDismissedThisSession() &&
          path !== "/pipeline" &&
          !path.startsWith("/pipeline/")
        ) {
          setIdentifyPrompt(data.identify);
        }
      })
      .catch(() => {
        // non-blocking
      });
  }, []);

  return identifyPrompt && fingerprint ? (
    <VisitorIdentifyModal
      prompt={identifyPrompt}
      fingerprint={fingerprint}
      onDone={() => setIdentifyPrompt(null)}
    />
  ) : null;
}

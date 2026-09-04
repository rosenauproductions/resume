"use client";

import { useEffect, useState } from "react";
import { getOrCreateDeviceId } from "@/lib/device-id";
import type { IdentifyPromptPayload } from "@/lib/visit-identify-types";
import {
  VisitorIdentifyModal,
  hasVisitorIdentifiedClient,
  wasIdentifyDismissedThisSession,
} from "@/components/VisitorIdentifyModal";

const SCROLL_SHOW_PX = 140;

function sessionKeyForPath(pathname: string) {
  if (pathname === "/pipeline" || pathname.startsWith("/pipeline/")) {
    return "pipeline-visit-notified";
  }
  return "resume-visit-notified";
}

function isPipelinePath(path: string) {
  return path === "/pipeline" || path.startsWith("/pipeline/");
}

function isHeadCountPath(path: string) {
  return path === "/head-count" || path.startsWith("/head-count/");
}

export function VisitNotifier() {
  const [identifyPrompt, setIdentifyPrompt] = useState<IdentifyPromptPayload | null>(null);
  const [showIdentify, setShowIdentify] = useState(false);
  const [fingerprint, setFingerprint] = useState("");

  // Record visits every page load; only ntfy once per browser session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;

    const path = window.location.pathname || "/";
    if (isHeadCountPath(path)) return;

    const alreadyIdentified = hasVisitorIdentifiedClient();

    const sessionKey = sessionKeyForPath(path);
    const alreadyNotified = Boolean(sessionStorage.getItem(sessionKey));
    if (!alreadyNotified) {
      sessionStorage.setItem(sessionKey, "1");
    }

    const fp = getOrCreateDeviceId();
    setFingerprint(fp);

    const body = {
      path,
      referrer: document.referrer || "",
      language: navigator.language || "",
      screen: `${window.screen.width}×${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      fingerprint: fp,
      skipNotify: alreadyNotified,
    };

    void fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    })
      .then(async (res) => {
        if (alreadyIdentified) return;
        const data = (await res.json().catch(() => ({}))) as {
          identify?: IdentifyPromptPayload;
        };
        if (
          data.identify?.show &&
          !hasVisitorIdentifiedClient() &&
          !wasIdentifyDismissedThisSession() &&
          !isPipelinePath(path)
        ) {
          setIdentifyPrompt(data.identify);
        }
      })
      .catch(() => {
        // non-blocking
      });
  }, []);

  // Show identify only after a little scroll (when eligible).
  useEffect(() => {
    if (!identifyPrompt || showIdentify) return;
    if (typeof window === "undefined") return;

    const reveal = () => setShowIdentify(true);

    const onScroll = () => {
      const y = window.scrollY || document.documentElement.scrollTop || 0;
      if (y >= SCROLL_SHOW_PX) reveal();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Short pages that barely scroll: still reveal after a gentle wait once they've landed.
    const maxScroll =
      document.documentElement.scrollHeight - window.innerHeight;
    const fallbackMs = maxScroll < SCROLL_SHOW_PX ? 4500 : 0;
    const timer = fallbackMs
      ? window.setTimeout(reveal, fallbackMs)
      : 0;

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (timer) window.clearTimeout(timer);
    };
  }, [identifyPrompt, showIdentify]);

  return identifyPrompt && fingerprint && showIdentify ? (
    <VisitorIdentifyModal
      prompt={identifyPrompt}
      fingerprint={fingerprint}
      onDone={() => {
        setIdentifyPrompt(null);
        setShowIdentify(false);
      }}
    />
  ) : null;
}

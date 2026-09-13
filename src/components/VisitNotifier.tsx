"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getOrCreateDeviceId } from "@/lib/device-id";
import type { IdentifyPromptPayload } from "@/lib/visit-identify-types";
import {
  VisitorIdentifyModal,
  wasIdentifyDismissedThisSession,
} from "@/components/VisitorIdentifyModal";
import { wasWelcomeDismissedThisSession, rememberLastVisitId } from "@/lib/identify-persistence";
import { resolveLens } from "@/lib/resume/lens";
import { visitPathForLens } from "@/lib/resume/visit-lens";
import type { ResumeLensId } from "@/lib/resume/types";

const SCROLL_SHOW_PX = 140;

function isPipelinePath(path: string) {
  return path === "/pipeline" || path.startsWith("/pipeline/");
}

function isHeadCountPath(path: string) {
  return path === "/head-count" || path.startsWith("/head-count/");
}

function notifySessionKey(path: string, lens: ResumeLensId | null) {
  if (isPipelinePath(path)) return "pipeline-visit-notified";
  if (lens === "ai") return "resume-visit-notified-ai";
  return "resume-visit-notified-media";
}

export function VisitNotifier() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const lens = isPipelinePath(pathname) || isHeadCountPath(pathname)
    ? null
    : resolveLens(searchParams.get("lens"));

  const [identifyPrompt, setIdentifyPrompt] = useState<IdentifyPromptPayload | null>(null);
  const [showIdentify, setShowIdentify] = useState(false);
  const [fingerprint, setFingerprint] = useState("");
  const lastRecordedKey = useRef("");

  // Record visits every page load / lens change; ntfy once per lens per browser session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (isHeadCountPath(pathname)) return;

    const path =
      lens && !isPipelinePath(pathname) ? visitPathForLens(lens) : pathname || "/";
    const recordKey = `${path}::${lens ?? "none"}`;
    if (lastRecordedKey.current === recordKey) return;
    lastRecordedKey.current = recordKey;

    const sessionKey = notifySessionKey(pathname, lens);
    const alreadyNotified = Boolean(sessionStorage.getItem(sessionKey));
    if (!alreadyNotified) {
      sessionStorage.setItem(sessionKey, "1");
    }

    const fp = getOrCreateDeviceId();
    setFingerprint(fp);

    const body = {
      path,
      lens: lens ?? undefined,
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
        const data = (await res.json().catch(() => ({}))) as {
          identify?: IdentifyPromptPayload;
          visitId?: string | null;
        };
        rememberLastVisitId(data.visitId);
        const identify = data.identify;
        if (!identify?.show || isPipelinePath(pathname)) return;

        if (identify.mode === "welcome") {
          if (wasWelcomeDismissedThisSession()) return;
          setIdentifyPrompt(identify);
          return;
        }

        if (wasIdentifyDismissedThisSession()) return;
        setIdentifyPrompt(identify);
      })
      .catch(() => {
        // non-blocking
      });
  }, [pathname, lens]);

  // Show identify / welcome only after a little scroll (when eligible).
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

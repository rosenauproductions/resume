/**
 * Client-side UX hints for identify/lead flows.
 * Source of truth is the DB row keyed by device fingerprint — not cookies.
 */

export const IDENTIFY_DONE_STORAGE_KEY = "resume-identified";
export const IDENTIFY_LEAD_DONE_STORAGE_KEY = "resume-lead-submitted";
export const IDENTIFY_DISMISS_SESSION_KEY = "resume-identify-dismissed";
export const WELCOME_DISMISS_SESSION_KEY = "resume-welcome-dismissed";
export const LAST_VISIT_ID_SESSION_KEY = "resume-last-visit-id";

export function markVisitorIdentifiedClient() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IDENTIFY_DONE_STORAGE_KEY, "1");
  } catch {
    // ignore
  }
  try {
    sessionStorage.setItem(IDENTIFY_DISMISS_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}

export function markVisitorLeadSubmittedClient() {
  if (typeof window === "undefined") return;
  markVisitorIdentifiedClient();
  try {
    window.localStorage.setItem(IDENTIFY_LEAD_DONE_STORAGE_KEY, "1");
  } catch {
    // ignore
  }
}

export function hasVisitorIdentifiedClient(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(IDENTIFY_DONE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function hasVisitorLeadSubmittedClient(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(IDENTIFY_LEAD_DONE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function wasIdentifyDismissedThisSession(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(IDENTIFY_DISMISS_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function wasWelcomeDismissedThisSession(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(WELCOME_DISMISS_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWelcomeDismissedThisSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(WELCOME_DISMISS_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}

export function rememberLastVisitId(visitId: string | null | undefined) {
  if (typeof window === "undefined" || !visitId) return;
  try {
    sessionStorage.setItem(LAST_VISIT_ID_SESSION_KEY, visitId);
  } catch {
    // ignore
  }
}

export function readLastVisitId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(LAST_VISIT_ID_SESSION_KEY);
  } catch {
    return null;
  }
}

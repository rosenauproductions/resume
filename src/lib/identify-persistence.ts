/** Client + shared keys for “already identified” / lead persistence. */

export const IDENTIFY_DONE_COOKIE = "resume-identified";
export const IDENTIFY_DONE_STORAGE_KEY = "resume-identified";
export const IDENTIFY_LEAD_DONE_COOKIE = "resume-lead-submitted";
export const IDENTIFY_LEAD_DONE_STORAGE_KEY = "resume-lead-submitted";
export const IDENTIFY_DISMISS_SESSION_KEY = "resume-identify-dismissed";
export const WELCOME_DISMISS_SESSION_KEY = "resume-welcome-dismissed";
export const LAST_VISIT_ID_SESSION_KEY = "resume-last-visit-id";

/** ~1 year */
export const IDENTIFY_DONE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

export function identifyDoneCookieHeaderValue(): string {
  return `${IDENTIFY_DONE_COOKIE}=1; Path=/; Max-Age=${IDENTIFY_DONE_MAX_AGE_SEC}; SameSite=Lax`;
}

export function identifyLeadDoneCookieHeaderValue(): string {
  return `${IDENTIFY_LEAD_DONE_COOKIE}=1; Path=/; Max-Age=${IDENTIFY_DONE_MAX_AGE_SEC}; SameSite=Lax`;
}

function cookieHasValue(cookieHeader: string | null | undefined, name: string): boolean {
  if (!cookieHeader) return false;
  return cookieHeader
    .split(";")
    .some((part) => part.trim() === `${name}=1`);
}

export function hasIdentifyDoneCookie(cookieHeader: string | null | undefined): boolean {
  return cookieHasValue(cookieHeader, IDENTIFY_DONE_COOKIE);
}

export function hasIdentifyLeadDoneCookie(cookieHeader: string | null | undefined): boolean {
  return cookieHasValue(cookieHeader, IDENTIFY_LEAD_DONE_COOKIE);
}

export function markVisitorIdentifiedClient() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IDENTIFY_DONE_STORAGE_KEY, "1");
  } catch {
    // ignore
  }
  try {
    document.cookie = identifyDoneCookieHeaderValue();
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
  try {
    document.cookie = identifyLeadDoneCookieHeaderValue();
  } catch {
    // ignore
  }
}

export function hasVisitorIdentifiedClient(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.localStorage.getItem(IDENTIFY_DONE_STORAGE_KEY) === "1") return true;
  } catch {
    // ignore
  }
  try {
    if (hasIdentifyDoneCookie(document.cookie)) return true;
  } catch {
    // ignore
  }
  return false;
}

export function hasVisitorLeadSubmittedClient(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.localStorage.getItem(IDENTIFY_LEAD_DONE_STORAGE_KEY) === "1") return true;
  } catch {
    // ignore
  }
  try {
    if (hasIdentifyLeadDoneCookie(document.cookie)) return true;
  } catch {
    // ignore
  }
  return false;
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

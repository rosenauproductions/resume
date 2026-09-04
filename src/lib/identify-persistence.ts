/** Client + shared keys for “already identified” persistence. */

export const IDENTIFY_DONE_COOKIE = "resume-identified";
export const IDENTIFY_DONE_STORAGE_KEY = "resume-identified";
export const IDENTIFY_DISMISS_SESSION_KEY = "resume-identify-dismissed";

/** ~1 year */
export const IDENTIFY_DONE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

export function identifyDoneCookieHeaderValue(): string {
  return `${IDENTIFY_DONE_COOKIE}=1; Path=/; Max-Age=${IDENTIFY_DONE_MAX_AGE_SEC}; SameSite=Lax`;
}

export function hasIdentifyDoneCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader
    .split(";")
    .some((part) => part.trim() === `${IDENTIFY_DONE_COOKIE}=1`);
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

export function wasIdentifyDismissedThisSession(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(IDENTIFY_DISMISS_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

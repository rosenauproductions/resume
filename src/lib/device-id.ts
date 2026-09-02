/** localStorage key for the stable browser device id (not a MAC — browsers cannot expose those). */
export const RESUME_DEVICE_ID_KEY = "resume-device-id";

/** Generate or read the persisted device id used as visit `fingerprint`. */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(RESUME_DEVICE_ID_KEY)?.trim();
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(RESUME_DEVICE_ID_KEY, id);
    return id;
  } catch {
    return "";
  }
}

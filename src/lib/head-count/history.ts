export type CountRecord = {
  id: string;
  at: number;
  total: number;
  detected: number;
  added: number;
};

const KEY = "head-count-log-v1";
const MAX = 40;

export function loadHistory(): CountRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CountRecord[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function saveCount(entry: Omit<CountRecord, "id" | "at">): CountRecord[] {
  const next: CountRecord = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
  };
  const list = [next, ...loadHistory()].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list));
  return list;
}

export function clearHistory(): void {
  localStorage.removeItem(KEY);
}

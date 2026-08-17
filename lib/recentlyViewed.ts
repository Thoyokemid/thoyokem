const STORAGE_KEY = 'recently_viewed_docs';
const MAX_ITEMS = 8;

export interface RecentlyViewedItem {
  href: string;
  label: string;
  subtitle?: string;
  viewedAt: number;
}

export function getRecentlyViewed(): RecentlyViewedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentlyViewedItem[]) : [];
  } catch {
    return [];
  }
}

export function addRecentlyViewed(item: Omit<RecentlyViewedItem, 'viewedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getRecentlyViewed().filter((i) => i.href !== item.href);
    const next = [{ ...item, viewedAt: Date.now() }, ...existing].slice(0, MAX_ITEMS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private mode, quota) — silently skip
  }
}

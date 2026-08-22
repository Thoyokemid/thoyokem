import { useState, useEffect } from 'react';

export interface SavedView<T> {
  id: string;
  name: string;
  filters: T;
}

/** Per-page saved filter combinations, persisted to localStorage under `saved_views_${storageKey}`. */
export function useSavedViews<T>(storageKey: string) {
  const [views, setViews] = useState<SavedView<T>[]>([]);
  const fullKey = `saved_views_${storageKey}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(fullKey);
      if (saved) setViews(JSON.parse(saved));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = (next: SavedView<T>[]) => {
    setViews(next);
    localStorage.setItem(fullKey, JSON.stringify(next));
  };

  const saveView = (name: string, filters: T) => {
    persist([...views, { id: `${Date.now()}`, name, filters }]);
  };

  const deleteView = (id: string) => {
    persist(views.filter((v) => v.id !== id));
  };

  return { views, saveView, deleteView };
}

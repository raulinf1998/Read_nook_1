import { useState, useEffect, useCallback } from 'react';
import type { Book } from './types';
import { apiClient } from './api';

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota errors */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.getBooks().then(setBooks).catch(() => setBooks([])).finally(() => setLoading(false));
  }, []);

  const addBook = useCallback(async (book: Omit<Book, 'id' | 'createdAt'>) => {
    const created = await apiClient.addBook(book);
    setBooks((prev) => [created, ...prev]);
  }, []);

  const updateBook = useCallback(async (id: string, patch: Partial<Book>) => {
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    try {
      await apiClient.updateBook(id, patch);
    } catch {
      /* optimistic update */
    }
  }, []);

  const deleteBook = useCallback(async (id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
    try {
      await apiClient.deleteBook(id);
    } catch {
      /* optimistic */
    }
  }, []);

  const importBooks = useCallback(async (newBooks: Omit<Book, 'id' | 'createdAt'>[]) => {
    const result = await apiClient.importBooks(newBooks);
    const fetched = await apiClient.getBooks();
    setBooks(fetched);
    return result.imported;
  }, []);

  return { books, loading, addBook, updateBook, deleteBook, importBooks };
}

export function useServerSettings() {
  const [goal, setGoalState] = useState(24);
  const [dark, setDarkState] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiClient.getSettings().then((s) => {
      setGoalState(s.goal);
      setDarkState(s.dark);
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  const setGoal = useCallback((g: number) => {
    setGoalState(g);
    apiClient.setSettings({ goal: g }).catch(() => {});
  }, []);

  const setDark = useCallback((d: boolean) => {
    setDarkState(d);
    apiClient.setSettings({ dark: d }).catch(() => {});
  }, []);

  return { goal, setGoal, dark, setDark, loaded };
}

export function useServerTags() {
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    apiClient.getTags().then(setTags).catch(() => setTags([]));
  }, []);

  const addTag = useCallback((tag: string) => {
    setTags((prev) => [...prev, tag]);
    apiClient.addTag(tag).catch(() => {});
  }, []);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
    apiClient.removeTag(tag).catch(() => {});
  }, []);

  return { tags, addTag, removeTag };
}

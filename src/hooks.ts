import { useState, useEffect, useCallback } from 'react';
import type { Book, ThemeId } from './types';
import { apiClient } from './api';
import { mergeStoryGraphJournal } from './storyGraphJournal';
import type { StoryGraphBookMetadata, StoryGraphJournalEntry } from './storyGraphJournal';

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

// Ancho de ventana reactivo (para la estantería: nº de libros por balda)
export function useWindowWidth() {
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024));
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
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

  const mergeExistingStoryGraphJournal = useCallback(async (
    entries: StoryGraphJournalEntry[],
    bookMetadata: StoryGraphBookMetadata[] = []
  ) => {
    const result = mergeStoryGraphJournal(books, entries, bookMetadata);
    setBooks(result.books);

    // El servidor actualiza libro a libro; limitamos la concurrencia para no
    // disparar más de cien escrituras simultáneas sobre db.json.
    const changed = result.patches
      .map(({ index, patch }) => ({ id: books[index]?.id, patch }))
      .filter((item): item is { id: string; patch: Partial<Book> } => Boolean(item.id));
    const queue = [...changed];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) break;
        await apiClient.updateBook(item.id, item.patch);
      }
    });
    await Promise.all(workers);
    return result.report;
  }, [books]);

  return { books, loading, addBook, updateBook, deleteBook, importBooks, mergeExistingStoryGraphJournal };
}

const VALID_THEMES: ThemeId[] = ['calido', 'minimal', 'nocturno', 'vibrante'];

function storedTheme(): ThemeId {
  try {
    const t = localStorage.getItem('readnook-theme') as ThemeId | null;
    return t && VALID_THEMES.includes(t) ? t : 'calido';
  } catch {
    return 'calido';
  }
}
function storedDark(): boolean {
  try {
    return localStorage.getItem('readnook-dark') === '1';
  } catch {
    return false;
  }
}

export function useServerSettings() {
  const [goal, setGoalState] = useState(24);
  // Se inicializa desde localStorage para aplicar el tema sin esperar al servidor
  const [dark, setDarkState] = useState<boolean>(storedDark);
  const [theme, setThemeState] = useState<ThemeId>(storedTheme);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiClient.getSettings().then((s) => {
      setGoalState(s.goal);
      setDarkState(s.dark);
      if (s.theme && VALID_THEMES.includes(s.theme)) setThemeState(s.theme);
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  // Reflejo en localStorage: el script de index.html lo usa antes del primer pintado
  useEffect(() => {
    try {
      localStorage.setItem('readnook-theme', theme);
      localStorage.setItem('readnook-dark', dark ? '1' : '0');
    } catch { /* ignore */ }
  }, [theme, dark]);

  const setGoal = useCallback((g: number) => {
    setGoalState(g);
    apiClient.setSettings({ goal: g }).catch(() => {});
  }, []);

  const setDark = useCallback((d: boolean) => {
    setDarkState(d);
    apiClient.setSettings({ dark: d }).catch(() => {});
  }, []);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    // El modo oscuro es una preferencia aparte: «Nocturno» lo fuerza mientras
    // está activo (ver App), pero al cambiar de tema vuelve el modo previo.
    apiClient.setSettings({ theme: t }).catch(() => {});
  }, []);

  return { goal, setGoal, dark, setDark, theme, setTheme, loaded };
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

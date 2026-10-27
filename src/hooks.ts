import { useState, useEffect, useCallback } from 'react';
import type { Book, CustomPalette, ThemeId } from './types';
import { THEMES } from './types';
import { apiClient } from './api';
import { sanitizeCustomPalettes } from './themePalettes';
import { mergeStoryGraphJournal } from './storyGraphJournal';
import type { StoryGraphBookMetadata, StoryGraphJournalEntry } from './storyGraphJournal';
import { isExternalCoverUrl, localizeBookCover, localizeBookCovers } from './coverStorage';

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
    const localized = await localizeBookCover(book);
    const created = await apiClient.addBook(localized);
    setBooks((prev) => [created, ...prev]);
  }, []);

  const updateBook = useCallback(async (id: string, patch: Partial<Book>) => {
    let effectivePatch = patch;
    if (patch.coverUrl && isExternalCoverUrl(patch.coverUrl)) {
      const localized = await localizeBookCover({
        coverUrl: patch.coverUrl,
        coverSourceUrl: patch.coverSourceUrl,
      });
      effectivePatch = {
        ...patch,
        coverUrl: localized.coverUrl,
        coverSourceUrl: localized.coverSourceUrl,
      };
    }
    setBooks((prev) => prev.map((b) => (b.id === id ? { ...b, ...effectivePatch } : b)));
    try {
      await apiClient.updateBook(id, effectivePatch);
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

  const importBooks = useCallback(async (
    newBooks: Omit<Book, 'id' | 'createdAt'>[],
    onCoverProgress?: (done: number, total: number) => void,
  ) => {
    const localized = await localizeBookCovers(newBooks, onCoverProgress);
    const result = await apiClient.importBooks(localized.books);
    const fetched = await apiClient.getBooks();
    setBooks(fetched);
    return {
      imported: result.imported,
      localizedCovers: localized.localizedBooks,
      coverLocalizationFailures: localized.failures,
    };
  }, []);

  const mergeExistingStoryGraphJournal = useCallback(async (
    entries: StoryGraphJournalEntry[],
    bookMetadata: StoryGraphBookMetadata[] = []
  ) => {
    const result = mergeStoryGraphJournal(books, entries, bookMetadata);

    // Las portadas vinculadas se copian al volumen de datos del servidor. Así,
    // aunque StoryGraph retire después su CDN, Bilibook conserva la imagen.
    // Si una descarga falla, se mantiene la URL externa como respaldo.
    const patchIndexes = [...new Set(result.patches.map((item) => item.index))];
    const booksToLocalize = patchIndexes
      .map((index) => result.books[index])
      .filter((book): book is Book => Boolean(book && isExternalCoverUrl(book.coverUrl)));
    if (booksToLocalize.length) {
      const localized = await localizeBookCovers(booksToLocalize);
      const localizedById = new Map(localized.books.map((book) => [book.id, book]));
      for (const item of result.patches) {
        const mergedBook = result.books[item.index];
        const localizedBook = mergedBook ? localizedById.get(mergedBook.id) : undefined;
        if (!mergedBook || !localizedBook || localizedBook.coverUrl === mergedBook.coverUrl) continue;
        result.books[item.index] = {
          ...mergedBook,
          coverUrl: localizedBook.coverUrl,
          coverSourceUrl: localizedBook.coverSourceUrl,
        };
        item.patch = {
          ...item.patch,
          coverUrl: localizedBook.coverUrl,
          coverSourceUrl: localizedBook.coverSourceUrl,
        };
      }
      result.report.localizedCovers = localized.localizedBooks;
      result.report.coverLocalizationFailures = localized.failures;
    }

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

const VALID_THEMES: ThemeId[] = THEMES.map((theme) => theme.id);
const THEME_STORAGE_KEYS = ['bilibook-theme', 'readnook-theme'];
const DARK_STORAGE_KEYS = ['bilibook-dark', 'readnook-dark'];
const CUSTOM_PALETTES_STORAGE_KEY = 'bilibook-custom-palettes';
const CUSTOM_PALETTE_ID_STORAGE_KEY = 'bilibook-custom-palette-id';

function readStoredValue(keys: string[]): string | null {
  try {
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value !== null) return value;
    }
  } catch {
    /* almacenamiento no disponible */
  }
  return null;
}

function storedTheme(): ThemeId {
  const t = readStoredValue(THEME_STORAGE_KEYS) as ThemeId | null;
  return t && VALID_THEMES.includes(t) ? t : 'calido';
}

function storedDark(): boolean {
  return readStoredValue(DARK_STORAGE_KEYS) === '1';
}

function storedCustomPalettes(): CustomPalette[] {
  try {
    const raw = localStorage.getItem(CUSTOM_PALETTES_STORAGE_KEY);
    return sanitizeCustomPalettes(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

function storedCustomPaletteId(palettes = storedCustomPalettes()): string | null {
  try {
    const id = localStorage.getItem(CUSTOM_PALETTE_ID_STORAGE_KEY);
    return id && palettes.some((palette) => palette.id === id) ? id : null;
  } catch {
    return null;
  }
}

export function useServerSettings() {
  const [goal, setGoalState] = useState(24);
  // Se inicializa desde localStorage para aplicar el tema sin esperar al servidor
  const [dark, setDarkState] = useState<boolean>(storedDark);
  const [theme, setThemeState] = useState<ThemeId>(storedTheme);
  const [customPalettes, setCustomPalettesState] = useState<CustomPalette[]>(storedCustomPalettes);
  const [customPaletteId, setCustomPaletteIdState] = useState<string | null>(() => storedCustomPaletteId());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiClient.getSettings().then((s) => {
      setGoalState(s.goal);
      setDarkState(s.dark);
      if (s.theme && VALID_THEMES.includes(s.theme)) setThemeState(s.theme);
      if (Array.isArray(s.customPalettes)) {
        const palettes = sanitizeCustomPalettes(s.customPalettes);
        setCustomPalettesState(palettes);
        setCustomPaletteIdState(
          s.customPaletteId && palettes.some((palette) => palette.id === s.customPaletteId)
            ? s.customPaletteId
            : null,
        );
      }
    }).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  // Reflejo en localStorage: el script de index.html lo usa antes del primer pintado.
  // Se mantiene también la clave antigua para no perder preferencias al renombrar la app.
  useEffect(() => {
    try {
      localStorage.setItem('bilibook-theme', theme);
      localStorage.setItem('readnook-theme', theme);
      localStorage.setItem('bilibook-dark', dark ? '1' : '0');
      localStorage.setItem('readnook-dark', dark ? '1' : '0');
    } catch { /* ignore */ }
  }, [theme, dark]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_PALETTES_STORAGE_KEY, JSON.stringify(customPalettes));
      if (customPaletteId) localStorage.setItem(CUSTOM_PALETTE_ID_STORAGE_KEY, customPaletteId);
      else localStorage.removeItem(CUSTOM_PALETTE_ID_STORAGE_KEY);
    } catch { /* ignore */ }
  }, [customPalettes, customPaletteId]);

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
    setCustomPaletteIdState(null);
    // El modo oscuro es una preferencia aparte: «Nocturno» lo fuerza mientras
    // está activo (ver App), pero al cambiar de tema vuelve el modo previo.
    apiClient.setSettings({ theme: t, customPaletteId: null }).catch(() => {});
  }, []);

  const applyCustomPalette = useCallback((palette: CustomPalette) => {
    setThemeState(palette.baseTheme);
    setCustomPaletteIdState(palette.id);
    apiClient.setSettings({ theme: palette.baseTheme, customPaletteId: palette.id }).catch(() => {});
  }, []);

  const saveCustomPalette = useCallback((palette: CustomPalette) => {
    const clean = sanitizeCustomPalettes([palette])[0];
    if (!clean) return;
    const next = customPalettes.some((item) => item.id === clean.id)
      ? customPalettes.map((item) => (item.id === clean.id ? clean : item))
      : [...customPalettes, clean];
    setCustomPalettesState(next);
    setThemeState(clean.baseTheme);
    setCustomPaletteIdState(clean.id);
    apiClient.setSettings({
      customPalettes: next,
      customPaletteId: clean.id,
      theme: clean.baseTheme,
    }).catch(() => {});
  }, [customPalettes]);

  const deleteCustomPalette = useCallback((id: string) => {
    const next = customPalettes.filter((palette) => palette.id !== id);
    const nextActiveId = customPaletteId === id ? null : customPaletteId;
    setCustomPalettesState(next);
    setCustomPaletteIdState(nextActiveId);
    apiClient.setSettings({ customPalettes: next, customPaletteId: nextActiveId }).catch(() => {});
  }, [customPalettes, customPaletteId]);

  const activeCustomPalette = customPalettes.find((palette) => palette.id === customPaletteId) || null;

  return {
    goal,
    setGoal,
    dark,
    setDark,
    theme,
    setTheme,
    customPalettes,
    customPaletteId,
    activeCustomPalette,
    applyCustomPalette,
    saveCustomPalette,
    deleteCustomPalette,
    loaded,
  };
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

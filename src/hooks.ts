import { useState, useEffect, useCallback, useRef } from 'react';
import type { Book, CustomPalette, ThemeId } from './types';
import { THEMES } from './types';
import { apiClient, type Settings } from './api';
import { CUSTOM_PALETTE_CSS_VARS_KEY, sanitizeCustomPalettes } from './themePalettes';
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
      const saved = await apiClient.updateBook(id, effectivePatch);
      if ('coverUrl' in effectivePatch || 'coverSourceUrl' in effectivePatch) {
        // El servidor es la autoridad sobre la copia local: si ha descargado
        // él la portada, adoptamos su URL sin pisar otros cambios recientes.
        setBooks((prev) => prev.map((b) => (
          b.id === id
            ? { ...b, coverUrl: saved.coverUrl, coverSourceUrl: saved.coverSourceUrl }
            : b
        )));
      }
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
const CUSTOM_PALETTES_STORAGE_KEY = 'bilibook-custom-palettes';
const CUSTOM_PALETTE_ID_STORAGE_KEY = 'bilibook-custom-palette-id';
const SETTINGS_SYNC_MIGRATION_KEY = 'bilibook-settings-sync-v3';
const SETTINGS_SYNC_INTERVAL_MS = 15_000;
const LEGACY_APPEARANCE_STORAGE_KEYS = [
  'bilibook-theme',
  'readnook-theme',
  'bilibook-dark',
  'readnook-dark',
  CUSTOM_PALETTES_STORAGE_KEY,
  CUSTOM_PALETTE_ID_STORAGE_KEY,
  CUSTOM_PALETTE_CSS_VARS_KEY,
  'bilibook-settings-sync-v2',
];

function normalizeServerSettings(value: unknown): Settings | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<Settings>;
  const palettes = sanitizeCustomPalettes(candidate.customPalettes);
  return {
    goal: typeof candidate.goal === 'number' && Number.isFinite(candidate.goal)
      ? candidate.goal
      : 24,
    dark: Boolean(candidate.dark),
    theme: candidate.theme && VALID_THEMES.includes(candidate.theme)
      ? candidate.theme
      : 'calido',
    customPalettes: palettes,
    customPaletteId: candidate.customPaletteId
      && palettes.some((palette) => palette.id === candidate.customPaletteId)
      ? candidate.customPaletteId
      : null,
    settingsVersion: Number.isSafeInteger(candidate.settingsVersion)
      && (candidate.settingsVersion as number) > 0
      ? (candidate.settingsVersion as number)
      : 0,
  };
}

function settingsFingerprint(settings: Settings): string {
  return JSON.stringify(normalizeServerSettings(settings) || settings);
}

/**
 * En producción el propio servidor incrusta estos ajustes en el HTML que
 * entrega. Así, el primer estado de apariencia ya es el del servidor en el
 * PC y en el teléfono; no sale de localStorage.
 */
function embeddedServerSettings(): Settings | null {
  if (typeof window === 'undefined') return null;
  const raw = (window as Window & { __BILIBOOK_SETTINGS__?: unknown }).__BILIBOOK_SETTINGS__;
  return normalizeServerSettings(raw);
}

function clearLegacyAppearanceStorage(): void {
  try {
    for (const key of LEGACY_APPEARANCE_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    /* almacenamiento no disponible */
  }
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
  const [initialServerSettings] = useState<Settings | null>(embeddedServerSettings);
  const [goal, setGoalState] = useState(initialServerSettings?.goal ?? 24);
  // La apariencia no se inicializa desde localStorage. En producción parte
  // de los ajustes que el servidor incrusta en el HTML y después se confirma
  // contra `/api/settings`; por eso al abrir la misma web del servidor en el
  // PC y en el teléfono el punto de partida es exactamente el mismo.
  const [dark, setDarkState] = useState<boolean>(initialServerSettings?.dark ?? false);
  const [theme, setThemeState] = useState<ThemeId>(initialServerSettings?.theme ?? 'calido');
  const [customPalettes, setCustomPalettesState] = useState<CustomPalette[]>(
    initialServerSettings?.customPalettes ?? [],
  );
  const [customPaletteId, setCustomPaletteIdState] = useState<string | null>(
    initialServerSettings?.customPaletteId ?? null,
  );
  const [settingsVersion, setSettingsVersionState] = useState(
    initialServerSettings?.settingsVersion ?? 0,
  );
  const [loaded, setLoaded] = useState(Boolean(initialServerSettings));

  const settingsVersionRef = useRef(initialServerSettings?.settingsVersion ?? 0);
  const appliedSettingsFingerprintRef = useRef(
    initialServerSettings ? settingsFingerprint(initialServerSettings) : '',
  );
  const localMutationRef = useRef(0);
  const pendingSettingsWritesRef = useRef(0);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const localPalettesSnapshotRef = useRef<CustomPalette[] | null>(null);
  if (!localPalettesSnapshotRef.current) {
    localPalettesSnapshotRef.current = storedCustomPalettes();
  }
  const localPaletteIdSnapshotRef = useRef<string | null | undefined>(undefined);
  if (localPaletteIdSnapshotRef.current === undefined) {
    localPaletteIdSnapshotRef.current = storedCustomPaletteId(localPalettesSnapshotRef.current);
  }

  const applySettings = useCallback((settings: Settings): boolean => {
    const normalized = normalizeServerSettings(settings);
    if (!normalized) return false;
    const incomingVersion = normalized.settingsVersion;
    // Una respuesta antigua no puede deshacer un ajuste más reciente que ya
    // se hubiera visto (por ejemplo, el PUT de este dispositivo o un GET
    // posterior al cambio hecho en el otro).
    if (incomingVersion > 0 && incomingVersion < settingsVersionRef.current) return false;

    const fingerprint = JSON.stringify(normalized);
    // El sondeo periódico no debe repintar ni reanimar el tema si el otro
    // dispositivo no ha cambiado nada desde la última respuesta.
    if (appliedSettingsFingerprintRef.current === fingerprint) return false;
    appliedSettingsFingerprintRef.current = fingerprint;

    settingsVersionRef.current = Math.max(settingsVersionRef.current, incomingVersion);
    setSettingsVersionState(settingsVersionRef.current);
    setGoalState(normalized.goal);
    setDarkState(normalized.dark);
    setThemeState(normalized.theme);
    setCustomPalettesState(normalized.customPalettes);
    setCustomPaletteIdState(normalized.customPaletteId);
    return true;
  }, []);

  const beginLocalMutation = useCallback((): number => {
    localMutationRef.current += 1;
    pendingSettingsWritesRef.current += 1;
    return localMutationRef.current;
  }, []);

  const runSettingsWrite = useCallback((mutation: number, request: Promise<Settings>) => {
    void request
      .then((saved) => {
        if (localMutationRef.current === mutation) applySettings(saved);
      })
      .catch(() => {
        // Permite que el siguiente refresco vuelva a aplicar los ajustes del
        // servidor y reconcilie la vista si este guardado no llegó a él.
        if (localMutationRef.current === mutation) {
          appliedSettingsFingerprintRef.current = '';
        }
      })
      .finally(() => {
        pendingSettingsWritesRef.current = Math.max(0, pendingSettingsWritesRef.current - 1);
      });
  }, [applySettings]);

  const persistSettings = useCallback((
    mutation: number,
    settings: Parameters<typeof apiClient.setSettings>[0],
  ) => {
    runSettingsWrite(mutation, apiClient.setSettings(settings));
  }, [runSettingsWrite]);

  // Migración única de dispositivos que ya tenían paletas solo en su
  // localStorage (el caso de una paleta creada en el móvil que el PC nunca
  // vio). Se suben una a una sin enviar la lista local completa, para unir
  // las de ambos dispositivos en vez de que una lista pise a la otra.
  const migrateLocalPalettes = useCallback(async (
    serverSettings: Settings,
    mutationAtStart: number,
  ): Promise<Settings> => {
    let alreadyMigrated = false;
    try {
      alreadyMigrated = localStorage.getItem(SETTINGS_SYNC_MIGRATION_KEY) === '1';
    } catch {
      alreadyMigrated = false;
    }
    if (alreadyMigrated) return serverSettings;

    const localPalettes = localPalettesSnapshotRef.current || [];
    const serverIds = new Set((serverSettings.customPalettes || []).map((palette) => palette.id));
    const missing = localPalettes.filter((palette) => !serverIds.has(palette.id));
    let latest = serverSettings;

    for (const palette of missing) {
      if (localMutationRef.current !== mutationAtStart) return latest;
      latest = await apiClient.saveCustomPalette(palette, false);
    }

    const localActiveId = localPaletteIdSnapshotRef.current;
    const localActive = localActiveId
      ? localPalettes.find((palette) => palette.id === localActiveId)
      : null;
    if (
      localActive
      && missing.some((palette) => palette.id === localActive.id)
      && !serverSettings.customPaletteId
      && localMutationRef.current === mutationAtStart
    ) {
      latest = await apiClient.saveCustomPalette(localActive, true);
    }

    if (localMutationRef.current === mutationAtStart) {
      try {
        localStorage.setItem(SETTINGS_SYNC_MIGRATION_KEY, '1');
      } catch { /* la unión ya está en el servidor aunque no se pueda marcar */ }
      // A partir de aquí la apariencia sale solo del servidor. Borrar el
      // espejo antiguo impide que un tema/modo/variables CSS de este
      // navegador vuelvan a imponerse en el siguiente arranque.
      clearLegacyAppearanceStorage();
    }
    return latest;
  }, []);

  const refreshSettings = useCallback(async (): Promise<void> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;
    if (pendingSettingsWritesRef.current > 0) return;

    const mutationAtStart = localMutationRef.current;
    const request = (async () => {
      try {
        const serverSettings = await apiClient.getSettings();
        const migratedSettings = await migrateLocalPalettes(serverSettings, mutationAtStart);
        if (localMutationRef.current === mutationAtStart) {
          applySettings(migratedSettings);
        }
      } catch {
        // Sin conexión se conserva el último estado del servidor ya cargado;
        // se reintenta al volver el foco, recuperar la red o en el ciclo.
      } finally {
        setLoaded(true);
      }
    })();

    refreshInFlightRef.current = request;
    void request.finally(() => {
      if (refreshInFlightRef.current === request) refreshInFlightRef.current = null;
    });
    return request;
  }, [applySettings, migrateLocalPalettes]);

  useEffect(() => {
    void refreshSettings();

    const refreshIfVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        void refreshSettings();
      }
    };
    const interval = window.setInterval(refreshIfVisible, SETTINGS_SYNC_INTERVAL_MS);
    window.addEventListener('focus', refreshIfVisible);
    window.addEventListener('online', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
      window.removeEventListener('online', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [refreshSettings]);

  const setGoal = useCallback((g: number) => {
    const mutation = beginLocalMutation();
    setGoalState(g);
    persistSettings(mutation, { goal: g });
  }, [beginLocalMutation, persistSettings]);

  const setDark = useCallback((d: boolean) => {
    const mutation = beginLocalMutation();
    setDarkState(d);
    persistSettings(mutation, { dark: d });
  }, [beginLocalMutation, persistSettings]);

  const setTheme = useCallback((t: ThemeId) => {
    const mutation = beginLocalMutation();
    setThemeState(t);
    setCustomPaletteIdState(null);
    // El modo oscuro es una preferencia aparte: «Nocturno» lo fuerza mientras
    // está activo (ver App), pero al cambiar de tema vuelve el modo previo.
    persistSettings(mutation, { theme: t, customPaletteId: null });
  }, [beginLocalMutation, persistSettings]);

  const applyCustomPalette = useCallback((palette: CustomPalette) => {
    const mutation = beginLocalMutation();
    setThemeState(palette.baseTheme);
    setCustomPaletteIdState(palette.id);
    persistSettings(mutation, { theme: palette.baseTheme, customPaletteId: palette.id });
  }, [beginLocalMutation, persistSettings]);

  const saveCustomPalette = useCallback((palette: CustomPalette) => {
    const clean = sanitizeCustomPalettes([palette])[0];
    if (!clean) return;
    const mutation = beginLocalMutation();
    setCustomPalettesState((previous) => (
      previous.some((item) => item.id === clean.id)
        ? previous.map((item) => (item.id === clean.id ? clean : item))
        : [...previous, clean]
    ));
    setThemeState(clean.baseTheme);
    setCustomPaletteIdState(clean.id);
    // Endpoint por paleta: no se manda la lista que este dispositivo tenga en
    // memoria, así no se borran las paletas creadas mientras tanto en otro.
    runSettingsWrite(mutation, apiClient.saveCustomPalette(clean, true));
  }, [beginLocalMutation, runSettingsWrite]);

  const deleteCustomPalette = useCallback((id: string) => {
    const mutation = beginLocalMutation();
    setCustomPalettesState((previous) => previous.filter((palette) => palette.id !== id));
    setCustomPaletteIdState((previous) => (previous === id ? null : previous));
    runSettingsWrite(mutation, apiClient.deleteCustomPalette(id));
  }, [beginLocalMutation, runSettingsWrite]);

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
    settingsVersion,
    refreshSettings,
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

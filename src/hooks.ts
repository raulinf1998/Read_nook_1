import { selectedAccount } from './accounts';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Book, CustomPalette, ThemeId } from './types';
import { THEMES } from './types';
import {
  SETTINGS_EVENTS_URL,
  SETTINGS_SYNC_PROTOCOL,
  apiClient,
  type ApiError,
  type Settings,
} from './api';
import { CUSTOM_PALETTE_CSS_VARS_KEY, sanitizeCustomPalettes } from './themePalettes';
import { mergeStoryGraphJournal } from './storyGraphJournal';
import { normalizeChartPreferences, normalizeLibraryView, type ChartPreferences } from './preferences';
import type { LibraryViewMode } from './libraryViews';
import type { StoryGraphBookMetadata, StoryGraphJournalEntry } from './storyGraphJournal';
import { isExternalCoverUrl, localizeBookCover, localizeBookCovers } from './coverStorage';

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
const SETTINGS_RETRY_BASE_MS = 1_000;
const SETTINGS_RETRY_MAX_MS = 30_000;
const LEGACY_MIGRATION_RETRY_MS = 60_000;

export type SettingsSyncStatus = 'connecting' | 'synced' | 'saving' | 'retrying' | 'error';

type SettingsPatch = Parameters<typeof apiClient.setSettings>[0];
type SettingsWriteOperation =
  | { kind: 'patch'; patch: SettingsPatch }
  | { kind: 'savePalette'; palette: CustomPalette; activate: boolean }
  | { kind: 'deletePalette'; id: string };
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
  if (
    typeof candidate.dark !== 'boolean'
    || typeof candidate.theme !== 'string'
    || !VALID_THEMES.includes(candidate.theme)
    || !Array.isArray(candidate.customPalettes)
    || !Number.isSafeInteger(candidate.settingsVersion)
    || (candidate.settingsVersion as number) < 0
  ) return null;
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
    libraryView: normalizeLibraryView(candidate.libraryView),
    chartPreferences: normalizeChartPreferences(candidate.chartPreferences),
    customPaletteId: candidate.customPaletteId
      && palettes.some((palette) => palette.id === candidate.customPaletteId)
      ? candidate.customPaletteId
      : null,
    settingsVersion: Number.isSafeInteger(candidate.settingsVersion)
      && (candidate.settingsVersion as number) > 0
      ? (candidate.settingsVersion as number)
      : 0,
    settingsSyncProtocol: Number.isSafeInteger(candidate.settingsSyncProtocol)
      && (candidate.settingsSyncProtocol as number) > 0
      ? (candidate.settingsSyncProtocol as number)
      : 0,
  };
}

function settingsFingerprint(settings: Settings): string {
  return JSON.stringify(normalizeServerSettings(settings) || settings);
}

function settingsErrorMessage(error: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Sin conexión con el servidor. Se reintentará automáticamente al volver la red.';
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'No se pudo confirmar el guardado con el servidor.';
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
  const [libraryView, setLibraryViewState] = useState<LibraryViewMode>(initialServerSettings?.libraryView ?? 'wood');
  const [chartPreferences, setChartPreferencesState] = useState<ChartPreferences>(normalizeChartPreferences(initialServerSettings?.chartPreferences));
  const [settingsVersion, setSettingsVersionState] = useState(
    initialServerSettings?.settingsVersion ?? 0,
  );
  const [loaded, setLoaded] = useState(Boolean(initialServerSettings));
  const [settingsSyncStatus, setSettingsSyncStatus] = useState<SettingsSyncStatus>('connecting');
  const [settingsSyncError, setSettingsSyncError] = useState<string | null>(null);
  const [settingsLastSyncedAt, setSettingsLastSyncedAt] = useState<number | null>(null);

  const settingsVersionRef = useRef(initialServerSettings?.settingsVersion ?? 0);
  const appliedSettingsFingerprintRef = useRef(
    initialServerSettings ? settingsFingerprint(initialServerSettings) : '',
  );
  const localMutationRef = useRef(0);
  const confirmedSettingsRef = useRef<Settings | null>(initialServerSettings);
  const writeQueueRef = useRef<SettingsWriteOperation[]>([]);
  const writeInFlightRef = useRef(false);
  const activeWriteOperationRef = useRef<SettingsWriteOperation | null>(null);
  const writeRetryTimerRef = useRef<number | null>(null);
  const writeRetryAttemptRef = useRef(0);
  const rejectedWriteRef = useRef(false);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const refreshSettingsRef = useRef<(force?: boolean) => Promise<void>>(async () => {});
  const processWriteQueueRef = useRef<() => Promise<void>>(async () => {});
  const legacyMigrationInFlightRef = useRef(false);
  const legacyMigrationDoneRef = useRef(false);
  const legacyMigrationNextRetryRef = useRef(0);
  const localPalettesSnapshotRef = useRef<CustomPalette[] | null>(null);
  if (!localPalettesSnapshotRef.current) {
    localPalettesSnapshotRef.current = storedCustomPalettes();
  }

  const hasPendingWrites = useCallback((): boolean => (
    writeInFlightRef.current || writeQueueRef.current.length > 0
  ), []);

  const noteServerSettings = useCallback((settings: Settings): Settings | null => {
    const normalized = normalizeServerSettings(settings);
    if (!normalized) return null;
    const incomingVersion = normalized.settingsVersion;
    // Una respuesta antigua no puede deshacer un ajuste más reciente que ya
    // se hubiera visto (por ejemplo, el PUT de este dispositivo o un GET
    // posterior al cambio hecho en el otro).
    if (incomingVersion < settingsVersionRef.current) return null;

    confirmedSettingsRef.current = normalized;
    settingsVersionRef.current = Math.max(settingsVersionRef.current, incomingVersion);
    setSettingsVersionState(settingsVersionRef.current);
    setSettingsLastSyncedAt(Date.now());

    if ((normalized.settingsSyncProtocol || 0) < SETTINGS_SYNC_PROTOCOL) {
      // Esto era invisible antes: un frontend nuevo contra un proceso de
      // servidor antiguo parecía simplemente quedarse en la versión #0.
      setSettingsSyncError(
        'El servidor respondió sin el protocolo actual de sincronización. Puede estar ejecutando una versión antigua; Bilibook seguirá reintentándolo automáticamente.',
      );
      if (!hasPendingWrites()) setSettingsSyncStatus('error');
    } else if (!hasPendingWrites() && !rejectedWriteRef.current) {
      setSettingsSyncError(null);
      setSettingsSyncStatus('synced');
    }
    return normalized;
  }, [hasPendingWrites]);

  const applySettings = useCallback((settings: Settings, force = false): boolean => {
    const normalized = noteServerSettings(settings);
    if (!normalized) return false;

    const fingerprint = JSON.stringify(normalized);
    // El sondeo periódico no debe repintar ni reanimar el tema si el otro
    // dispositivo no ha cambiado nada desde la última respuesta.
    if (!force && appliedSettingsFingerprintRef.current === fingerprint) return false;
    appliedSettingsFingerprintRef.current = fingerprint;

    setGoalState(normalized.goal);
    setDarkState(normalized.dark);
    setThemeState(normalized.theme);
    setCustomPalettesState(normalized.customPalettes);
    setCustomPaletteIdState(normalized.customPaletteId);
    setLibraryViewState(normalized.libraryView);
    setChartPreferencesState(normalized.chartPreferences);
    return true;
  }, [noteServerSettings]);

  const beginLocalMutation = useCallback((): number => {
    localMutationRef.current += 1;
    rejectedWriteRef.current = false;
    setSettingsSyncError(null);
    setSettingsSyncStatus('saving');
    return localMutationRef.current;
  }, []);

  const clearWriteRetryTimer = useCallback(() => {
    if (writeRetryTimerRef.current) {
      window.clearTimeout(writeRetryTimerRef.current);
      writeRetryTimerRef.current = null;
    }
  }, []);

  const scheduleWriteRetry = useCallback(() => {
    if (writeRetryTimerRef.current) return;
    const delay = Math.min(
      SETTINGS_RETRY_MAX_MS,
      SETTINGS_RETRY_BASE_MS * (2 ** writeRetryAttemptRef.current),
    );
    writeRetryAttemptRef.current += 1;
    writeRetryTimerRef.current = window.setTimeout(() => {
      writeRetryTimerRef.current = null;
      void processWriteQueueRef.current();
    }, delay);
  }, []);

  const executeWriteOperation = useCallback((operation: SettingsWriteOperation): Promise<Settings> => {
    if (operation.kind === 'patch') return apiClient.setSettings(operation.patch);
    if (operation.kind === 'savePalette') {
      return apiClient.saveCustomPalette(operation.palette, operation.activate);
    }
    return apiClient.deleteCustomPalette(operation.id);
  }, []);

  const processWriteQueue = useCallback(async (): Promise<void> => {
    if (writeInFlightRef.current) return;
    if (!writeQueueRef.current.length) {
      if (!rejectedWriteRef.current && (confirmedSettingsRef.current?.settingsSyncProtocol || 0) >= SETTINGS_SYNC_PROTOCOL) {
        setSettingsSyncError(null);
        setSettingsSyncStatus('synced');
      }
      return;
    }

    clearWriteRetryTimer();
    writeInFlightRef.current = true;
    setSettingsSyncStatus('saving');

    while (writeQueueRef.current.length) {
      const operation = writeQueueRef.current[0];
      activeWriteOperationRef.current = operation;
      try {
        const saved = await executeWriteOperation(operation);
        const normalizedSaved = normalizeServerSettings(saved);
        if (!normalizedSaved) throw new Error('El servidor no confirmó los ajustes guardados.');
        // Una respuesta HTTP 200 no basta: algunos servidores antiguos
        // ignoran el ID de paleta. No marcar como guardada una selección que
        // el servidor no ha devuelto realmente.
        const expectedPaletteId = operation.kind === 'savePalette' && operation.activate
          ? operation.palette.id
          : operation.kind === 'patch' ? operation.patch.customPaletteId : undefined;
        const expectedTheme = operation.kind === 'patch' ? operation.patch.theme : undefined;
        if ((expectedPaletteId !== undefined && normalizedSaved.customPaletteId !== expectedPaletteId)
          || (expectedTheme !== undefined && normalizedSaved.theme !== expectedTheme)) {
          throw new Error('El servidor no confirmó la paleta seleccionada. Se reintentará automáticamente.');
        }
        if (writeQueueRef.current[0] === operation) writeQueueRef.current.shift();
        else writeQueueRef.current = writeQueueRef.current.filter((item) => item !== operation);
        activeWriteOperationRef.current = null;
        writeRetryAttemptRef.current = 0;

        const confirmed = noteServerSettings(saved);
        if (confirmed && !writeQueueRef.current.length) applySettings(confirmed, true);
      } catch (error) {
        activeWriteOperationRef.current = null;
        writeInFlightRef.current = false;
        const status = (error as ApiError)?.status;
        const permanent = status === 400 || status === 409 || status === 422;
        setSettingsSyncError(settingsErrorMessage(error));

        if (permanent) {
          rejectedWriteRef.current = true;
          if (writeQueueRef.current[0] === operation) writeQueueRef.current.shift();
          else writeQueueRef.current = writeQueueRef.current.filter((item) => item !== operation);
          appliedSettingsFingerprintRef.current = '';
          setSettingsSyncStatus('error');
          void refreshSettingsRef.current(true);
          if (writeQueueRef.current.length) void processWriteQueueRef.current();
          return;
        }

        // Nada de perder el cambio en silencio ni pedir al usuario que pulse
        // «sincronizar»: la operación queda en cola y se reintenta sola con
        // espera creciente, además de al recuperar red/foco.
        setSettingsSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'error' : 'retrying');
        scheduleWriteRetry();
        return;
      }
    }

    writeInFlightRef.current = false;
    if ((confirmedSettingsRef.current?.settingsSyncProtocol || 0) >= SETTINGS_SYNC_PROTOCOL) {
      setSettingsSyncError(null);
      setSettingsSyncStatus('synced');
    } else {
      setSettingsSyncStatus('error');
    }
    // Confirmación final contra el servidor tras vaciar la cola: recoge
    // también paletas creadas en paralelo desde otro dispositivo.
    void refreshSettingsRef.current();
  }, [applySettings, clearWriteRetryTimer, executeWriteOperation, noteServerSettings, scheduleWriteRetry]);

  useEffect(() => {
    processWriteQueueRef.current = processWriteQueue;
  }, [processWriteQueue]);

  const enqueueWriteOperation = useCallback((operation: SettingsWriteOperation) => {
    if (operation.kind === 'patch') {
      const last = writeQueueRef.current[writeQueueRef.current.length - 1];
      if (last?.kind === 'patch' && last !== activeWriteOperationRef.current) {
        last.patch = {
          ...last.patch,
          ...operation.patch,
          ...((last.patch.chartPreferences || operation.patch.chartPreferences) ? {
            chartPreferences: { ...last.patch.chartPreferences, ...operation.patch.chartPreferences },
          } : {}),
        };
        void processWriteQueueRef.current();
        return;
      }
    }
    writeQueueRef.current.push(operation);
    void processWriteQueueRef.current();
  }, []);

  const persistSettings = useCallback((
    _mutation: number,
    settings: SettingsPatch,
  ) => {
    void _mutation;
    enqueueWriteOperation({ kind: 'patch', patch: settings });
  }, [enqueueWriteOperation]);

  // Migración única de dispositivos que ya tenían paletas solo en su
  // localStorage (el caso de una paleta creada en el móvil que el PC nunca
  // vio). Se suben una a una sin enviar la lista local completa, para unir
  // las de ambos dispositivos en vez de que una lista pise a la otra.
  const migrateLegacyPalettesInBackground = useCallback(async (
    serverSettings: Settings,
  ): Promise<void> => {
    if (selectedAccount() === 'pequenaja') return;
    if (
      legacyMigrationDoneRef.current
      || legacyMigrationInFlightRef.current
      || Date.now() < legacyMigrationNextRetryRef.current
    ) return;

    legacyMigrationInFlightRef.current = true;
    const mutationAtStart = localMutationRef.current;
    try {
      let alreadyMigrated = false;
      try {
        alreadyMigrated = localStorage.getItem(SETTINGS_SYNC_MIGRATION_KEY) === '1';
      } catch {
        alreadyMigrated = false;
      }
      if (alreadyMigrated) {
        legacyMigrationDoneRef.current = true;
        return;
      }

      const localPalettes = localPalettesSnapshotRef.current || [];
      const serverIds = new Set((serverSettings.customPalettes || []).map((palette) => palette.id));
      const missing = localPalettes.filter((palette) => !serverIds.has(palette.id));
      let latest = serverSettings;

      for (const palette of missing) {
        latest = await apiClient.saveCustomPalette(palette, false);
        noteServerSettings(latest);
      }

      // Recuperar paletas no debe activar una selección obsoleta: otro
      // dispositivo puede haber cambiado la apariencia durante la migración.

      try {
        localStorage.setItem(SETTINGS_SYNC_MIGRATION_KEY, '1');
      } catch { /* la unión ya está en el servidor aunque no se pueda marcar */ }
      // A partir de aquí la apariencia sale solo del servidor. Borrar el
      // espejo antiguo impide que un tema/modo/variables CSS de este
      // navegador vuelvan a imponerse en el siguiente arranque.
      clearLegacyAppearanceStorage();
      legacyMigrationDoneRef.current = true;

      if (
        latest !== serverSettings
        && !hasPendingWrites()
        && localMutationRef.current === mutationAtStart
      ) {
        applySettings(latest);
      }
    } catch (error) {
      // Crítico: una paleta antigua que no se pueda subir jamás debe bloquear
      // la aplicación de los ajustes que el servidor ya ha devuelto. Antes
      // este error abortaba refreshSettings y el teléfono se quedaba con el
      // tema por defecto y la versión #0 aunque el GET hubiera ido bien.
      legacyMigrationNextRetryRef.current = Date.now() + LEGACY_MIGRATION_RETRY_MS;
      console.warn('No se pudieron migrar todavía las paletas antiguas del navegador:', error);
    } finally {
      legacyMigrationInFlightRef.current = false;
    }
  }, [applySettings, hasPendingWrites, noteServerSettings]);

  const refreshSettings = useCallback(async (force = false): Promise<void> => {
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const mutationAtStart = localMutationRef.current;
    const request = (async () => {
      try {
        const serverSettings = await apiClient.getSettings();
        if (!normalizeServerSettings(serverSettings)) throw new Error('El servidor devolvió unos ajustes no válidos.');
        const confirmed = noteServerSettings(serverSettings);
        if (!confirmed) return; // Llegó una respuesta anterior a otra ya confirmada.

        // El servidor manda de inmediato. La migración de paletas antiguas
        // se lanza después, en segundo plano, y nunca puede impedir que el
        // tema/modo confirmados por el servidor se apliquen en esta pantalla.
        if (localMutationRef.current === mutationAtStart && !hasPendingWrites()) {
          applySettings(confirmed, force);
        }
        void migrateLegacyPalettesInBackground(confirmed);
      } catch (error) {
        if (!hasPendingWrites()) {
          setSettingsSyncError(settingsErrorMessage(error));
          setSettingsSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'error' : 'retrying');
        }
      } finally {
        setLoaded(true);
      }
    })();

    refreshInFlightRef.current = request;
    void request.finally(() => {
      if (refreshInFlightRef.current === request) refreshInFlightRef.current = null;
    });
    return request;
  }, [applySettings, hasPendingWrites, migrateLegacyPalettesInBackground, noteServerSettings]);

  useEffect(() => {
    refreshSettingsRef.current = refreshSettings;
  }, [refreshSettings]);

  useEffect(() => {
    void processWriteQueueRef.current();
    void refreshSettings();

    let eventSource: EventSource | null = null;
    if (typeof EventSource !== 'undefined') {
      // Canal continuo servidor -> cliente. Cuando otro dispositivo cambia
      // el tema, el servidor empuja aquí los ajustes completos y se aplican
      // sin recargar ni pulsar nada. EventSource reconecta solo; el sondeo
      // de abajo queda como respaldo para proxies que corten SSE.
      eventSource = new EventSource(SETTINGS_EVENTS_URL);
      eventSource.addEventListener('settings', (event) => {
        try {
          const parsed = JSON.parse((event as MessageEvent<string>).data) as Settings;
          const confirmed = noteServerSettings(parsed);
          if (confirmed && !hasPendingWrites()) applySettings(confirmed);
          setLoaded(true);
        } catch {
          void refreshSettings();
        }
      });
      eventSource.addEventListener('open', () => {
        void processWriteQueueRef.current();
        void refreshSettings();
      });
      eventSource.addEventListener('error', () => {
        if (!hasPendingWrites()) {
          setSettingsSyncStatus((previous) => (previous === 'synced' ? 'retrying' : previous));
        }
      });
    }

    const syncIfVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        clearWriteRetryTimer();
        writeRetryAttemptRef.current = 0;
        void processWriteQueueRef.current();
        void refreshSettings();
      }
    };
    const interval = window.setInterval(syncIfVisible, SETTINGS_SYNC_INTERVAL_MS);
    window.addEventListener('focus', syncIfVisible);
    window.addEventListener('online', syncIfVisible);
    document.addEventListener('visibilitychange', syncIfVisible);

    return () => {
      eventSource?.close();
      clearWriteRetryTimer();
      window.clearInterval(interval);
      window.removeEventListener('focus', syncIfVisible);
      window.removeEventListener('online', syncIfVisible);
      document.removeEventListener('visibilitychange', syncIfVisible);
    };
  }, [applySettings, clearWriteRetryTimer, hasPendingWrites, noteServerSettings, refreshSettings]);

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
    void mutation;
    enqueueWriteOperation({ kind: 'savePalette', palette: clean, activate: true });
  }, [beginLocalMutation, enqueueWriteOperation]);

  const deleteCustomPalette = useCallback((id: string) => {
    const mutation = beginLocalMutation();
    setCustomPalettesState((previous) => previous.filter((palette) => palette.id !== id));
    setCustomPaletteIdState((previous) => (previous === id ? null : previous));
    void mutation;
    enqueueWriteOperation({ kind: 'deletePalette', id });
  }, [beginLocalMutation, enqueueWriteOperation]);

  const setLibraryView = useCallback((view: LibraryViewMode) => {
    const mutation = beginLocalMutation();
    setLibraryViewState(view);
    persistSettings(mutation, { libraryView: view });
  }, [beginLocalMutation, persistSettings]);

  const setChartPreference = useCallback(<K extends keyof ChartPreferences>(key: K, value: ChartPreferences[K]) => {
    const mutation = beginLocalMutation();
    setChartPreferencesState((previous) => ({ ...previous, [key]: value }));
    persistSettings(mutation, { chartPreferences: { [key]: value } });
  }, [beginLocalMutation, persistSettings]);

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
    libraryView,
    setLibraryView,
    chartPreferences,
    setChartPreference,
    settingsVersion,
    settingsSyncStatus,
    settingsSyncError,
    settingsLastSyncedAt,
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

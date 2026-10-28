import type { Book, CustomPalette, ThemeId } from './types';
import type { LibraryViewMode } from './libraryViews';
import type { ChartPreferences } from './preferences';

const API_BASE = '/api';

export type ApiError = Error & { status?: number };

async function responseError(res: Response): Promise<ApiError> {
  let message = `API error: ${res.status}`;
  try {
    const data = await res.clone().json();
    if (data && typeof data.error === 'string' && data.error.trim()) message = data.error;
  } catch {
    /* La respuesta puede no ser JSON; se usa el estado HTTP como respaldo. */
  }
  const error = new Error(message) as ApiError;
  error.status = res.status;
  return error;
}

type ApiOptions = RequestInit & { timeoutMs?: number };

async function api<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { timeoutMs, signal, ...init } = opts;
  let controller: AbortController | null = null;
  let timeout: number | undefined;
  let removeAbortListener: (() => void) | undefined;
  let requestSignal = signal || undefined;

  if (timeoutMs && typeof AbortController !== 'undefined') {
    controller = new AbortController();
    requestSignal = controller.signal;
    if (signal) {
      if (signal.aborted) controller.abort();
      else {
        const onAbort = () => controller?.abort();
        signal.addEventListener('abort', onAbort, { once: true });
        removeAbortListener = () => signal.removeEventListener('abort', onAbort);
      }
    }
    timeout = window.setTimeout(() => controller?.abort(), timeoutMs);
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
      signal: requestSignal,
    });
    if (!res.ok) throw await responseError(res);
    return res.json();
  } catch (error) {
    if (controller?.signal.aborted && !signal?.aborted) {
      const timeoutError = new Error('El servidor tardó demasiado en responder.') as ApiError;
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    if (timeout) window.clearTimeout(timeout);
    removeAbortListener?.();
  }
}

export interface StoredCover {
  coverUrl: string;
  filename: string;
  size: number;
  contentType: string;
  sourceUrl?: string;
}

export interface Settings {
  goal: number;
  dark: boolean;
  theme: ThemeId;
  customPalettes: CustomPalette[];
  customPaletteId: string | null;
  libraryView: LibraryViewMode;
  chartPreferences: ChartPreferences;
  /** Crece en el servidor con cada cambio; sirve para sincronizar dispositivos. */
  settingsVersion: number;
  /** Versión del protocolo continuo de ajustes que ofrece el servidor. */
  settingsSyncProtocol?: number;
}

export const SETTINGS_SYNC_PROTOCOL = 2;
export const SETTINGS_EVENTS_URL = '/api/settings/events';

export const apiClient = {
  getBooks: () => api<Book[]>('/books'),
  addBook: (book: Omit<Book, 'id' | 'createdAt'>) =>
    api<Book>('/books', { method: 'POST', body: JSON.stringify(book) }),
  updateBook: (id: string, patch: Partial<Book>) =>
    api<Book>(`/books/${id}`, { method: 'PUT', body: JSON.stringify(patch) }),
  deleteBook: (id: string) =>
    api<{ ok: boolean }>(`/books/${id}`, { method: 'DELETE' }),
  importBooks: (books: Omit<Book, 'id' | 'createdAt'>[]) =>
    api<{ imported: number }>('/books/import', { method: 'POST', body: JSON.stringify({ books }) }),
  storeCoverFromUrl: (url: string) =>
    api<StoredCover>('/covers/from-url', { method: 'POST', body: JSON.stringify({ url }) }),
  uploadCover: async (file: File): Promise<StoredCover> => {
    const res = await fetch(`${API_BASE}/covers/upload`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!res.ok) throw await responseError(res);
    return res.json();
  },
  getTags: () => api<string[]>('/tags'),
  addTag: (tag: string) =>
    api<string[]>('/tags', { method: 'POST', body: JSON.stringify({ tag }) }),
  removeTag: (tag: string) =>
    api<string[]>(`/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' }),
  // La marca temporal evita que un proxy o navegador móvil reutilice una
  // respuesta antigua aunque ignore `no-store`. El canal principal en vivo
  // es SSE; esta petición actúa como confirmación y respaldo.
  getSettings: () => api<Settings>(`/settings?ts=${Date.now()}`, {
    cache: 'no-store',
    timeoutMs: 12_000,
  }),
  setSettings: async (settings: Partial<Omit<Settings, 'settingsVersion' | 'settingsSyncProtocol' | 'chartPreferences'>> & { chartPreferences?: Partial<ChartPreferences> }) => {
    try {
      return await api<Settings>('/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
        timeoutMs: 12_000,
      });
    } catch (error) {
      const status = (error as ApiError)?.status;
      if (status !== 404 && status !== 405) throw error;
      return api<Settings>('/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
        timeoutMs: 12_000,
      });
    }
  },
  saveCustomPalette: async (palette: CustomPalette, activate = true) => {
    const path = `/settings/custom-palettes/${encodeURIComponent(palette.id)}`;
    const body = JSON.stringify({ palette, activate });
    try {
      return await api<Settings>(path, { method: 'PUT', body, timeoutMs: 12_000 });
    } catch (error) {
      const status = (error as ApiError)?.status;
      if (status !== 404 && status !== 405) throw error;
      return api<Settings>(path, { method: 'POST', body, timeoutMs: 12_000 });
    }
  },
  deleteCustomPalette: (id: string) =>
    api<Settings>(`/settings/custom-palettes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      timeoutMs: 12_000,
    }),
};
